// Lecture des données de force d'un athlète, côté staff. Ces helpers sont purs :
// les deux lectures elles-mêmes passent par des RPC `SECURITY DEFINER`
// (`get_athlete_private_profile`, `list_athlete_strength_sets`), jamais par une
// lecture directe des colonnes privées ni de `strength_set_logs`.

import { GYM_PR_MOVEMENTS } from '@/lib/gymMovements';
import { countOf } from '@/lib/plural';

export interface StrengthSet {
  id: string;
  source_type: string;
  source_id: string;
  source_title: string | null;
  movement: string;
  movement_label: string | null;
  set_index: number;
  reps: number;
  load_kg: number | null;
  prescribed_reps: number | null;
  prescribed_load_kg: number | null;
  performed_at: string;
  /** Série ajoutée par l'athlète depuis sa grille (sans reps prévues). */
  is_added?: boolean;
}

export interface Record1RM {
  movement: string;
  value: string;
  date: string | null;
  /** `strength_set_logs.id` de la série qui a établi ce record, si connue. */
  sourceId: string | null;
}

export interface StrengthSession {
  key: string;
  title: string;
  sourceType: string;
  performedAt: string;
  sets: StrengthSet[];
}

/** Record de gymnastique : un nombre de reps, pas une charge. */
export interface GymRecord {
  movement: string;
  reps: number;
  date: string | null;
  /** `strength_set_logs.id` de la série qui l'a établi ; absent = saisi à la main. */
  sourceId: string | null;
}

const PR_PREFIXES = ['weightlifting_', 'Haltérophilie_'];

/**
 * Records d'haltérophilie lisibles depuis `personal_records`.
 *
 * Les clés `_date` et `_src` accompagnent une valeur, elles n'en sont pas une :
 * les traiter comme des charges afficherait un uuid en kilos.
 */
export function readWeightliftingRecords(
  records: Record<string, unknown> | null,
): Record1RM[] {
  if (!records) return [];
  const out: Record1RM[] = [];
  for (const [key, raw] of Object.entries(records)) {
    if (key.endsWith('_date') || key.endsWith('_src')) continue;
    const prefix = PR_PREFIXES.find(p => key.startsWith(p));
    if (!prefix) continue;
    if (typeof raw !== 'string' && typeof raw !== 'number') continue;
    const movement = key.slice(prefix.length);
    const date = records[`${key}_date`];
    const src = records[`${key}_src`];
    out.push({
      movement,
      value: String(raw),
      // Date prête à afficher : « 2026-09-12 » (écrite par le serveur) → « 12/09/2026 ».
      date: typeof date === 'string' ? recordDate(date) : null,
      sourceId: typeof src === 'string' ? src : null,
    });
  }
  return out.sort((a, b) => a.movement.localeCompare(b.movement));
}

/** Regroupe les séries par séance/bloc (jour + source), la plus récente d'abord. */
export function groupStrengthSessions(sets: StrengthSet[]): StrengthSession[] {
  const map = new Map<string, StrengthSession>();
  for (const s of sets) {
    const day = s.performed_at.slice(0, 10);
    const key = `${day}|${s.source_type}|${s.source_id}`;
    const existing = map.get(key);
    if (existing) {
      existing.sets.push(s);
      if (s.performed_at > existing.performedAt) existing.performedAt = s.performed_at;
      continue;
    }
    map.set(key, {
      key,
      title: s.source_title ?? 'Séance sans titre',
      sourceType: s.source_type,
      performedAt: s.performed_at,
      sets: [s],
    });
  }
  return [...map.values()].sort((a, b) => b.performedAt.localeCompare(a.performedAt));
}

/**
 * Records de gymnastique de `personal_records`, lus comme l'app
 * (`readPr` / `readPrDate` de prStorage.ts, athlex-app) : pour chacun des 11
 * libellés, la clé `gymnastics_<Libellé>` puis la clé historique
 * `Gymnastics_<Libellé>` ; valeur texte ou nombre (comme `normalizePrRecords`),
 * gardée si c'est au moins 1 rep (comme `gymRecordForMovement`). La date et la
 * provenance suivent la clé de la valeur. Ordre de la page Records de l'app.
 */
export function readGymRecords(records: Record<string, unknown> | null): GymRecord[] {
  if (!records) return [];
  const out: GymRecord[] = [];
  for (const movement of GYM_PR_MOVEMENTS) {
    const key = [`gymnastics_${movement}`, `Gymnastics_${movement}`].find(k => records[k] !== undefined);
    if (!key) continue;
    const raw = records[key];
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN;
    if (!Number.isFinite(n) || n < 1) continue;
    const date = records[`${key}_date`];
    const src = records[`${key}_src`];
    out.push({
      movement,
      reps: Math.floor(n),
      date: typeof date === 'string' ? date : null,
      sourceId: typeof src === 'string' && src !== '' ? src : null,
    });
  }
  return out;
}

/** « 2026-10-05 » (date écrite par le serveur) → « 05/10/2026 » ; une autre forme reste telle quelle. */
export function recordDate(date: string): string {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : date;
}

/** Une série sans charge (gymnastique) se compte en reps. */
export function isUnloaded(set: StrengthSet): boolean {
  return set.load_kg == null;
}

/** « 3 reps », « 1 rep » sans charge ; « 5 × 100 kg » avec, comme avant. */
export function setPerformance(set: StrengthSet): string {
  return isUnloaded(set) ? repsLabel(set.reps) : `${set.reps} × ${set.load_kg} kg`;
}

export const repsLabel = (n: number) => countOf(n, 'rep', 'reps');

export interface MovementBlock {
  key: string;
  label: string;
  sets: StrengthSet[];
  /** Somme des reps des séries sans charge du mouvement ; `null` s'il n'en a aucune. */
  unloadedTotal: number | null;
}

/**
 * Séries d'une séance regroupées par mouvement (ordre de première apparition,
 * séries par numéro), avec le total des séries sans charge de chaque mouvement
 * et de la séance (`null` = aucune série sans charge : pas de ligne de total).
 */
export function sessionBlocks(sets: StrengthSet[]): { blocks: MovementBlock[]; unloadedTotal: number | null } {
  const map = new Map<string, MovementBlock>();
  for (const s of sets) {
    const block = map.get(s.movement) ?? { key: s.movement, label: s.movement_label ?? s.movement, sets: [], unloadedTotal: null };
    block.sets.push(s);
    if (isUnloaded(s)) block.unloadedTotal = (block.unloadedTotal ?? 0) + s.reps;
    map.set(s.movement, block);
  }
  const blocks = [...map.values()];
  for (const b of blocks) b.sets.sort((a, c) => a.set_index - c.set_index);
  const totals = blocks.map(b => b.unloadedTotal).filter((t): t is number => t != null);
  return { blocks, unloadedTotal: totals.length ? totals.reduce((a, b) => a + b, 0) : null };
}
