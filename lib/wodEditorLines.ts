import { StrengthEntry, parseStrengthLine, serializeStrength, splitStrengthLines } from '@/lib/strengthBlock';
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

/** Lignes de la séance écrites dans `movements` : musculation, cardio, puis metcon (ordre inchangé). */
export function composeMovements(wod: MovementRow[], strength: StrengthRow[], cardio: CardioRow[]): string[] {
  return [
    ...strength.map(serializeStrengthRow).filter(Boolean),
    ...cardio.map(serializeCardioRow).filter(Boolean),
    ...serializeMovementRows(wod),
  ];
}
