// ── WOD en texte libre : ce que l'app comprend (#453) ───────────────────────
// Port à l'identique de la lecture de l'app (athlex-app
// `src/utils/freeTextWod.ts` + `parseMovementLine` de `movementParser.ts`) :
// cas partagés dans `lib/__fixtures__/free-text-wod-contract.json`, copie
// octet pour octet de celle de l'app. Toute différence = cette lecture est
// fausse, pas le fichier. Module pur.
//
// - chaque ligne est découpée sur « + » ;
// - « @43/29 » = charges ♂ / ♀ ; « 15/12 cal » = quantités ♂ / ♀ ;
// - nom exact du catalogue DE L'APP (pas celui du Manager), pluriel en « s »
//   toléré ; sinon le morceau est « à corriger » ;
// - lignes de format, repos, time cap et objectif ignorées.
//
// Les suggestions, raisons et regroupements de l'aperçu (`freeTextPreview`)
// sont propres au Manager.
import { DURATION_LINE, isFormatHeaderLine, isPercentLine } from '@/lib/movements';
import { COMPLEX_NAME, isStrengthLine, parseStrengthLine, serializeStrength, type StrengthEntry } from '@/lib/strengthBlock';
import { isCardioLine } from '@/lib/cardioBlock';

export type FreeTextUnit = 'reps' | 'm' | 'cal';

/**
 * Catalogue de l'app (`src/utils/movementsCatalog.ts`, `MOVEMENT_CATALOG`) :
 * seuls ces noms comptent en texte libre. Copie vérifiée contre
 * `lib/__fixtures__/app-movementsCatalog.ts.txt` (copie octet pour octet du
 * fichier de l'app).
 */
export const APP_MOVEMENT_CATALOG: readonly { name: string; unit?: FreeTextUnit }[] = [
  { name: 'Thruster' },
  { name: 'Power Clean' },
  { name: 'Power Snatch' },
  { name: 'Clean & Jerk' },
  { name: 'Deadlift' },
  { name: 'Front Squat' },
  { name: 'Back Squat' },
  { name: 'Overhead Squat' },
  { name: 'Push Press' },
  { name: 'Push Jerk' },
  { name: 'Sumo Deadlift High Pull' },
  { name: 'Squat Snatch' },
  { name: 'Squat Clean' },
  { name: 'Squat Clean & Jerk' },
  { name: 'Cluster' },
  { name: 'Alt DB Snatch' },
  { name: 'DB Thruster' },
  { name: 'Devils Press' },
  { name: 'DB Deadlift' },
  { name: 'DB Clean & Jerk' },
  { name: 'DB Push Press' },
  { name: 'KB Swing' },
  { name: 'Goblet Squat' },
  { name: 'KB Clean' },
  { name: 'Wall Balls' },
  { name: 'Snatch Balance', unit: 'reps' },
  { name: 'Snatch High Pull', unit: 'reps' },
  { name: 'Clean Pull', unit: 'reps' },
  { name: 'Tall Clean', unit: 'reps' },
  { name: 'Power Jerk', unit: 'reps' },
  { name: 'Split Jerk', unit: 'reps' },
  { name: 'Back Rack Split Jerk', unit: 'reps' },
  { name: 'Strict Press', unit: 'reps' },
  { name: 'DB Strict Press', unit: 'reps' },
  { name: 'Bench Press', unit: 'reps' },
  { name: 'Zercher Squat', unit: 'reps' },
  { name: 'Pull-ups' },
  { name: 'Toes-to-Bar' },
  { name: 'Chest-to-Bar' },
  { name: 'Bar Muscle-ups' },
  { name: 'Handstand Push-ups' },
  { name: 'Ring Dips' },
  { name: 'Ring Muscle-ups' },
  { name: 'Rope Climbs' },
  { name: 'Pistols' },
  { name: 'Handstand Walk' },
  { name: 'Wall Walk', unit: 'reps' },
  { name: 'Box Jump-overs' },
  { name: 'Box Jumps' },
  { name: 'Box Step-ups' },
  { name: 'Burpees Over the Bar' },
  { name: 'Burpees' },
  { name: 'Push-ups' },
  { name: 'Sit-ups' },
  { name: 'Air Squats' },
  { name: 'Row', unit: 'cal' },
  { name: 'Bike Erg', unit: 'cal' },
  { name: 'Echo Bike', unit: 'cal' },
  { name: 'SkiErg', unit: 'cal' },
  { name: 'Run', unit: 'm' },
  { name: 'Double-unders' },
  { name: 'Lunges' },
  { name: 'V-ups' },
  { name: 'Hollow Rocks' },
];

export type Gender = 'male' | 'female';

export interface ParsedMovement { name: string; reps: number; unit?: FreeTextUnit; weight_kg?: number }

function catalogEntry(raw: string): { name: string; unit?: FreeTextUnit } | null {
  const n = raw.trim().toLowerCase();
  return APP_MOVEMENT_CATALOG.find(m => {
    const c = m.name.toLowerCase();
    return n === c || n === `${c}s`;
  }) ?? null;
}

/** Nom exact du catalogue de l'app (casse ignorée), ou son pluriel en « s ». */
export function catalogName(raw: string): string | null {
  return catalogEntry(raw)?.name ?? null;
}

/**
 * `defaultUnitFor` de l'app, réduit à ce qu'il rend pour un nom que
 * `catalogName` accepte (les seuls qui sortent de cette lecture) : l'unité du
 * catalogue, ou reps. Le repli de l'app par clé normalisée (`rows` → row → cal)
 * donne la même unité que l'entrée du catalogue pour ces noms.
 */
function defaultUnitFor(name: string): FreeTextUnit {
  return catalogEntry(name)?.unit ?? 'reps';
}

function pickQuantity(men: string, women: string | undefined, gender?: Gender | null): number {
  const m = parseInt(men, 10);
  if (gender === 'female' && women != null) return parseInt(women, 10);
  return m;
}

function normalizeUnit(raw: string): FreeTextUnit {
  return raw.toLowerCase() === 'm' ? 'm' : 'cal';
}

/** `parseMovementLine` de l'app (lignes de mouvement, ♂ par défaut). */
export function parseMovementLine(line: string, gender?: Gender | null): ParsedMovement | null {
  const trimmed = line.trim();
  if (!trimmed || isFormatHeaderLine(trimmed) || isPercentLine(trimmed)) return null;
  if (DURATION_LINE.test(trimmed)) return null;

  const cardioMatch = trimmed.match(/^(\d+)(?:\s*\/\s*(\d+))?\s*(m|cals?|kcal)\b\.?\s+(.+)$/i);
  if (cardioMatch) {
    const reps = pickQuantity(cardioMatch[1], cardioMatch[2], gender);
    const name = cardioMatch[4].replace(/\s*\([^)]*\)/g, '').replace(/\s*@.*$/, '').trim();
    if (isNaN(reps) || reps <= 0 || !name) return null;
    return { name, reps, unit: normalizeUnit(cardioMatch[3]) };
  }

  const kmMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)(?:\s*\/\s*(\d+(?:[.,]\d+)?))?\s*km\b\.?\s+(.+)$/i);
  if (kmMatch) {
    const km = gender === 'female' && kmMatch[2] != null ? kmMatch[2] : kmMatch[1];
    const reps = Math.round(parseFloat(km.replace(',', '.')) * 1000);
    const name = kmMatch[3].replace(/\s*\([^)]*\)/g, '').replace(/\s*@.*$/, '').trim();
    if (!(reps > 0) || !name) return null;
    return { name, reps, unit: 'm' };
  }

  const stdMatch = trimmed.match(/^(\d+)(?:\s*\/\s*(\d+))?\s*(?:reps?|x)?\s*[—–\-:]?\s*(.+)/i);
  if (stdMatch) {
    const reps = pickQuantity(stdMatch[1], stdMatch[2], gender);
    let rest = stdMatch[3];
    let weight_kg: number | undefined;
    const weightParen = rest.match(/\((\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?\s*kg\)/i);
    const weightAt = rest.match(/@\s*(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?\s*(cm\b)?/);
    const w = weightParen ?? (weightAt && !weightAt[3] ? weightAt : null);
    if (w) weight_kg = parseFloat(gender === 'female' && w[2] != null ? w[2] : w[1]);
    rest = rest.replace(/\s*\([^)]*\)/g, '').replace(/\s*@.*$/, '').trim();
    if (isNaN(reps) || reps <= 0 || !rest) return null;
    const unit = defaultUnitFor(rest);
    return unit === 'reps' ? { name: rest, reps, weight_kg } : { name: rest, reps, unit };
  }
  return null;
}

export interface FreeTextMovement {
  segment: string;
  name: string;
  unit: FreeTextUnit;
  reps: { male: number; female: number };
  loadKg: { male: number; female: number } | null;
}

export interface FreeTextReading {
  /** Lignes de bloc Musculation / Cardio en tête, dans l'ordre, sans espaces de bord. */
  blocks: string[];
  /** Le texte après ces lignes, retours à la ligne gardés, sans lignes vides de bord. */
  rest: string;
  recognized: FreeTextMovement[];
  toFix: string[];
  ignored: string[];
}

const REST = /\b(?:rest|repos|récup(?:ération)?)\b/i;
const TIME_CAP = /^(?:tc|time\s*cap|cap)\b/i;
const OBJECTIVE = /^(?:rx\+?|scaled|objectif|obj\.?|goal|target)\s*:/i;

export function isIgnoredFreeTextLine(line: string): boolean {
  return isFormatHeaderLine(line) || REST.test(line) || TIME_CAP.test(line) || OBJECTIVE.test(line);
}

function readSegment(segment: string): FreeTextMovement | null {
  const male = parseMovementLine(segment, 'male');
  const female = parseMovementLine(segment, 'female');
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

/** Ligne du bloc Musculation (charge, % 1RM, % du max) ou série Cardio (« ~ »). */
export function isBlockLine(line: string): boolean {
  return isStrengthLine(line) || isCardioLine(line);
}

/**
 * `readFreeText` de l'app (PR 3b) : la suite continue de lignes de bloc EN
 * TÊTE est extraite (`blocks`) ; dès la première autre ligne (ligne vide
 * comprise), tout le reste est du texte (`rest`), seul lu comme metcon ; une
 * ligne de ce reste au format d'une série (complexe compris) est entière à corriger.
 */
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
    // entière à corriger, avant tout découpage sur « + » (miroir de l'app, #621).
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

// ── Aperçu « Ce que l'app comprend » (propre au Manager) ─────────────────────

export type IgnoredReason = 'format' | 'repos' | 'time cap' | 'objectif';

/** Raison affichée d'une ligne non comptée (même tri que `isIgnoredFreeTextLine`). */
export function ignoredReason(line: string): IgnoredReason {
  if (REST.test(line)) return 'repos';
  if (TIME_CAP.test(line) || /^(?:time\s*cap|cap)\b/i.test(line)) return 'time cap';
  if (OBJECTIVE.test(line)) return 'objectif';
  return 'format';
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}

/**
 * Nom du catalogue de l'app proche d'un nom écrit : même lettres au pluriel ou
 * à la ponctuation près (« pull-up » → Pull-ups), début du nom (« ski » →
 * SkiErg), ou faute de frappe (2 lettres au plus).
 */
export function nearCatalogName(raw: string): string | null {
  const n = norm(raw);
  if (n.length < 3) return null;
  let best: { name: string; score: number } | null = null;
  for (const m of APP_MOVEMENT_CATALOG) {
    const c = norm(m.name);
    let score: number | null = null;
    if (c === n || c === `${n}s` || `${c}s` === n) score = 0;
    else if (c.startsWith(n) || n.startsWith(c)) score = 1 + Math.abs(c.length - n.length) / 100;
    else { const d = distance(n, c); if (d <= 2) score = 2 + d; }
    if (score != null && (!best || score < best.score)) best = { name: m.name, score };
  }
  return best?.name ?? null;
}

function quantity(male: number, female: number, unit: FreeTextUnit): string {
  const q = male === female ? `${male}` : `${male} / ${female}`;
  if (unit !== 'reps') return `${q} ${unit}`;
  return `${q} ${male === 1 && female === 1 ? 'rep' : 'reps'}`;
}

/** « Thruster · 21 reps · ♂ 43 / ♀ 29 kg » */
export function recognizedLabel(m: FreeTextMovement): string {
  const parts = [m.name, quantity(m.reps.male, m.reps.female, m.unit)];
  if (m.loadKg) parts.push(`♂ ${m.loadKg.male} / ♀ ${m.loadKg.female} kg`);
  return parts.join(' · ');
}

// ── « Transformer en bloc Musculation » (#454) ───────────────────────────────

/** Ligne du texte qui peut devenir une carte du bloc Musculation. */
export interface StrengthCandidate {
  /** Ligne telle qu'écrite (sans espaces de bord), retirée du texte à la transformation. */
  line: string;
  /** Carte du bloc ; `raw` = la ligne au format exact, gardée telle quelle. */
  entry: StrengthEntry & { raw?: string };
  /** « Complexe · 1 Deadlift + 1 Power Clean · 5 × 1 @ 75 %1RM Power Clean » */
  label: string;
  /** « @80% » sans « 1RM » : lu comme un %1RM, à vérifier. */
  guessedPct: boolean;
}

/** Nom du catalogue officiel du Manager (casse, ponctuation, pluriel ignorés), sinon tel qu'écrit. */
function officialName(raw: string, catalog: readonly string[]): string {
  const n = norm(raw);
  return catalog.find(c => { const k = norm(c); return k === n || `${k}s` === n || k === `${n}s`; }) ?? raw.trim();
}

const LOAD = String.raw`@\s*(\d+(?:[.,]\d+)?)\s*(kg|%\s*1\s*rm|%)`;
/** « Back squat 5×3 @80% », « Pull-ups 4 x 8 » (nom d'abord, sans séparateur). */
const LOOSE_SET = new RegExp(String.raw`^([A-Za-zÀ-ÿ][^@×()]*?)\s+(\d+)\s*[x×]\s*(\d+)(?:\s*${LOAD})?$`, 'i');
/** « 5 × (1 deadlift + 1 power clean) @75% power clean » */
const LOOSE_COMPLEX = new RegExp(String.raw`^(\d+)\s*[x×]\s*\(([^()]+)\)(?:\s*${LOAD}\s*(.*))?$`, 'i');

function loadOf(num: string | undefined, unit: string | undefined): { load: number | null; unit: 'kg' | '%1RM'; guessed: boolean } {
  if (num == null) return { load: null, unit: 'kg', guessed: false };
  const kg = /^kg$/i.test(unit ?? '');
  return { load: parseFloat(num.replace(',', '.')), unit: kg ? 'kg' : '%1RM', guessed: !kg && !/rm/i.test(unit ?? '') };
}

/**
 * Ligne de musculation ou de complexe écrite sous une forme connue :
 * - le format exact du bloc (`parseStrengthLine`, complexe compris), repris tel quel ;
 * - « Nom S×R [@ charge kg|%|%1RM] » ;
 * - « S × (r mouvement + r mouvement…) [@ charge kg|%|%1RM [référence]] » (deux
 *   mouvements au moins ; référence absente = le dernier, hors du complexe = refusée).
 * Noms ramenés au catalogue officiel quand ils y sont. Toute autre ligne : `null`.
 */
export function strengthCandidate(rawLine: string, catalog: readonly string[] = []): StrengthCandidate | null {
  const line = rawLine.trim();
  const label = (e: StrengthEntry) => serializeStrength(e).split(' — ').join(' · ');
  const exact = parseStrengthLine(line);
  if (exact) return { line, entry: { ...exact, raw: line }, label: label(exact), guessedPct: false };

  const s = line.match(LOOSE_SET);
  if (s) {
    const l = loadOf(s[4], s[5]);
    const entry: StrengthEntry = {
      name: officialName(s[1], catalog), sets: parseInt(s[2], 10), reps: parseInt(s[3], 10),
      load: l.load, unit: l.unit, restSec: null, tempo: null, loadNote: null,
    };
    if (entry.sets < 1 || entry.reps < 1) return null;
    return { line, entry, label: label(entry), guessedPct: l.guessed };
  }

  const c = line.match(LOOSE_COMPLEX);
  if (!c) return null;
  const movements: { reps: number; name: string }[] = [];
  for (const part of c[2].split('+')) {
    const mv = part.trim().match(/^(\d+)\s+(\D.*)$/);
    if (!mv || parseInt(mv[1], 10) < 1) return null;
    movements.push({ reps: parseInt(mv[1], 10), name: officialName(mv[2], catalog) });
  }
  if (movements.length < 2 || parseInt(c[1], 10) < 1) return null;
  const l = loadOf(c[3], c[4]);
  const wanted = (c[5] ?? '').trim();
  if (wanted && l.unit === 'kg') return null;
  const ref = l.load == null || l.unit === 'kg' ? null
    : wanted ? movements.find(m => norm(m.name) === norm(officialName(wanted, catalog))) : movements[movements.length - 1];
  if (l.load != null && l.unit === '%1RM' && !ref) return null;    // référence hors du complexe
  const entry: StrengthEntry = {
    name: COMPLEX_NAME, sets: parseInt(c[1], 10), reps: 1, load: l.load, unit: l.unit,
    restSec: null, tempo: null, loadNote: null, complex: { movements, refName: ref?.name ?? null },
  };
  return { line, entry, label: label(entry), guessedPct: l.guessed };
}

/** Texte sans la ligne transformée (première occurrence, espaces de bord ignorés). */
export function freeTextWithout(text: string, line: string): string {
  const lines = text.split('\n');
  const i = lines.findIndex(l => l.trim() === line);
  return i < 0 ? text : [...lines.slice(0, i), ...lines.slice(i + 1)].join('\n');
}

export type PreviewItem = { ok: true; text: string } | { ok: false; text: string };
export interface PreviewGroup { line: string | null; items: PreviewItem[]; candidate?: StrengthCandidate }
export interface FreeTextPreview {
  /** Séries de tête, lues par l'app comme ses blocs (PR 3b) : séance guidée / badges cardio. */
  strength: string[];
  cardio: string[];
  groups: PreviewGroup[];
  ignored: { text: string; reason: IgnoredReason; count: number }[];
  okCount: number;
  fixCount: number;
  /** Lignes de musculation ou de complexe repérées plus loin, à transformer. */
  candidateCount: number;
}

/**
 * Aperçu de la description telle qu'elle sera enregistrée (`freeDescription`),
 * lue comme l'app (`readFreeText`) : les blocs en tête vont dans leur rubrique
 * (Musculation / Cardio), le reste est lu ligne par ligne. Une série écrite
 * plus loin n'est pas un bloc : « à corriger ». `managerCatalog` : noms du
 * catalogue du Manager — un nom qui n'y figure que là est « pas encore compté
 * par l'app ».
 */
export function freeTextPreview(text: string, managerCatalog: readonly string[] = [], blockLines: readonly string[] = []): FreeTextPreview {
  const out: FreeTextPreview = { strength: [], cardio: [], groups: [], ignored: [], okCount: 0, fixCount: 0, candidateCount: 0 };
  const reading = readFreeText(freeDescription(blockLines, text));
  for (const l of reading.blocks) (isStrengthLine(l) ? out.strength : out.cardio).push(l);
  const mgr = new Set(managerCatalog.map(n => n.toLowerCase()));
  const seen = new Set<string>();
  const ignore = (t: string, reason: IgnoredReason) => {
    const hit = out.ignored.find(i => i.text === t && i.reason === reason);
    if (hit) hit.count += 1; else out.ignored.push({ text: t, reason, count: 1 });
  };
  for (const raw of reading.rest.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    // Musculation ou complexe plus loin (#454) : à corriger tant que non transformé.
    // Une ligne seule au format exact est un bloc pour readFreeText, jamais « ignorée ».
    const candidate = readFreeText(line).ignored.length ? null : strengthCandidate(line, managerCatalog);
    if (candidate) {
      out.groups.push({ line, items: [], candidate });
      out.fixCount += 1;
      out.candidateCount += 1;
      continue;
    }
    if (isBlockLine(line)) {
      out.groups.push({ line: null, items: [{ ok: false, text: `« ${line} » : ${LATE_BLOCK_NOTE}` }] });
      out.fixCount += 1;
      continue;
    }
    const r = readFreeText(line);
    if (r.ignored.length) { ignore(line, ignoredReason(line)); continue; }
    const items: PreviewItem[] = [];
    let i = 0;
    for (const part of line.split('+')) {
      const segment = part.trim();
      if (!segment) continue;
      const m = r.recognized[i]?.segment === segment ? r.recognized[i++] : null;
      if (m) { items.push({ ok: true, text: recognizedLabel(m) }); out.okCount += 1; continue; }
      items.push({ ok: false, text: fixMessage(segment, mgr, seen) });
      out.fixCount += 1;
    }
    out.groups.push({ line: items.length > 1 ? line : null, items });
  }
  return out;
}

/** Règle de lecture des blocs en texte libre, dite dans l'éditeur et l'Aide. */
export const FREE_TEXT_BLOCKS_RULE =
  'Les séries Musculation et Cardio sont lues seulement si elles sont écrites en tête, avant le reste du texte.';

const LATE_BLOCK_NOTE = 'série écrite après le texte, non lue : mets-la en tête, avant le reste du texte';

function fixMessage(segment: string, mgr: Set<string>, seen: Set<string>): string {
  const male = parseMovementLine(segment, 'male');
  const female = parseMovementLine(segment, 'female');
  const name = (male?.name ?? segment).trim();
  const key = name.toLowerCase();
  const first = !seen.has(key);
  seen.add(key);
  if (!male || !female) {
    if (catalogName(name)) return `« ${segment} » : ajoute une quantité pour le compter`;
  }
  if (mgr.has(key) || mgr.has(key.replace(/s$/, ''))) return `« ${name} » : pas encore compté par l’app`;
  const near = nearCatalogName(name);
  const what = male && female ? `compter ${quantity(male.reps, female.reps, male.unit ?? 'reps')}` : 'le compter';
  if (near) {
    return first
      ? `« ${name} » n’est pas dans la liste officielle : écris « ${near} » pour ${what}`
      : `« ${name} » : écris « ${near} » pour ${what}`;
  }
  return `« ${name} » n’est pas dans la liste officielle : non compté`;
}

// ── Description d'un WOD en texte libre ──────────────────────────────────────

/**
 * Description enregistrée en texte libre : les séries de Musculation et de
 * Cardio (lignes structurées) en tête, puis le texte tel quel.
 */
export function freeDescription(blockLines: readonly string[], freeText: string): string | null {
  const blocks = blockLines.map(l => l.trim()).filter(Boolean);
  const parts = freeText.trim() ? [...blocks, freeText] : blocks;
  return parts.length ? parts.join('\n') : null;
}

/** Inverse de `freeDescription`, même découpe que `readFreeText` : blocs de tête d'un côté, texte libre intact de l'autre. */
export function splitFreeDescription(description: string | null): { blockLines: string[]; freeText: string } {
  const lines = (description ?? '').split('\n');
  let i = 0;
  while (i < lines.length && isBlockLine(lines[i])) i++;
  return { blockLines: lines.slice(0, i).map(l => l.trim()), freeText: lines.slice(i).join('\n') };
}
