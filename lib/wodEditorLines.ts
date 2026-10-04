import {
  EMPTY_STRENGTH_ENTRY, StrengthEntry, StrengthLoadUnit, parseStrengthLine, serializeStrength, splitStrengthLines,
} from '@/lib/strengthBlock';
import { gymPrLabel } from '@/lib/gymMovements';
import { CardioEntry, parseCardioLine, serializeCardio, splitCardioLines } from '@/lib/cardioBlock';
import { MovementRow, serializeMovementRows } from '@/lib/wodMovementRows';

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
  return gymPrLabel(row.name) || row.pctOfMax != null ? ['kg', '%1RM', 'pctOfMax'] : ['kg', '%1RM'];
}

/** Erreur à afficher sous le sélecteur ; tant qu'elle existe, l'enregistrement est bloqué. */
export function strengthRowError(row: StrengthEntry): string | null {
  return row.pctOfMax != null && row.name.trim() !== '' && !gymPrLabel(row.name) ? PCT_OF_MAX_ONLY_GYM : null;
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
