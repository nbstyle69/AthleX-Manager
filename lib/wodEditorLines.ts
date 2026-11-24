import {
  COMPLEX_NAME, EMPTY_STRENGTH_ENTRY, StrengthEntry, StrengthLoadUnit, complexMovesForWrite, parseStrengthLine,
  serializeStrength, splitStrengthLines,
} from '@/lib/strengthBlock';
import { gymPrLabel } from '@/lib/gymMovements';
import { CardioEntry, parseCardioLine, serializeCardio, splitCardioLines } from '@/lib/cardioBlock';
import { MovementRow, movementRowsFromLines, serializeMovementRows } from '@/lib/wodMovementRows';
import { StrengthCandidate, freeTextWithout } from '@/lib/freeTextWod';

/**
 * Lignes Musculation et Cardio telles que le WodEditor les édite : structurées,
 * avec le texte d'origine (`raw`) tant que l'utilisateur ne les a pas touchées.
 * `parseStrengthLine` et `parseCardioLine` ne relisent pas tout (RPE, %1RM
 * approximatif, parenthèses, « ≈ »…) : une ligne intacte est réécrite telle
 * quelle, même quand une autre ligne de la séance change. Même principe que
 * les lignes du metcon (`lib/wodMovementRows.ts`).
 */
export type StrengthRow = StrengthEntry & { raw?: string };
export type CardioRow = CardioEntry & { raw?: string };

export function strengthRowsFromLines(lines: string[]): StrengthRow[] {
  return splitStrengthLines(lines).strength.flatMap(l => {
    const e = parseStrengthLine(l);
    return e ? [{ ...e, raw: l }] : [];
  });
}

export function cardioRowsFromLines(lines: string[]): CardioRow[] {
  return splitCardioLines(lines).cardio.flatMap(l => {
    const e = parseCardioLine(l);
    return e ? [{ ...e, raw: l }] : [];
  });
}

/** Ligne intacte : texte d'origine. Ligne modifiée : sérialisation, comme avant. */
export function serializeStrengthRow(row: StrengthRow): string {
  return row.raw !== undefined ? row.raw : serializeStrength(row);
}

export function serializeCardioRow(row: CardioRow): string {
  return row.raw !== undefined ? row.raw : serializeCardio(row);
}

/** Ne modifie que la ligne `index` ; elle perd son texte d'origine et sera réécrite depuis ses champs. */
export function updateStrengthRow(rows: StrengthRow[], index: number, patch: Partial<StrengthEntry>): StrengthRow[] {
  return rows.map((e, i) => (i === index ? { ...e, ...patch, raw: undefined } : e));
}

export function updateCardioRow(rows: CardioRow[], index: number, patch: Partial<CardioEntry>): CardioRow[] {
  return rows.map((e, i) => (i === index ? { ...e, ...patch, raw: undefined } : e));
}

/** Unité choisie dans le sélecteur du bloc Musculation. */
export type StrengthUnitChoice = StrengthLoadUnit | 'pctOfMax';

export const STRENGTH_UNIT_LABEL: Record<StrengthUnitChoice, string> = {
  kg: 'kg', '%1RM': '%1RM', pctOfMax: '% du max',
};

/** % proposé au passage en « % du max » (zone « série type de WOD » de l'app). */
const DEFAULT_PCT_OF_MAX = 50;

export const PCT_OF_MAX_ONLY_GYM = '« % du max » ne s’applique qu’aux mouvements de gymnastique.';

export function strengthUnitChoice(row: StrengthEntry): StrengthUnitChoice {
  return row.pctOfMax != null ? 'pctOfMax' : row.unit;
}

/**
 * « % du max » n'est proposé que pour un des 11 mouvements de gymnastique ; il
 * reste affiché (en erreur) quand il est déjà choisi, jamais retiré en silence.
 */
export function strengthUnitChoices(row: StrengthEntry): StrengthUnitChoice[] {
  if (row.complex) return ['kg', '%1RM'];
  return gymPrLabel(row.name) || row.pctOfMax != null ? ['kg', '%1RM', 'pctOfMax'] : ['kg', '%1RM'];
}

export const COMPLEX_TWO_MOVES = 'Un complexe enchaîne au moins deux mouvements : nomme le deuxième.';

/** Erreur à afficher sous le sélecteur ; tant qu'elle existe, l'enregistrement est bloqué. */
export function strengthRowError(row: StrengthEntry): string | null {
  // Un seul mouvement nommé : la ligne ne s'écrirait pas, le complexe serait perdu en silence.
  if (row.complex) return complexMovesForWrite(row.complex).length === 1 ? COMPLEX_TWO_MOVES : null;
  return row.pctOfMax != null && row.name.trim() !== '' && !gymPrLabel(row.name) ? PCT_OF_MAX_ONLY_GYM : null;
}

// ── Complexe (#454) ─────────────────────────────────────────────────────────

/** Nouvelle carte « Complexe » : deux mouvements à nommer, 5 × 1, charge en kg. */
export function emptyComplexEntry(): StrengthEntry {
  return {
    ...EMPTY_STRENGTH_ENTRY, name: COMPLEX_NAME, sets: 5, reps: 1,
    complex: { movements: [{ reps: 1, name: '' }, { reps: 1, name: '' }], refName: null },
  };
}

/** « rep » au singulier, « reps » au-delà. */
export const repsWord = (n: number) => (n > 1 ? 'reps' : 'rep');

/**
 * Mouvement de référence affiché et écrit : celui choisi s'il est encore dans
 * le complexe, sinon le dernier mouvement nommé (même règle que l'écriture).
 */
export function complexRefName(row: StrengthEntry): string | null {
  if (!row.complex) return null;
  const moves = complexMovesForWrite(row.complex);
  if (!moves.length) return null;
  const want = (row.complex.refName ?? '').trim().toLowerCase();
  return (moves.find(m => m.name.toLowerCase() === want) ?? moves[moves.length - 1]).name;
}

/** Modifie le mouvement `j` du complexe de la ligne `index`. */
export function updateComplexMove(rows: StrengthRow[], index: number, j: number, patch: Partial<{ reps: number; name: string }>): StrengthRow[] {
  const c = rows[index]?.complex;
  if (!c) return rows;
  return updateStrengthRow(rows, index, { complex: { ...c, movements: c.movements.map((m, k) => (k === j ? { ...m, ...patch } : m)) } });
}

export function addComplexMove(rows: StrengthRow[], index: number): StrengthRow[] {
  const c = rows[index]?.complex;
  if (!c) return rows;
  return updateStrengthRow(rows, index, { complex: { ...c, movements: [...c.movements, { reps: 1, name: '' }] } });
}

/** Retire le mouvement `j` ; un complexe garde toujours deux lignes de mouvement. */
export function removeComplexMove(rows: StrengthRow[], index: number, j: number): StrengthRow[] {
  const c = rows[index]?.complex;
  if (!c || c.movements.length <= 2) return rows;
  return updateStrengthRow(rows, index, { complex: { ...c, movements: c.movements.filter((_, k) => k !== j) } });
}

export function setComplexRef(rows: StrengthRow[], index: number, refName: string): StrengthRow[] {
  const c = rows[index]?.complex;
  if (!c) return rows;
  return updateStrengthRow(rows, index, { complex: { ...c, refName } });
}

/**
 * Change l'unité de la ligne `index`. Vers « % du max » : les reps et la charge
 * sont gardées de côté (ignorées à l'écriture). Retour vers kg ou %1RM : les
 * reps d'avant, sinon 5 (ligne relue d'un « % du max », reps inconnues).
 */
export function changeStrengthUnit(rows: StrengthRow[], index: number, choice: StrengthUnitChoice): StrengthRow[] {
  const row = rows[index];
  if (!row) return rows;
  if (choice === 'pctOfMax') {
    return updateStrengthRow(rows, index, { pctOfMax: row.pctOfMax ?? DEFAULT_PCT_OF_MAX });
  }
  return updateStrengthRow(rows, index, {
    unit: choice,
    pctOfMax: undefined,
    reps: row.reps > 0 ? row.reps : EMPTY_STRENGTH_ENTRY.reps,
  });
}

/** Lignes de la séance écrites dans `movements` : musculation, cardio, puis metcon (ordre inchangé). */
export function composeMovements(wod: MovementRow[], strength: StrengthRow[], cardio: CardioRow[]): string[] {
  return [
    ...strength.map(serializeStrengthRow).filter(Boolean),
    ...cardio.map(serializeCardioRow).filter(Boolean),
    ...serializeMovementRows(wod),
  ];
}

/**
 * `movements` de l'éditeur : en texte libre (#453), seulement les séries
 * (Musculation, Cardio) — le texte vit à part et s'enregistre après elles.
 */
export function editorMovements(free: boolean, wod: MovementRow[], strength: StrengthRow[], cardio: CardioRow[]): string[] {
  return composeMovements(free ? [] : wod, strength, cardio);
}

/** Mouvements → Texte libre (#453) : les lignes actuelles pré-remplissent le texte. */
export function freeTextFromRows(rows: MovementRow[]): string {
  return composeMovements(rows, [], []).join('\n');
}

/**
 * Texte libre → Mouvements : relu par la logique des lignes. Une ligne non
 * reconnue reste une ligne libre, gardée telle quelle : seules les lignes
 * vides disparaissent.
 */
export function rowsFromFreeText(text: string): MovementRow[] {
  return movementRowsFromLines(text.split('\n').map(l => l.trim()).filter(Boolean));
}

/** État rendu par « Annuler » : texte et cartes d'avant la première transformation (#454). */
export interface TransformUndo { freeText: string; rows: StrengthRow[]; count: number }

/**
 * « Transformer en bloc Musculation » : la ligne quitte le texte et devient la
 * dernière carte du bloc (écrite en tête à l'enregistrement). Les transformations
 * successives s'additionnent ; « Annuler » rend l'état d'avant la première.
 */
export function transformFreeTextLine(
  freeText: string, rows: StrengthRow[], undo: TransformUndo | null, c: StrengthCandidate,
): { freeText: string; rows: StrengthRow[]; undo: TransformUndo } {
  return {
    freeText: freeTextWithout(freeText, c.line),
    rows: [...rows, c.entry],
    undo: { freeText: undo?.freeText ?? freeText, rows: undo?.rows ?? rows, count: (undo?.count ?? 0) + 1 },
  };
}
