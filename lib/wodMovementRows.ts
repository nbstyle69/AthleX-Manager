import {
  MovementUnit,
  defaultUnitFor,
  findCatalogMovement,
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
  /**
   * Texte d'origine de la ligne, réécrit tel quel tant que la ligne n'est pas
   * modifiée : `parseMovementRow` ne relit pas tout (notes entre parenthèses,
   * texte après « @ »), une ligne intacte ne doit rien perdre.
   */
  raw?: string;
  /** Ligne hors catalogue : éditée en texte libre, `raw` est sa valeur. */
  free?: boolean;
}

export const EMPTY_MOVEMENT_ROW: MovementRow = {
  reps: null, repsWomen: null, unit: 'reps', name: '', weightKg: null, weightKgWomen: null,
};

/**
 * Type de champ d'une ligne, décidé une fois, à l'ouverture de l'éditeur :
 * - champs structurés (quantité, unité, exercice avec suggestions, charges)
 *   si la ligne est vide, n'est qu'une quantité, ou si l'exercice lu est
 *   reconnu dans le catalogue ;
 * - sinon, texte libre sur plusieurs lignes à l'écran (lignes écrites par la
 *   programmation automatique, consignes, notes).
 * Une ligne ne change jamais de type pendant la saisie : une ligne du
 * catalogue garde ses suggestions même si son nom est modifié, une ligne
 * libre reste libre. La règle ne s'applique à nouveau qu'à la réouverture.
 */
export function isStructuredMovementLine(line: string): boolean {
  if (line.trim() === '') return true;
  const name = parseMovementRow(line).name;
  return name === '' || !!findCatalogMovement(name);
}

export function movementRowsFromLines(lines: string[]): MovementRow[] {
  return lines.map(l => (isStructuredMovementLine(l)
    ? { ...parseMovementRow(l), raw: l }
    : { ...EMPTY_MOVEMENT_ROW, name: l, raw: l, free: true }));
}

export function movementRowShowsWeight(row: MovementRow): boolean {
  return row.weightKg != null || row.weightKgWomen != null || isWeightedMovement(row.name);
}

/** Le select m · cal et la quantité ♀ n'apparaissent que pour un exercice cardio. */
export function movementRowShowsUnit(row: MovementRow): boolean {
  return row.unit !== 'reps' || isCardioMovement(row.name);
}

export function serializeMovementRow(row: MovementRow): string {
  // Ligne libre, ou ligne structurée que l'utilisateur n'a pas touchée.
  if (row.raw !== undefined) return row.raw;
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
    // Ligne libre : seul son texte change, et il reste tel quel.
    if (row.free) return { ...row, raw: patch.raw ?? row.raw, name: patch.raw ?? row.name };
    // Ligne structurée modifiée : elle est réécrite depuis ses champs.
    const next = { ...row, ...patch, raw: undefined };
    if (patch.name !== undefined && patch.unit === undefined) {
      const wasDefault = row.unit === defaultUnitFor(row.name);
      // Une unité que la nouvelle machine ne permet pas (un Row en mètres
      // renommé Echo Bike, qui ne se mesure qu'en calories) n'est pas gardée.
      const allowed = findCatalogMovement(next.name)?.unitsAllowed;
      const notAllowed = !!allowed && !allowed.includes(next.unit);
      if (wasDefault || notAllowed || !isCardioMovement(next.name)) next.unit = defaultUnitFor(next.name);
    }
    if (next.unit === 'reps') next.repsWomen = null;
    return next;
  });
}
