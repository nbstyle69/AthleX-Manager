import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { isBoxStaff } from '@/lib/isBoxStaff';

/**
 * Portabilité : un gérant qui part emporte les données de SA box, en un fichier.
 *
 * Deux règles gouvernent ce fichier, et elles sont plus importantes que son
 * contenu :
 *
 * 1. Chaque requête part d'une LISTE BLANCHE de colonnes, jamais d'un `select
 *    ('*')`. `box_invitations` porte un `token_hash`, `box_members` des
 *    identifiants Stripe : une étoile ici ne produirait pas un zéro silencieux
 *    mais une fuite.
 * 2. Rien qui sorte de la box. Les profils exportés sont ceux de ses adhérents,
 *    et les lignes filles sont filtrées par `box_id`, pas par appartenance
 *    déduite.
 *
 * L'historique de facturation Stripe n'est pas ici : il vit sur le compte
 * connecté et se lit déjà via `/api/box-revenue`. Ce que la base sait prouver —
 * l'état courant des abonnements et le journal d'encaissements comptoir — y est.
 */

const CENTS = (c: number | null | undefined) => (c == null ? '' : (c / 100).toFixed(2));

function csv(rows: Array<Record<string, string | number | boolean | null>>, headers: string[]): string {
  const cell = (v: string | number | boolean | null | undefined) => {
    const s = v == null ? '' : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(';')];
  for (const r of rows) lines.push(headers.map(h => cell(r[h])).join(';'));
  // BOM : Excel ouvre le fichier en UTF-8, accents compris.
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

export async function GET(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user?.id) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

    const boxId = req.nextUrl.searchParams.get('box_id');
    if (!boxId) return NextResponse.json({ error: 'box_id requis.' }, { status: 400 });

    const supabase = createServiceClient();
    if (!(await isBoxStaff(supabase, user.id, boxId))) {
      return NextResponse.json({ error: 'Non autorisé pour cette box.' }, { status: 403 });
    }

    const [box, members, plans, cash, invitations, schedules, wods] = await Promise.all([
      supabase.from('boxes').select('id, name, slug, city').eq('id', boxId).maybeSingle(),
      supabase.from('box_members')
        .select('member_id, role, status, joined_at, plan_id, subscription_status, subscription_current_period_end, subscription_cancel_at_period_end, subscription_paused, amount_cents, payment_method_type, past_due_since, commitment_end_date')
        .eq('box_id', boxId),
      supabase.from('membership_plans').select('id, name, price_cents, plan_type, is_active').eq('box_id', boxId),
      supabase.from('box_cash_payments')
        .select('collected_at, member_id, plan_name, amount_cents, source, collected_by')
        .eq('box_id', boxId).order('collected_at', { ascending: false }),
      supabase.from('box_invitations')
        .select('created_at, email, first_name, last_name, plan_id, payment_mode, cash_collected, status, expires_at, accepted_at, send_count, last_sent_at')
        .eq('box_id', boxId).order('created_at', { ascending: false }),
      supabase.from('class_schedules')
        .select('id, title, coach, scheduled_date, start_time, end_time, max_capacity')
        .eq('box_id', boxId),
      supabase.from('box_wods')
        .select('scheduled_date, title, wod_type, description, rounds, time_cap_seconds, notes, is_published, created_at')
        .eq('box_id', boxId).order('scheduled_date', { ascending: false }),
    ]);

    const memberIds = (members.data ?? []).map(m => m.member_id).filter((id): id is string => !!id);
    const scheduleIds = (schedules.data ?? []).map(s => s.id);

    const [profiles, reservations] = await Promise.all([
      memberIds.length
        ? supabase.from('profiles').select('id, email, username, full_name, gender').in('id', memberIds)
        : Promise.resolve({ data: [] as Array<{ id: string; email: string; username: string; full_name: string | null; gender: string | null }> }),
      supabase.from('class_reservations')
        .select('created_at, schedule_id, member_id, status, attended')
        .eq('box_id', boxId).order('created_at', { ascending: false }),
    ]);

    const who = new Map((profiles.data ?? []).map(p => [p.id, p]));
    const planName = new Map((plans.data ?? []).map(p => [p.id, p.name]));
    const seance = new Map((schedules.data ?? []).map(s => [s.id, s]));
    const ident = (id: string | null) => {
      const p = id ? who.get(id) : undefined;
      return { email: p?.email ?? '', nom: p?.full_name ?? p?.username ?? '' };
    };

    const zip = new JSZip();

    zip.file('membres.csv', csv(
      (members.data ?? []).map(m => ({
        email: ident(m.member_id).email,
        nom: ident(m.member_id).nom,
        role: m.role,
        statut: m.status,
        inscrit_le: m.joined_at ?? '',
        formule: m.plan_id ? planName.get(m.plan_id) ?? '' : '',
      })),
      ['email', 'nom', 'role', 'statut', 'inscrit_le', 'formule'],
    ));

    zip.file('abonnements.csv', csv(
      (members.data ?? []).filter(m => m.subscription_status || m.amount_cents).map(m => ({
        email: ident(m.member_id).email,
        formule: m.plan_id ? planName.get(m.plan_id) ?? '' : '',
        montant_eur: CENTS(m.amount_cents),
        statut_abonnement: m.subscription_status ?? '',
        moyen_paiement: m.payment_method_type ?? '',
        prochaine_echeance: m.subscription_current_period_end ?? '',
        resiliation_programmee: m.subscription_cancel_at_period_end ? 'oui' : 'non',
        gel: m.subscription_paused ? 'oui' : 'non',
        impaye_depuis: m.past_due_since ?? '',
        fin_engagement: m.commitment_end_date ?? '',
      })),
      ['email', 'formule', 'montant_eur', 'statut_abonnement', 'moyen_paiement', 'prochaine_echeance',
        'resiliation_programmee', 'gel', 'impaye_depuis', 'fin_engagement'],
    ));

    zip.file('formules.csv', csv(
      (plans.data ?? []).map(p => ({
        nom: p.name, prix_eur: CENTS(p.price_cents), type: p.plan_type ?? '', active: p.is_active ? 'oui' : 'non',
      })),
      ['nom', 'prix_eur', 'type', 'active'],
    ));

    zip.file('encaissements-comptoir.csv', csv(
      (cash.data ?? []).map(c => ({
        date: c.collected_at,
        email: ident(c.member_id).email,
        formule: c.plan_name ?? '',
        montant_eur: CENTS(c.amount_cents),
        origine: c.source,
        encaisse_par: ident(c.collected_by).nom,
      })),
      ['date', 'email', 'formule', 'montant_eur', 'origine', 'encaisse_par'],
    ));

    zip.file('reservations.csv', csv(
      (reservations.data ?? []).filter(r => !r.schedule_id || scheduleIds.includes(r.schedule_id)).map(r => {
        const s = r.schedule_id ? seance.get(r.schedule_id) : undefined;
        return {
          date_cours: s?.scheduled_date ?? '',
          heure: s?.start_time ?? '',
          cours: s?.title ?? '',
          coach: s?.coach ?? '',
          email: ident(r.member_id).email,
          statut: r.status,
          presence: r.attended === null ? 'non pointé' : r.attended ? 'présent' : 'absent',
          reserve_le: r.created_at ?? '',
        };
      }),
      ['date_cours', 'heure', 'cours', 'coach', 'email', 'statut', 'presence', 'reserve_le'],
    ));

    zip.file('wods.csv', csv(
      (wods.data ?? []).map(w => ({
        date: w.scheduled_date,
        titre: w.title,
        type: w.wod_type ?? '',
        description: w.description ?? '',
        rounds: w.rounds ?? '',
        time_cap_secondes: w.time_cap_seconds ?? '',
        notes: w.notes ?? '',
        publie: w.is_published ? 'oui' : 'non',
      })),
      ['date', 'titre', 'type', 'description', 'rounds', 'time_cap_secondes', 'notes', 'publie'],
    ));

    zip.file('invitations.csv', csv(
      (invitations.data ?? []).map(i => ({
        creee_le: i.created_at ?? '',
        email: i.email,
        prenom: i.first_name ?? '',
        nom: i.last_name ?? '',
        formule: i.plan_id ? planName.get(i.plan_id) ?? '' : '',
        mode_paiement: i.payment_mode,
        encaisse: i.cash_collected ? 'oui' : 'non',
        statut: i.status,
        expire_le: i.expires_at,
        acceptee_le: i.accepted_at ?? '',
        envois: i.send_count,
        dernier_envoi: i.last_sent_at ?? '',
      })),
      ['creee_le', 'email', 'prenom', 'nom', 'formule', 'mode_paiement', 'encaisse', 'statut',
        'expire_le', 'acceptee_le', 'envois', 'dernier_envoi'],
    ));

    const day = new Date().toISOString().slice(0, 10);
    const slug = box.data?.slug ?? 'box';
    zip.file('LISEZ-MOI.txt',
      `Export des données de ${box.data?.name ?? 'la box'} — ${day}\n\n` +
      'Fichiers CSV séparés par des points-virgules, encodés en UTF-8 (BOM).\n' +
      'Montants en euros.\n\n' +
      'L’historique des paiements Stripe n’est pas inclus : il appartient au compte\n' +
      'Stripe connecté de la box et se télécharge depuis le tableau de bord Stripe.\n' +
      'Le journal des encaissements comptoir, lui, est complet depuis sa mise en place.\n',
    );

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="athlex-${slug}-${day}.zip"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
