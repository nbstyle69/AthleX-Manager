// ── Catalogue de mouvements ─────────────────────────────────────────────
// Façade synchrone sur `lib/movementCatalog.ts` (Supabase `movement_catalog`,
// snapshot embarqué en repli). `weighted` = charge externe ; `unit` = quantité
// par défaut d'une ligne (reps, sauf machines cardio en `m` / `cal`).
import {
  MOVEMENT_CATALOG_SNAPSHOT,
  catalogMovementFromRow,
  findCatalogMovement,
  type CatalogMovement,
  type MovementUnit,
} from '@/lib/movementCatalog';

export type { CatalogMovement, MovementUnit } from '@/lib/movementCatalog';
export { getMovementCatalog, findCatalogMovement } from '@/lib/movementCatalog';

/**
 * Snapshot embarqué (109 lignes, inactifs compris). Pour la liste vivante
 * (Supabase), utiliser `useMovementCatalog()` côté client ou
 * `getMovementCatalog()` après `loadMovementCatalog()`.
 */
export const MOVEMENT_CATALOG: readonly CatalogMovement[] = MOVEMENT_CATALOG_SNAPSHOT.map(catalogMovementFromRow);

export function isWeightedMovement(name: string): boolean {
  return findCatalogMovement(name)?.weighted ?? false;
}

/** Un mouvement dont la quantité se mesure en mètres ou calories. */
export function isCardioMovement(name: string): boolean {
  const u = findCatalogMovement(name)?.unit;
  return u === 'm' || u === 'cal';
}

/** Unité par défaut du catalogue ; `reps` pour tout mouvement inconnu. */
export function defaultUnitFor(name: string): MovementUnit {
  return findCatalogMovement(name)?.unit ?? 'reps';
}

export const CARDIO_UNITS: { value: Exclude<MovementUnit, 'reps'>; label: string }[] = [
  { value: 'm', label: 'm' },
  { value: 'cal', label: 'cal' },
  { value: 's', label: 's' },
];

function unitFromToken(tok: string): Exclude<MovementUnit, 'reps'> {
  const t = tok.toLowerCase();
  if (t === 'm') return 'm';
  if (t.startsWith('s')) return 's';
  return 'cal';
}

// Serialize a structured movement row into a parseable line.
// reps + name (+ optional men/women loads). Une quantité cardio porte son unité
// et un éventuel split ♂/♀, même convention que les kg.
//   { reps: 21, name: 'Thruster', weightKg: 43 }                  -> "21 Thruster (43 kg)"
//   { reps: 21, name: 'Thruster', weightKg: 43, weightKgW: 30 }   -> "21 Thruster (43/30 kg)"
//   { reps: 12, name: 'Pull-ups' }                                -> "12 Pull-ups"
//   { reps: 20, name: 'Row', unit: 'cal', repsWomen: 15 }         -> "20/15 cal Row"
//   { reps: 500, name: 'Run', unit: 'm' }                         -> "500 m Run"
//   { reps: 30, name: 'Plank Hold', unit: 's' }                   -> "30 s Plank Hold"
export function serializeMovement(
  reps: number,
  name: string,
  weightKg?: number | null,
  weightKgWomen?: number | null,
  unit: MovementUnit = 'reps',
  repsWomen?: number | null,
): string {
  const women = repsWomen != null && repsWomen > 0 && repsWomen !== reps ? `/${repsWomen}` : '';
  const qty = unit === 'reps' ? `${reps}${women}` : `${reps}${women} ${unit}`;
  const base = `${qty} ${name.trim()}`.trim();
  const menKg = weightKg != null && weightKg > 0 ? weightKg : null;
  const womenKg = weightKgWomen != null && weightKgWomen > 0 ? weightKgWomen : null;
  if (menKg != null && womenKg != null) return `${base} (${menKg}/${womenKg} kg)`;
  if (menKg != null) return `${base} (${menKg} kg)`;
  if (womenKg != null) return `${base} (${womenKg} kg)`;
  return base;
}

export interface ParsedMovementRow {
  /** Quantité ♂ (ou unique) dans `unit`. */
  reps: number | null;
  name: string;
  weightKg: number | null;
  weightKgWomen: number | null;
  unit: MovementUnit;
  /** Quantité ♀ d'un split `20/15` ; `null` = même valeur pour tous. */
  repsWomen: number | null;
}

// Parse a stored movement line back into structured parts (best-effort, tolerant
// of legacy free-text like "7 reps — Sumo Deadlift High Pull @ 42.5/30 kg").
// A "men/women" pair ("43/30 kg") splits into weightKg (men) + weightKgWomen (women).
// Cardio lines carry their unit ("20 cal Row", "20/15 cal Row", "500 m Run",
// "400m Course") ; a bare number is reps, except on a catalogue cardio movement
// where it takes the catalogue default unit ("20 Row" → 20 cal, "800 Run" → 800 m).
// A hold carries seconds ("30 s Plank Hold", "30 sec Plank Hold"). A height in
// parentheses ("(60/50 cm)") is not a load and is dropped like any other note.
export function parseMovementRow(line: string): ParsedMovementRow {
  let s = (line ?? '').trim();
  // weight: "(43 kg)" / "(43/30 kg)" or "@ 43kg" / "@ 42.5/30 kg"
  let weightKg: number | null = null;
  let weightKgWomen: number | null = null;
  const num = String.raw`\d+(?:\.\d+)?`;
  const wParen = s.match(new RegExp(String.raw`\((${num})(?:\s*\/\s*(${num}))?\s*kg\)`, 'i'));
  const wAt = s.match(new RegExp(String.raw`@\s*(${num})(?:\s*\/\s*(${num}))?`, 'i'));
  const w = wParen ?? wAt;
  if (w) {
    weightKg = parseFloat(w[1]);
    if (w[2] != null) weightKgWomen = parseFloat(w[2]);
  }
  s = s.replace(/\((?:[^)]*)\)/g, '').replace(/@.*$/, '').trim();
  const cardio = s.match(/^(\d+)(?:\s*\/\s*(\d+))?\s*(m|cals?|kcal|s|secs?)\b\.?\s+(.+)$/i);
  if (cardio) {
    return {
      reps: parseInt(cardio[1], 10),
      repsWomen: cardio[2] != null ? parseInt(cardio[2], 10) : null,
      unit: unitFromToken(cardio[3]),
      name: cardio[4].trim(),
      weightKg, weightKgWomen,
    };
  }
  // leading reps, tolerating a "reps"/"rep"/"x" word and a "—"/"-" separator
  const m = s.match(/^(\d+)(?:\s*\/\s*(\d+))?\s*(?:reps?|x)?\s*[—\-:]?\s*(.+)$/i);
  if (m) {
    const name = m[3].trim();
    return {
      reps: parseInt(m[1], 10),
      repsWomen: m[2] != null ? parseInt(m[2], 10) : null,
      unit: defaultUnitFor(name),
      name,
      weightKg, weightKgWomen,
    };
  }
  return { reps: null, repsWomen: null, unit: 'reps', name: s, weightKg, weightKgWomen };
}

// ── AMRAP / Max Reps score helpers ────────────────────────────────────────
// Score for these WODs is normalized to a TOTAL rep count so ranking + auto-
// decide stay coherent whether the athlete entered "rounds + reps" or a raw
// total. reps_per_round converts between the two representations.

// Sum of leading rep counts across the movement lines (one full round).
// Returns 0 when no rep-based movement is found.
export function repsPerRoundFromMovements(movements: string[] | null | undefined): number {
  if (!Array.isArray(movements)) return 0;
  return movements.reduce((acc, line) => {
    const { reps } = parseMovementRow(line);
    return acc + (reps ?? 0);
  }, 0);
}

export function amrapTotalToRoundsReps(
  total: number,
  repsPerRound: number,
): { rounds: number; reps: number } {
  if (!repsPerRound || repsPerRound <= 0) return { rounds: 0, reps: total };
  return { rounds: Math.floor(total / repsPerRound), reps: total % repsPerRound };
}

export function roundsRepsToTotal(
  rounds: number,
  reps: number,
  repsPerRound: number,
): number {
  return Math.max(0, Math.round(rounds)) * Math.max(0, repsPerRound) + Math.max(0, Math.round(reps));
}

// "123 reps (3 tours + 12)" — or just "123 reps" when reps_per_round is unknown.
export function formatAmrapScore(
  total: number,
  repsPerRound: number | null | undefined,
): string {
  const repsLabel = `${total} reps`;
  if (!repsPerRound || repsPerRound <= 0) return repsLabel;
  const { rounds, reps } = amrapTotalToRoundsReps(total, repsPerRound);
  return `${repsLabel} (${rounds} tour${rounds > 1 ? 's' : ''}${reps > 0 ? ` + ${reps}` : ''})`;
}

// WOD types whose score is a total rep count.
export function isRepsScoredType(type: string | null | undefined): boolean {
  const t = (type ?? '').toLowerCase();
  return t === 'amrap' || t === 'max reps';
}
