import { NextResponse } from 'next/server';
import { fullDate } from '@/lib/confirmDialog';

/**
 * Gardes d'entrée des routes du Manager (archivage, PR 2).
 *
 * La PR 1 (athlex-app, migration `20270127`) ferme les entrées en base :
 * `box_accepts_entries` est fausse si la box est archivée OU en archivage
 * programmé, et les RPC d'entrée refusent avec `BOX_ARCHIVEE` ou
 * `BOX_ARCHIVAGE_PROGRAMME`. Mais les routes du Manager écrivent avec la clé
 * serveur, que la base laisse passer : chacune doit donc refuser elle-même,
 * avec les mêmes codes et les mêmes messages que la base.
 */

export type EntryRefusalCode = 'BOX_ARCHIVEE' | 'BOX_ARCHIVAGE_PROGRAMME';

/**
 * Contextes, repris de `internal.refus_entree_box` ; `abonnement_box` (portail,
 * réabonnement de la box à AthleX) est propre au Manager.
 */
export type EntryContext = 'adhesion' | 'essai' | 'achat' | 'comptoir' | 'abonnement_box';

export interface EntryRefusal {
  code: EntryRefusalCode;
  message: string;
}

/** Même texte que la base, au caractère près ; `abonnement_box` en plus. */
export function entryRefusalMessage(code: EntryRefusalCode, context: EntryContext, periodEnd: string | null = null): string {
  switch (context) {
    case 'adhesion': return "Cette box n'accepte plus de nouveaux membres.";
    case 'essai': return "Cette box ne propose plus de séance d'essai.";
    case 'comptoir':
      return code === 'BOX_ARCHIVEE'
        ? 'Cette box est archivée : les ventes au comptoir sont fermées.'
        : "Cette box est en cours d'archivage : les ventes au comptoir sont fermées.";
    case 'abonnement_box':
      if (code === 'BOX_ARCHIVEE') return 'Cette box est archivée : son abonnement ne peut plus être modifié.';
      return periodEnd
        ? `L'abonnement de cette box s'arrête le ${fullDate(periodEnd)} : il ne peut plus être modifié.`
        : "L'abonnement de cette box s'arrête avec son archivage programmé : il ne peut plus être modifié.";
    default: return "Cette box n'accepte plus de nouvel abonnement ni d'achat.";
  }
}

/** Refus pour une box, lu sur ses deux colonnes ; `null` si elle accepte. */
export function refusalFor(
  box: { archived_at?: string | null; archive_scheduled_at?: string | null } | null,
  context: EntryContext,
  periodEnd: string | null = null,
): EntryRefusal | null {
  if (!box) return null;
  const code: EntryRefusalCode | null = box.archived_at
    ? 'BOX_ARCHIVEE'
    : box.archive_scheduled_at ? 'BOX_ARCHIVAGE_PROGRAMME' : null;
  return code ? { code, message: entryRefusalMessage(code, context, periodEnd) } : null;
}

type Reader = { from: (table: string) => any };

/**
 * Lit la box (clé serveur) et rend le refus, ou `null`. Une box introuvable
 * n'est pas refusée ici : la route garde son propre « introuvable ».
 */
export async function boxEntryRefusal(supabase: Reader, boxId: string, context: EntryContext): Promise<EntryRefusal | null> {
  const { data } = await supabase
    .from('boxes').select('archived_at, archive_scheduled_at').eq('id', boxId).maybeSingle();
  const box = data as { archived_at: string | null; archive_scheduled_at: string | null } | null;
  if (!box || (!box.archived_at && !box.archive_scheduled_at)) return null;
  let periodEnd: string | null = null;
  if (context === 'abonnement_box' && !box.archived_at) {
    const { data: sub } = await supabase
      .from('box_subscriptions').select('current_period_end').eq('box_id', boxId).maybeSingle();
    periodEnd = (sub as { current_period_end: string | null } | null)?.current_period_end ?? null;
  }
  return refusalFor(box, context, periodEnd);
}

/** Réponse 409 d'un refus : `{ error, code }`. */
export function entryRefusalResponse(r: EntryRefusal) {
  return NextResponse.json({ error: r.message, code: r.code }, { status: 409 });
}

/** La garde en une ligne dans une route : `const refus = await refuseClosedBox(…); if (refus) return refus;` */
export async function refuseClosedBox(supabase: Reader, boxId: string, context: EntryContext) {
  const r = await boxEntryRefusal(supabase, boxId, context);
  return r ? entryRefusalResponse(r) : null;
}

/**
 * Routes anonymes (essais) : sans clé serveur, la box fermée est invisible ;
 * c'est la RPC de la PR 1 qui refuse (`{ ok: false, reason: 'box_archivee' |
 * 'box_archivage_programme', message }`). On la rend en 409, avec le code.
 */
export function rpcEntryRefusal(result: unknown) {
  const r = result as { ok?: boolean; reason?: string; message?: string } | null;
  if (!r || r.ok !== false) return null;
  const code = r.reason === 'box_archivee' ? 'BOX_ARCHIVEE' : r.reason === 'box_archivage_programme' ? 'BOX_ARCHIVAGE_PROGRAMME' : null;
  if (!code) return null;
  return NextResponse.json(
    { ok: false, reason: r.reason, code, error: r.message || entryRefusalMessage(code, 'essai') },
    { status: 409 },
  );
}
