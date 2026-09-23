import { findCatalogMovement, parseMovementRow } from '@/lib/movements';

/**
 * `tournament_wods.movement_lines` : la description structurée d'un WOD de
 * tournoi, dans l'ordre de ses lignes. La validation d'un score la lit pour
 * créditer les cumuls de mouvement de l'athlète (migration
 * `20270102000000_credit_tournois_serveur` d'athlex-app) ; sans elle, rien
 * n'est crédité. La base refuse (23514) un id inconnu du catalogue, une autre
 * unité, une quantité non entière ou nulle.
 *
 * Règle : n'y entre que ce que la ligne prouve sans interprétation. Une ligne
 * douteuse est exclue — elle reste dans la description affichée — plutôt que
 * créditée de travers.
 */
export interface MovementLine {
  /** `movement_catalog.id`. */
  movement: string;
  unit: 'reps' | 'm' | 'cal';
  qty_male: number;
  /** Absente : même quantité pour tous. */
  qty_female?: number;
}

const CREDITED_UNITS = new Set(['reps', 'm', 'cal']);

/** Quantité en tête de ligne, décimales comprises (« 1.5 km », « 12,5 cal »). */
const QTY = String.raw`(\d+(?:[.,]\d+)?)`;
/** Ligne en kilomètres, que le parseur de l'éditeur ne connaît pas. */
const KM_LINE = new RegExp(String.raw`^${QTY}(?:\s*\/\s*${QTY})?\s*km\b\.?\s+(?:[—\-:]\s*)?(.+)$`, 'i');
/** Une quantité décimale hors km : jamais arrondie, la ligne est exclue. */
const DECIMAL_QTY = new RegExp(String.raw`^\d+[.,]\d+|^\d+\s*\/\s*\d+[.,]\d+`);

const toNumber = (s: string) => Number(s.replace(',', '.'));

/** Retire charges et notes, comme `parseMovementRow` : « (43/30 kg) », « @ 42.5 kg ». */
function stripNotes(line: string): string {
  return line.replace(/\((?:[^)]*)\)/g, '').replace(/@.*$/, '').trim();
}

/** Entier strictement positif, ou `null` (décimal, nul, négatif, absent). */
function positiveInt(n: number | null | undefined): number | null {
  return n != null && Number.isInteger(n) && n > 0 ? n : null;
}

interface Quantity { name: string; unit: string; male: number | null; female: number | null }

function readQuantity(line: string): Quantity | null {
  const s = stripNotes(line);
  const km = s.match(KM_LINE);
  if (km) {
    // 1,5 km donne 1 500 m : la conversion est exacte, ce n'est pas un arrondi.
    // Un résultat non entier (0,0005 km) est écarté plus bas.
    const toMeters = (q: string) => Math.round(toNumber(q) * 1000 * 1e6) / 1e6;
    return { name: km[3].trim(), unit: 'm', male: toMeters(km[1]), female: km[2] != null ? toMeters(km[2]) : null };
  }
  if (DECIMAL_QTY.test(s)) return null;
  // Tout le reste passe par le parseur de l'éditeur : ce qui est crédité est
  // exactement ce que le gérant voit dans ses lignes.
  const row = parseMovementRow(line);
  if (row.reps == null) return null;
  return { name: row.name, unit: row.unit, male: row.reps, female: row.repsWomen };
}

/**
 * Construit `movement_lines` à partir des lignes de l'éditeur.
 *
 * Exclues : ligne sans mouvement du catalogue (texte libre, en-tête « 5 rounds
 * for time »), sans quantité, en durée (`s`), dans une unité que le mouvement
 * ne permet pas, ou dont une quantité n'est pas un entier strictement positif.
 *
 * @returns `null` quand aucune ligne n'est exploitable — jamais un tableau vide.
 */
export function buildMovementLines(lines: readonly string[]): MovementLine[] | null {
  const out: MovementLine[] = [];
  for (const raw of lines) {
    const q = readQuantity(raw ?? '');
    if (!q) continue;
    const mv = findCatalogMovement(q.name);
    if (!mv?.id) continue;
    if (!CREDITED_UNITS.has(q.unit)) continue;
    const allowed = mv.unitsAllowed ?? [mv.unit ?? 'reps'];
    if (!allowed.includes(q.unit as MovementLine['unit'])) continue;
    const male = positiveInt(q.male);
    if (male == null) continue;
    let female: number | null = null;
    if (q.female != null) {
      female = positiveInt(q.female);
      if (female == null) continue;
    }
    out.push({
      movement: mv.id,
      unit: q.unit as MovementLine['unit'],
      qty_male: male,
      ...(female != null ? { qty_female: female } : {}),
    });
  }
  return out.length > 0 ? out : null;
}

/**
 * Champ « Nombre de tours » d'un For Time : vide donne `null` (la base le lit
 * comme un seul tour) ; sinon un entier ≥ 1, enregistré tel quel. Tout autre
 * contenu est refusé plutôt qu'arrondi : `ok: false`.
 */
export function parseForTimeRounds(input: string): { ok: true; value: number | null } | { ok: false } {
  const s = input.trim();
  if (s === '') return { ok: true, value: null };
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 ? { ok: true, value: n } : { ok: false };
}

/**
 * Tours d'un For Time produit par le générateur, qui les écrit dans une ligne
 * de texte (« 5 rounds for time »). Sert à préremplir le champ à la
 * génération ; rien n'est déduit du texte à l'enregistrement.
 */
export function generatedForTimeRounds(lines: readonly string[]): string {
  for (const l of lines) {
    const m = l.match(/^\s*(\d+)\s+rounds?\s+for\s+time\b/i);
    if (m) return m[1];
  }
  return '';
}
