/**
 * Bloc cardio : séries × quantité (m ou cal) × cible, sérialisé dans `description`.
 *
 * Écrit « nom d'abord » avec `~` pour séparateur, jamais `—` : une ligne de force
 * (`Back Squat — 5 × 3 @ 80 %1RM`) et une série cardio ne peuvent pas être
 * confondues, et aucune des deux ne commence par un chiffre, donc
 * `parseMovementLine` rend `null` sur l'une comme sur l'autre.
 *
 *   Row ~ 2 × 500 m ~ 250 W ~ repos 2:00
 *   SkiErg ~ 4 × 20 cal ~ RPE 6
 *   Run ~ 3 × 800 m ~ 4:00/km ~ repos 2:00
 *
 * Contrairement au bloc de force, un bloc cardio EST crédité par l'app :
 * `séries × qté` dans l'unité de la ligne, sur le mouvement.
 * Miroir de `src/utils/cardioBlock.ts` côté app.
 */

export type CardioUnit = 'm' | 'cal';
export type PaceRef = '500 m' | 'km';

export interface CardioPace {
  /** `mm:ss` tel qu'écrit par le coach. */
  mmss: string;
  per: PaceRef;
}

export interface CardioEntry {
  name: string;
  sets: number;
  quantity: number;
  unit: CardioUnit;
  /** Cible d'intensité : watts OU allure, jamais les deux. */
  watts: number | null;
  pace: CardioPace | null;
  restSec: number | null;
  rpe: string | null;
}

export const EMPTY_CARDIO_ENTRY: CardioEntry = {
  name: '', sets: 1, quantity: 500, unit: 'm', watts: null, pace: null, restSec: null, rpe: null,
};

const SEP = ' ~ ';

/** Un bloc cardio ne doit jamais commencer par un chiffre ni contenir le séparateur. */
function sanitizeName(name: string): string {
  return name.replace(/^[\d\s×x.,:~—–-]+/, '').replace(/\s*~\s*/g, ' ').trim();
}

function formatRest(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function parseRest(text: string): number | null {
  const raw = text.trim().toLowerCase().replace(/\s/g, '');
  const mmss = raw.match(/^(\d+):(\d{1,2})$/);
  if (mmss) return parseInt(mmss[1], 10) * 60 + parseInt(mmss[2], 10);
  const sec = raw.match(/^(\d+)s?$/);
  if (sec) return parseInt(sec[1], 10);
  return null;
}

function parseUnit(raw: string): CardioUnit {
  return raw.toLowerCase() === 'm' ? 'm' : 'cal';
}

export function serializeCardio(e: CardioEntry): string {
  const name = sanitizeName(e.name);
  if (!name) return '';
  const sets = Math.max(1, Math.round(e.sets));
  const qty = Math.max(1, Math.round(e.quantity));
  let out = `${name}${SEP}${sets} × ${qty} ${e.unit}`;
  if (e.watts != null && e.watts > 0) out += `${SEP}${Math.round(e.watts)} W`;
  else if (e.pace && /^\d+:\d{2}$/.test(e.pace.mmss.trim())) out += `${SEP}${e.pace.mmss.trim()}/${e.pace.per}`;
  if (e.restSec != null && e.restSec > 0) out += `${SEP}repos ${formatRest(e.restSec)}`;
  const rpe = (e.rpe ?? '').trim();
  if (rpe) out += `${SEP}RPE ${rpe}`;
  return out;
}

export function parseCardioLine(line: string): CardioEntry | null {
  const raw = (line ?? '').trim();
  if (!raw || /^\d/.test(raw)) return null;    // « quantité d'abord » = ligne metcon
  const parts = raw.split(/\s+~\s+/);
  if (parts.length < 2) return null;
  const name = parts[0].trim();
  if (!name) return null;

  const m = parts[1].match(/^(\d+)\s*[x×]\s*(\d+)\s*(m|cals?|kcal)$/i);
  if (!m) return null;

  let watts: number | null = null;
  let pace: CardioPace | null = null;
  let restSec: number | null = null;
  let rpe: string | null = null;
  for (const tail of parts.slice(2)) {
    const w = tail.match(/^(\d+)\s*W$/i);
    if (w) { watts = parseInt(w[1], 10); continue; }
    const p = tail.match(/^(\d+:\d{2})\s*\/\s*(500\s*m|km)$/i);
    if (p) { pace = { mmss: p[1], per: p[2].toLowerCase().startsWith('km') ? 'km' : '500 m' }; continue; }
    const rest = tail.match(/^repos\s+(.+)$/i);
    if (rest) { restSec = parseRest(rest[1]); continue; }
    const r = tail.match(/^RPE\s+(.+)$/i);
    if (r) rpe = r[1].trim();
  }

  return {
    name,
    sets: parseInt(m[1], 10),
    quantity: parseInt(m[2], 10),
    unit: parseUnit(m[3]),
    watts,
    pace: watts == null ? pace : null,
    restSec,
    rpe,
  };
}

export function isCardioLine(line: string): boolean {
  return parseCardioLine(line) !== null;
}

/** Sépare une description en blocs cardio et autres lignes (metcon, force). */
export function splitCardioLines(lines: string[]): { rest: string[]; cardio: string[] } {
  const rest: string[] = [];
  const cardio: string[] = [];
  for (const l of lines) (isCardioLine(l) ? cardio : rest).push(l);
  return { rest, cardio };
}

/** « 2 × 500 m @ 250 W · repos 2:00 · RPE 6 » pour l'affichage. */
export function formatCardioPrescription(e: CardioEntry): string {
  let out = `${e.sets} × ${e.quantity} ${e.unit}`;
  if (e.watts != null) out += ` @ ${e.watts} W`;
  else if (e.pace) out += ` @ ${e.pace.mmss}/${e.pace.per}`;
  if (e.restSec != null && e.restSec > 0) out += ` · repos ${formatRest(e.restSec)}`;
  if (e.rpe) out += ` · RPE ${e.rpe}`;
  return out;
}
