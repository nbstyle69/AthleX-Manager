import type { InfoRequest } from '@/lib/confirmDialog';

/**
 * Refus d'entrée d'une box fermée, côté écran (archivage, PR 3).
 *
 * Les routes gardées par #390 répondent `{ error, code }` avec `BOX_ARCHIVEE`
 * ou `BOX_ARCHIVAGE_PROGRAMME` ; les routes d'essai rendent aussi la raison de
 * la RPC (`reason: 'box_archivee' | 'box_archivage_programme'`). L'écran montre
 * alors le message de la base dans une boîte d'information, au lieu d'une
 * erreur générique.
 */

export type EntryRefusalCode = 'BOX_ARCHIVEE' | 'BOX_ARCHIVAGE_PROGRAMME';

export const ENTRY_REFUSAL_TITLE: Record<EntryRefusalCode, string> = {
  BOX_ARCHIVEE: 'Box archivée',
  BOX_ARCHIVAGE_PROGRAMME: 'Archivage programmé',
};

const FROM_REASON: Record<string, EntryRefusalCode> = {
  box_archivee: 'BOX_ARCHIVEE',
  box_archivage_programme: 'BOX_ARCHIVAGE_PROGRAMME',
};

/** Le refus porté par une réponse de route, ou `null`. */
export function entryRefusalFrom(data: unknown): { code: EntryRefusalCode; message: string } | null {
  const d = (data ?? {}) as { code?: unknown; reason?: unknown; error?: unknown; message?: unknown };
  const code = d.code === 'BOX_ARCHIVEE' || d.code === 'BOX_ARCHIVAGE_PROGRAMME'
    ? d.code
    : typeof d.reason === 'string' ? FROM_REASON[d.reason] ?? null : null;
  if (!code) return null;
  const message = typeof d.error === 'string' && d.error ? d.error
    : typeof d.message === 'string' && d.message ? d.message
    : "Cette box n'accepte plus de nouvel abonnement ni d'achat.";
  return { code, message };
}

/** La boîte d'information à ouvrir pour ce refus. */
export function entryRefusalInfo(r: { code: EntryRefusalCode; message: string }): InfoRequest {
  return { kind: 'info', title: ENTRY_REFUSAL_TITLE[r.code], body: r.message };
}
