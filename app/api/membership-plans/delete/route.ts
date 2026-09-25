import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { isBoxOwnerAdmin } from '@/lib/isBoxOwnerAdmin';
import { stopBoxMember } from '@/lib/members/stopMembership';
import { countOf } from '@/lib/deleteWithSubscriptions';

/**
 * Suppression d'une formule (S4, B5) : jamais tant que Stripe prélève.
 *
 * Body: { plan_id: string, action: 'check' | 'delete' | 'stop_then_delete' }
 * - `check` : lecture seule, renvoie le nombre d'abonnements Stripe actifs ou
 *   en impayé rattachés, dont les impayés et les membres encore engagés (la
 *   boîte de confirmation choisit ses textes).
 * - `delete` : refusée (409 + nombre) s'il en reste ; sinon suppression.
 * - `stop_then_delete` : chaque abonnement est arrêté à la fin de sa période
 *   (journal + e-mail « fin de période », acteur = le gérant) ; un impayé est
 *   arrêté tout de suite, comme en S2 (journal + e-mail « arrêté ») ; la formule
 *   n'est supprimée que si TOUS les arrêts Stripe ont réussi. Échec partiel :
 *   rien n'est supprimé, les arrêts réussis restent journalisés, la réponse
 *   nomme ceux qui ont échoué.
 *
 * « Désactiver » n'a pas besoin de route : c'est la bascule `is_active`
 * existante de la page Formules, sans appel Stripe.
 */

const LIVE = ['active', 'trialing', 'past_due'];

interface SubRow {
  id: string; box_id: string; member_id: string;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  subscription_cancel_at_period_end: boolean | null;
  subscription_current_period_end: string | null;
  commitment_end_date: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user?.id) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

    const { plan_id, action } = await req.json();
    if (!plan_id || !['check', 'delete', 'stop_then_delete'].includes(action)) {
      return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: planRaw } = await supabase
      .from('membership_plans').select('id, box_id, name').eq('id', plan_id).maybeSingle();
    const plan = planRaw as { id: string; box_id: string; name: string } | null;
    if (!plan) return NextResponse.json({ error: 'Formule introuvable.' }, { status: 404 });
    if (!(await isBoxOwnerAdmin(supabase, user.id, plan.box_id))) {
      return NextResponse.json({ error: 'Non autorisé pour cette box.' }, { status: 403 });
    }

    // Lecture serveur : les colonnes de facturation ne sont plus lisibles côté client.
    const { data: subsRaw } = await supabase
      .from('box_members')
      .select('id, box_id, member_id, stripe_subscription_id, subscription_status, subscription_cancel_at_period_end, subscription_current_period_end, commitment_end_date')
      .eq('box_id', plan.box_id)
      .eq('plan_id', plan.id)
      .in('subscription_status', LIVE);
    const subs = ((subsRaw ?? []) as SubRow[]).filter(s => !!s.stripe_subscription_id);

    if (action === 'check') {
      const now = Date.now();
      return NextResponse.json({
        ok: true,
        active_subscriptions: subs.length,
        past_due: subs.filter(s => s.subscription_status === 'past_due').length,
        engaged: subs.filter(s => s.commitment_end_date && new Date(s.commitment_end_date).getTime() > now).length,
      });
    }

    if (action === 'delete') {
      if (subs.length > 0) {
        return NextResponse.json(
          {
            error: `${subs.length === 1 ? '1 abonnement Stripe est encore actif' : `${subs.length} abonnements Stripe sont encore actifs`} sur cette formule : elle ne peut pas être supprimée.`,
            active_subscriptions: subs.length,
          },
          { status: 409 },
        );
      }
      const { error } = await supabase.from('membership_plans').delete().eq('id', plan.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, deleted: true });
    }

    // stop_then_delete
    const { data: boxRaw } = await supabase
      .from('boxes').select('name, stripe_account_id, contact_email').eq('id', plan.box_id).single();
    const box = boxRaw as { name: string; stripe_account_id: string | null; contact_email: string | null } | null;

    const memberIds = subs.map(s => s.member_id);
    const { data: profilesRaw } = memberIds.length
      ? await supabase.from('profiles').select('id, email, username, full_name').in('id', memberIds)
      : { data: [] };
    const profileById = new Map(
      ((profilesRaw ?? []) as { id: string; email: string | null; username: string | null; full_name: string | null }[])
        .map(p => [p.id, p]),
    );

    const failed: string[] = [];
    let notEmailed = 0;
    for (const s of subs) {
      // Impayé : arrêt immédiat, comme la règle S2 (jamais de fin de période).
      const mode = s.subscription_status === 'past_due' ? 'now' : 'period_end';
      // Déjà programmé : l'état demandé est atteint, rien n'est refait.
      if (mode === 'period_end' && s.subscription_cancel_at_period_end) continue;
      const profile = profileById.get(s.member_id) ?? null;
      try {
        const { emailed } = await stopBoxMember(supabase, {
          member: s, box, profile, planName: plan.name, mode, actorId: user.id,
        });
        if (!emailed) notEmailed += 1;
      } catch {
        // Le nom sert au gérant dans la boîte d'information ; rien dans les journaux.
        failed.push(profile?.username ?? 'un membre');
      }
    }

    if (failed.length > 0) {
      return NextResponse.json(
        {
          error: `Stripe a refusé l’arrêt de ${countOf(failed.length, 'abonnement', 'abonnements')} : ${failed.join(', ')}. La formule n’a pas été supprimée ; les autres abonnements sont bien arrêtés.`,
          failed,
          stopped: subs.length - failed.length,
        },
        { status: 502 },
      );
    }

    const { error } = await supabase.from('membership_plans').delete().eq('id', plan.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      ok: true, deleted: true, stopped: subs.length,
      ...(notEmailed > 0 ? { warning: notEmailed === 1 ? '1 membre n’a pas reçu l’e-mail : préviens-le directement.' : `${notEmailed} membres n’ont pas reçu l’e-mail : préviens-les directement.` } : {}),
    });
  } catch (err: any) {
    console.error('membership-plans delete error:', err?.message ?? err);
    return NextResponse.json({ error: err?.message ?? 'Erreur' }, { status: 500 });
  }
}
