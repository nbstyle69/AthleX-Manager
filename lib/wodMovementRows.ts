import {
  MovementUnit,
  defaultUnitFor,
  isCardioMovement,
  isWeightedMovement,
  parseMovementRow,
  serializeMovement,
} from '@/lib/movements';

/**
 * Ligne de mouvement du metcon telle que l'éditeur la manipule : structurée,
 * jamais re-parsée depuis sa sérialisation entre deux frappes. Une ligne
 * « 12 » seule (reps saisies avant le nom) ne peut pas survivre à un
 * aller-retour `serializeMovement` → `parseMovementRow` (elle se relit
 * reps 1 / nom « 2 ») : l'état structuré est la source de vérité, la chaîne
 * n'est produite qu'à l'écriture dans `movements`.
 *
 * `reps` est la quantité ♂ (ou unique) dans `unit` ; `repsWomen` la quantité ♀
 * d'un split cardio (`20/15 cal Row`), même convention que les kg.
 */
export interface MovementRow {
  reps: number | null;
  repsWomen: number | null;
  unit: MovementUnit;
  name: string;
  weightKg: number | null;
  weightKgWomen: number | null;
}

export const EMPTY_MOVEMENT_ROW: MovementRow = {
  reps: null, repsWomen: null, unit: 'reps', name: '', weightKg: null, weightKgWomen: null,
};

export function movementRowsFromLines(lines: string[]): MovementRow[] {
  return lines.map(l => parseMovementRow(l));
}

export function movementRowShowsWeight(row: MovementRow): boolean {
  return row.weightKg != null || row.weightKgWomen != null || isWeightedMovement(row.name);
}

/** Le select m · cal et la quantité ♀ n'apparaissent que pour un exercice cardio. */
export function movementRowShowsUnit(row: MovementRow): boolean {
  return row.unit !== 'reps' || isCardioMovement(row.name);
}

export function serializeMovementRow(row: MovementRow): string {
  const showWeight = movementRowShowsWeight(row);
  const w = showWeight ? row.weightKg : null;
  const wW = showWeight ? row.weightKgWomen : null;
  const unit = movementRowShowsUnit(row) ? row.unit : 'reps';
  const rW = movementRowShowsUnit(row) ? row.repsWomen : null;
  if (row.reps == null) return serializeMovement(0, row.name, w, wW, unit, null).replace(/^0\s*(?:m|cal)?\s*/, '').trim();
  return serializeMovement(row.reps, row.name, w, wW, unit, rW);
}

export function serializeMovementRows(rows: MovementRow[]): string[] {
  return rows.map(serializeMovementRow);
}

/**
 * Ne modifie que la ligne `index`, et uniquement les champs du `patch`.
 * Changer d'exercice réaligne l'unité sur celle du catalogue (un Row passe en
 * cal, un Thruster revient en reps) tant que le coach ne l'a pas choisie lui-même.
 */
export function updateMovementRow(rows: MovementRow[], index: number, patch: Partial<MovementRow>): MovementRow[] {
  return rows.map((row, i) => {
    if (i !== index) return row;
    const next = { ...row, ...patch };
    if (patch.name !== undefined && patch.unit === undefined) {
      const wasDefault = row.unit === defaultUnitFor(row.name);
      if (wasDefault || !isCardioMovement(next.name)) next.unit = defaultUnitFor(next.name);
    }
    if (next.unit === 'reps') next.repsWomen = null;
    return next;
  });
}
