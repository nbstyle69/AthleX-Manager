// ── Type de score d'un WOD de box, choisi par le créateur (#453) ───────────
// `box_wods.score_type` : NULL = l'athlète choisit (WOD d'avant #453), sinon
// time | rounds_reps | reps | weight | none. La base garde la cohérence des
// scores (trigger `trg_wod_scores_type_du_wod`, 'none' ↔ 'done') et interdit
// un classement sans score (CHECK). `box_programming_wods` n'a pas ces
// colonnes : l'éditeur Marketplace ne propose pas le champ.

export type ScoreType = 'time' | 'rounds_reps' | 'reps' | 'weight' | 'none';

export const SCORE_TYPES: { value: ScoreType; label: string; help: string; hint: string }[] = [
  { value: 'time', label: 'Temps', help: 'Temps final (mm:ss). Au time cap, l’athlète saisit ses reps.', hint: 'Au time cap, l’athlète saisit ses reps.' },
  { value: 'rounds_reps', label: 'Tours + reps', help: 'Tours complets + reps du tour en cours.', hint: 'L’athlète saisit ses tours complets et les reps du tour en cours.' },
  { value: 'reps', label: 'Reps totales', help: 'Total de reps de la séance.', hint: 'L’athlète saisit le total de reps de la séance.' },
  { value: 'weight', label: 'Charge (kg)', help: 'Meilleure charge soulevée.', hint: 'L’athlète saisit sa meilleure charge.' },
  { value: 'none', label: 'Sans score', help: 'Séance seulement marquée faite, sans classement.', hint: 'Les athlètes marquent la séance comme faite : pas de score, pas de classement.' },
];

export const SCORE_TYPE_LABEL: Record<ScoreType, string> =
  Object.fromEntries(SCORE_TYPES.map(s => [s.value, s.label])) as Record<ScoreType, string>;

export const SCORE_PROPOSAL_NOTE =
  'Valeur proposée selon le Type : For Time → Temps · AMRAP → Tours + reps · EMOM, Tabata → Reps totales · Force → Charge (kg). Tu peux la changer.';

export const SCORE_UNDEFINED_NOTE = 'Non défini : les athlètes choisissent.';

export const MARKETPLACE_SCORE_NOTE =
  'Le type de score et le texte libre ne sont pas encore disponibles pour une offre Marketplace.';

export function isScoreType(v: unknown): v is ScoreType {
  return SCORE_TYPES.some(s => s.value === v);
}

/** Valeur proposée selon le Type du WOD ; '' quand aucun type n'en suggère. */
export function proposedScoreType(wodType: string | null | undefined): ScoreType | '' {
  switch (wodType) {
    case 'for-time': return 'time';
    case 'amrap': return 'rounds_reps';
    case 'emom':
    case 'tabata': return 'reps';
    case 'strength': return 'weight';
    default: return '';
  }
}

/** Type de score d'une ligne `wod_scores` → type de WOD compatible ('rounds' : ancien format, aucun). */
const SCORE_TO_WOD: Record<string, ScoreType> = {
  time: 'time', rounds_reps: 'rounds_reps', reps: 'reps', weight: 'weight', done: 'none',
};

export interface ScoreLock {
  /** `null` = tout est permis (aucun score). Sinon les seuls types possibles (vide = verrouillé). */
  allowed: ScoreType[] | null;
  reason: string | null;
}

export const SCORE_FREE: ScoreLock = { allowed: null, reason: null };

/**
 * Types permis au vu des scores déjà posés sur le WOD : jamais un type
 * incompatible avec un score existant. Un seul type de score → ce type seul ;
 * plusieurs types, ou l'ancien format « rounds » → verrouillé.
 */
export function scoreLockFor(existing: readonly (string | null)[]): ScoreLock {
  if (existing.length === 0) return SCORE_FREE;
  const kinds = [...new Set(existing.map(t => t ?? ''))];
  const n = existing.length;
  const des = n === 1 ? 'Un score existe déjà' : `${n} scores existent déjà`;
  if (kinds.length > 1) {
    return { allowed: [], reason: `${des} dans des types différents : le score ne peut plus changer.` };
  }
  const target = SCORE_TO_WOD[kinds[0]];
  if (!target) {
    return { allowed: [], reason: `${des} dans un ancien format : le score ne peut plus changer.` };
  }
  return { allowed: [target], reason: `${des} en « ${SCORE_TYPE_LABEL[target]} » : seul ce type reste possible.` };
}

export function scoreTypeAllowed(lock: ScoreLock, t: ScoreType): boolean {
  return lock.allowed === null || lock.allowed.includes(t);
}

/** Affichage d'un score de WOD de box. */
export function formatBoxWodScore(value: number, type: string | null | undefined): string {
  if (type === 'done') return 'Faite';
  if (type === 'time') {
    const m = Math.floor(value / 60);
    const s = Math.round(value % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  if (type === 'rounds_reps') return `${Math.floor(value / 1000)} + ${value % 1000}`;
  return `${value}`;
}

export interface SortableScore { score_value: number; score_type: string | null }

/**
 * Ordre d'affichage des scores d'un WOD : selon le type choisi par le créateur
 * (temps croissant, sinon décroissant) ; WOD sans type : croissant, comme
 * avant. Une séance « Faite » n'est jamais classée : en fin de liste.
 */
export function sortWodScores<T extends SortableScore>(scores: readonly T[], wodScoreType: string | null | undefined): T[] {
  const asc = wodScoreType == null || wodScoreType === 'time';
  const ranked = scores.filter(s => s.score_type !== 'done')
    .sort((a, b) => (asc ? a.score_value - b.score_value : b.score_value - a.score_value));
  return [...ranked, ...scores.filter(s => s.score_type === 'done')];
}

/** Tri par WOD d'une liste de scores de plusieurs WODs (ordre des WODs conservé). */
export function sortScoresByWod<T extends SortableScore & { wod_id: string }>(
  scores: readonly T[], wods: readonly { id: string; score_type?: string | null }[],
): T[] {
  const byWod = new Map<string, T[]>();
  for (const s of scores) byWod.set(s.wod_id, [...(byWod.get(s.wod_id) ?? []), s]);
  return wods.flatMap(w => sortWodScores(byWod.get(w.id) ?? [], w.score_type ?? null));
}

/** Colonnes de score propres à `box_wods` (absentes de `box_programming_wods`). */
export interface BoxWodScoreColumns {
  score_type: ScoreType | null;
  leaderboard_enabled: boolean;
}

/** « Sans score » ⇒ classement coupé, quoi que dise l'interrupteur (CHECK en base). */
export function boxWodScoreColumns(scoreType: ScoreType | '', leaderboard: boolean): BoxWodScoreColumns {
  return {
    score_type: scoreType || null,
    leaderboard_enabled: scoreType === 'none' ? false : leaderboard,
  };
}

export const SCORE_LOCK_UNREADABLE: ScoreLock = {
  allowed: [],
  reason: 'Les scores de ce WOD n’ont pas pu être lus : le score ne peut pas changer.',
};

/** Verrou du Score d'un WOD existant, lu sur ses scores (gérant et coach lisent wod_scores de leur box). */
export async function loadScoreLock(
  supabase: { from: (t: 'wod_scores') => any },
  wodId: string,
): Promise<ScoreLock> {
  const { data, error } = await supabase.from('wod_scores').select('score_type').eq('wod_id', wodId);
  if (error) return SCORE_LOCK_UNREADABLE;
  return scoreLockFor(((data ?? []) as { score_type: string | null }[]).map(r => r.score_type));
}

/** Filtre PostgREST : tout score sauf « Faite » (score_type NULL compris, que `neq` exclurait). */
export const NOT_DONE = 'score_type.is.null,score_type.neq.done';
