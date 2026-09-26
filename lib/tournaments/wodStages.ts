import { tournamentRefusal } from '@/lib/tournaments/refusals';

/**
 * Étapes d'un tournoi à tableau (athlex-app #386) : la base les rend dans
 * l'ordre, avec leurs libellés (`tournament_bracket_stages`). Une étape est un
 * tableau (`bracket_board`) et, pour les gagnants et les perdants, un numéro
 * (`bracket_stage`) : la clé `tableau:numéro` les garde ensemble dans une liste.
 * Chaque match créé reçoit le WOD prévu pour son étape : c'est la base qui le pose.
 */

export interface StageRow { ordre: number; bracket_board: string; bracket_stage: number | null; label_fr: string }
export interface StageOption { value: string; label: string }

export const DUPLICATE_STAGE = 'Un WOD est déjà prévu pour cette étape.';
export const STAGES_UNAVAILABLE = 'L’étape du tournoi ne peut pas être choisie pour l’instant. Le WOD s’enregistre sans changer son étape.';

export function stageKey(board: string | null | undefined, stage: number | null | undefined): string {
  return board ? `${board}:${stage ?? ''}` : '';
}

/** Les deux colonnes à écrire ; « Toutes les étapes » (clé vide) les remet à null. */
export function parseStageKey(key: string): { bracket_board: string | null; bracket_stage: number | null } {
  if (!key) return { bracket_board: null, bracket_stage: null };
  const [board, stage] = key.split(':');
  return { bracket_board: board, bracket_stage: stage === '' ? null : Number(stage) };
}

export function stageOptions(rows: StageRow[]): StageOption[] {
  return [...rows].sort((a, b) => a.ordre - b.ordre).map(r => ({ value: stageKey(r.bracket_board, r.bracket_stage), label: r.label_fr }));
}

/** Libellé de l'étape d'un WOD ; null s'il n'en a pas. */
export function wodStageLabel(wod: { bracket_board?: string | null; bracket_stage?: number | null }, labels: Record<string, string>): string | null {
  const key = stageKey(wod.bracket_board, wod.bracket_stage);
  return key ? labels[key] ?? 'Étape prévue' : null;
}

/** Refus à l'enregistrement d'un WOD : le doublon d'étape (23505) en clair, le reste traduit. */
export function wodSaveError(err: { message?: string | null; code?: string | null }): string {
  return err.code === '23505' ? DUPLICATE_STAGE : tournamentRefusal(err.message, err.code);
}
