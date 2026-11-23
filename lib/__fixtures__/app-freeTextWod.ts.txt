/**
 * Lecture d'un WOD en texte libre (box_wods.text_mode = 'free', #453) pour le
 * crédit des badges. Même règle que l'aperçu « Ce que l'app comprend » du
 * Manager : cas partagés dans src/__tests__/fixtures/free-text-wod-contract.json
 * (repris à l'identique par le Manager, comme le contrat de format #419).
 *
 * - chaque ligne est découpée sur « + » ;
 * - « @43/29 » = charges ♂ / ♀ ; « 15/12 cal » = quantités ♂ / ♀ ;
 * - nom de la liste du texte libre (catalogue + FREE_TEXT_EXTRA_MOVEMENTS),
 *   casse, tirets et pluriel ignorés (« thrusters », « toes to bar ») ; ou
 *   écriture de MOVEMENT_MAP qui désigne UN seul nom de cette liste (« T2B » →
 *   Toes-to-Bar, « ski » → SkiErg), ou abréviation de FREE_TEXT_ABBREVIATIONS
 *   (« STOH » → Shoulder to Overhead) ; sinon le morceau est « à corriger » (aucune
 *   devinette : « pow clean », ou « jerk » qui vaut six noms, restent à corriger) ;
 * - lignes de format, repos, time cap et objectif ignorées.
 * Blocs Musculation et Cardio (#453 PR 3b, aligné sur le Manager #456) : la
 * suite continue de lignes EN TÊTE reconnues par parseStrengthLine (charge,
 * % 1RM, % du max de gymnastique) ou parseCardioLine est extraite (`blocks`)
 * et traitée comme dans un WOD en lignes. Dès la première ligne qui n'a pas ce
 * format (ligne vide comprise), tout le reste est du texte libre, même une
 * série plus loin ; la lecture metcon ne porte que sur ce reste (`rest`), où
 * une ligne au format d'une série (complexe compris, #454) est entière à corriger.
 */
import { MovementEntry, MovementUnit } from '../services/gamification';
import { AthleteGender, isFormatHeaderLine, parseMovementLine } from './movementParser';
import { CatalogMovement, MOVEMENT_CATALOG } from './movementsCatalog';
import { cleanMovementName, mappedMovementKey, normalizeMovement } from './tournamentUtils';
import { parseStrengthLine } from './strengthBlock';
import { parseCardioLine } from './cardioBlock';

export interface FreeTextMovement {
  /** Morceau de ligne lu, tel qu'écrit. */
  segment: string;
  /** Nom du catalogue. */
  name: string;
  unit: MovementUnit;
  reps: { male: number; female: number };
  loadKg: { male: number; female: number } | null;
}

export interface FreeTextReading {
  /** Lignes de bloc Musculation / Cardio en tête, dans l'ordre, sans espaces de bord. */
  blocks: string[];
  /** Le texte après ces lignes, retours à la ligne gardés, sans lignes vides de bord. */
  rest: string;
  recognized: FreeTextMovement[];
  /** Morceaux qui ressemblent à un mouvement mais ne se lisent pas (nom hors catalogue, quantité absente). */
  toFix: string[];
  /** Lignes de format, repos, time cap, objectif. */
  ignored: string[];
}

const REST = /\b(?:rest|repos|récup(?:ération)?)\b/i;
const TIME_CAP = /^(?:tc|time\s*cap|cap)\b/i;
const OBJECTIVE = /^(?:rx\+?|scaled|objectif|obj\.?|goal|target)\s*:/i;

export function isIgnoredFreeTextLine(line: string): boolean {
  return isFormatHeaderLine(line) || REST.test(line) || TIME_CAP.test(line) || OBJECTIVE.test(line);
}

/**
 * Mouvements lus en texte libre en plus du catalogue (décision A, #453 PR 3c).
 * Propres au texte libre : MOVEMENT_CATALOG, donc l'éditeur du back-office, ne
 * change pas. Clé de badge via normalizeMovement (MOVEMENT_MAP).
 */
export const FREE_TEXT_EXTRA_MOVEMENTS: CatalogMovement[] = [
  { name: 'Snatch', weighted: true },
  { name: 'Clean', weighted: true },
  { name: 'Shoulder to Overhead', weighted: true },
  { name: 'DB Lunge', weighted: true },
  { name: 'DB Overhead Lunge', weighted: true },
  { name: 'KB Snatch', weighted: true },
  { name: 'KB Deadlift', weighted: true },
  { name: 'KB Front Squat', weighted: true },
  { name: 'KB Lunge', weighted: true },
  { name: 'KB Overhead Lunge', weighted: true },
];

/** La liste du texte libre : le catalogue, puis les mouvements propres au texte libre. */
export const FREE_TEXT_MOVEMENTS: readonly CatalogMovement[] = [...MOVEMENT_CATALOG, ...FREE_TEXT_EXTRA_MOVEMENTS];

/**
 * Abréviations vers UN nom de la liste, quand leur clé en désigne plusieurs
 * (press : Push Press, Push Jerk, Power Jerk, Split Jerk, Back Rack Split Jerk,
 * Shoulder to Overhead). Clés = écriture nettoyée (cleanMovementName). Les
 * autres abréviations (t2b, c2b, du, bmu, rmu, ohs, hspu) se résolvent déjà
 * vers un seul nom par MOVEMENT_MAP.
 */
export const FREE_TEXT_ABBREVIATIONS: Readonly<Record<string, string>> = {
  stoh: 'Shoulder to Overhead',
  s2oh: 'Shoulder to Overhead',
};

/**
 * Nom de la liste du texte libre pour une écriture, ou null.
 * (a) même nom, casse, tirets et pluriel ignorés ;
 * puis une abréviation de FREE_TEXT_ABBREVIATIONS ;
 * (b) sinon, écriture de MOVEMENT_MAP dont la clé ne désigne qu'un seul nom de
 *     la liste. Plusieurs noms (« hang clean » → clean : Power Clean, Squat
 *     Clean, Tall Clean, Clean) : à corriger.
 */
export function catalogName(raw: string): string | null {
  const n = cleanMovementName(raw);
  if (!n) return null;
  const same = FREE_TEXT_MOVEMENTS.find(m => cleanMovementName(m.name) === n);
  if (same) return same.name;
  const abbreviation = FREE_TEXT_ABBREVIATIONS[n];
  if (abbreviation) return abbreviation;
  const key = mappedMovementKey(raw);
  if (!key) return null;
  const hits = FREE_TEXT_MOVEMENTS.filter(m => normalizeMovement(m.name).key === key);
  return hits.length === 1 ? hits[0].name : null;
}

function readSegment(segment: string): FreeTextMovement | null {
  const male = parseMovementLine(segment, { gender: 'male' });
  const female = parseMovementLine(segment, { gender: 'female' });
  if (!male || !female) return null;
  const name = catalogName(male.name);
  if (!name) return null;
  return {
    segment,
    name,
    unit: male.unit ?? 'reps',
    reps: { male: male.reps, female: female.reps },
    loadKg: male.weight_kg != null ? { male: male.weight_kg, female: female.weight_kg ?? male.weight_kg } : null,
  };
}

export function isBlockLine(line: string): boolean {
  return parseStrengthLine(line) !== null || parseCardioLine(line) !== null;
}

export function readFreeText(text: string | null | undefined): FreeTextReading {
  const lines = (text ?? '').split('\n');
  const first = lines.findIndex(l => !isBlockLine(l));
  const head = first < 0 ? lines.length : first;
  const kept = lines.slice(head);
  const out: FreeTextReading = {
    blocks: lines.slice(0, head).map(l => l.trim()),
    rest: kept.join('\n').replace(/^\s*\n/, '').trimEnd(),
    recognized: [], toFix: [], ignored: [],
  };
  for (const raw of kept) {
    const line = raw.trim();
    if (!line) continue;
    // Série écrite après le texte (Musculation, Cardio, complexe #454) : non lue,
    // entière à corriger, avant tout découpage sur « + » (comme l'aperçu du Manager).
    if (isBlockLine(line)) { out.toFix.push(line); continue; }
    if (isIgnoredFreeTextLine(line)) { out.ignored.push(line); continue; }
    for (const part of line.split('+')) {
      const segment = part.trim();
      if (!segment) continue;
      const m = readSegment(segment);
      if (m) out.recognized.push(m); else out.toFix.push(segment);
    }
  }
  return out;
}

/**
 * Reps créditées : seulement quand le score prouve la séance terminée (un
 * temps, pas arrêté au cap). Jamais plus que ce que le score prouve : un score
 * en reps, tours + reps, charge, capé ou « faite » ne crédite rien.
 */
export function creditFreeText(
  text: string | null | undefined,
  proof: { scoreType: string; capped: boolean },
  gender?: AthleteGender | null,
): MovementEntry[] {
  if (proof.scoreType !== 'time' || proof.capped) return [];
  const g = gender === 'female' ? 'female' : 'male';
  return readFreeText(text).recognized.map(m => {
    const load = m.loadKg?.[g];
    return {
      name: m.name,
      reps: m.reps[g],
      ...(m.unit !== 'reps' ? { unit: m.unit } : {}),
      ...(load != null ? { weight_kg: load } : {}),
    };
  });
}
