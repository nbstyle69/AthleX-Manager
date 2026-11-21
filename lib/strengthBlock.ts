/**
 * Bloc musculation : séries × reps × charge, sérialisé dans `description`.
 *
 * Les mouvements de WOD sont écrits « reps d'abord » (`21 Thruster (43 kg)`) et
 * c'est cette forme que le crédit de badges de l'app parse. Un bloc de force est
 * écrit « nom d'abord » :
 *
 *   Back Squat — 5 × 3 @ 80 %1RM — repos 2:00 — tempo 30X1
 *   Ring Muscle-up — 3 × 15 % du max — repos 1:30   (gymnastique seulement)
 *
 * L'absence de chiffre en tête est ce qui le rend invisible au crédit : les
 * parseurs de l'app déjà installée rendent `null` sur cette ligne, donc un bloc
 * de force n'invente ni reps ni badge et reste lisible sans mise à jour.
 * `serializeStrength` garantit cette propriété (le nom est nettoyé de tout
 * chiffre de tête). Miroir de `src/utils/strengthBlock.ts` côté app.
 */

import { gymPrLabel } from '@/lib/gymMovements';

export type StrengthLoadUnit = 'kg' | '%1RM';

export interface StrengthEntry {
  name: string;
  sets: number;
  reps: number;
  /** Charge prescrite, dans `unit`. `null` = à l'appréciation de l'athlète. */
  load: number | null;
  unit: StrengthLoadUnit;
  restSec: number | null;
  tempo: string | null;
  /**
   * Charge libre (`RPE 9`, `RM du jour`, `+2,5 kg`) quand un nombre ne suffit
   * pas ; sérialisée en `charge …`. Une ligne sans `load` mais avec `charge`
   * reste un bloc de force.
   */
  loadNote?: string | null;
  /**
   * Mouvement de gymnastique prescrit en % du record (max unbroken) :
   * « Ring Muscle-up — 3 × 15 % du max ». Les reps viennent du record de
   * l'athlète, côté app ; `reps` vaut alors 0 (inconnues ici).
   */
  pctOfMax?: number;
  /**
   * Complexe (#454) : « Complexe — 1 Deadlift + 1 Power Clean — 5 × 1 @ 75 %1RM
   * Power Clean ». `name` vaut « Complexe », `sets` × `reps` sont les séries ×
   * répétitions du complexe entier. Un complexe n'a jamais de 1RM propre : un
   * %1RM se calcule sur celui de `refName` (un des mouvements), côté app.
   */
  complex?: StrengthComplex;
}

export interface StrengthComplex {
  movements: { reps: number; name: string }[];
  /** Mouvement de référence d'une charge en %1RM ; `null` pour une charge en kg ou libre. */
  refName: string | null;
}

/** Nom d'un complexe dans le texte du WOD (relu par le parseur, jamais traduit). */
export const COMPLEX_NAME = 'Complexe';

export const EMPTY_STRENGTH_ENTRY: StrengthEntry = {
  name: '', sets: 5, reps: 5, load: null, unit: 'kg', restSec: null, tempo: null, loadNote: null,
};

const SEP = ' — ';

/** Un bloc de force ne doit jamais commencer par un chiffre (cf. en-tête). */
function sanitizeName(name: string): string {
  // Un tiret entouré d'espaces est le séparateur de la ligne : il ne peut pas
  // rester dans le nom (« Toes-to-Bar » n'est pas concerné, son tiret est collé).
  return name.replace(/^[\d\s×x.,:—–-]+/, '').replace(/\s+[—–-]\s+/g, ' ').trim();
}

function formatRest(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

function parseRest(text: string): number | null {
  const raw = text.trim().toLowerCase().replace(/\s/g, '');
  const mmss = raw.match(/^(\d+):(\d{1,2})$/);
  if (mmss) return parseInt(mmss[1], 10) * 60 + parseInt(mmss[2], 10);
  const sec = raw.match(/^(\d+)s?$/);
  if (sec) return parseInt(sec[1], 10);
  return null;
}

/** Fin commune : charge libre, repos, tempo (ordre de l'app, contrat partagé). */
function serializeTails(e: StrengthEntry): string {
  let out = '';
  const loadNote = (e.loadNote ?? '').trim().replace(/\s+[—–-]\s+/g, ' ');
  if (loadNote) out += `${SEP}charge ${loadNote}`;
  if (e.restSec != null && e.restSec > 0) out += `${SEP}repos ${formatRest(e.restSec)}`;
  const tempo = (e.tempo ?? '').trim();
  if (tempo) out += `${SEP}tempo ${tempo}`;
  return out;
}

/** Mouvements d'un complexe tels qu'écrits (nom nettoyé, « + » retiré, vides écartés). */
export function complexMovesForWrite(c: StrengthComplex): { reps: number; name: string }[] {
  return c.movements
    .map(m => ({ reps: Math.max(1, Math.round(m.reps)), name: sanitizeName(m.name).replace(/\s*\+\s*/g, ' ') }))
    .filter(m => m.name);
}

function serializeComplex(e: StrengthEntry, c: StrengthComplex): string {
  const moves = complexMovesForWrite(c);
  if (moves.length < 2) return '';
  let out = `${COMPLEX_NAME}${SEP}${moves.map(m => `${m.reps} ${m.name}`).join(' + ')}`
    + `${SEP}${Math.max(1, Math.round(e.sets))} × ${Math.max(1, Math.round(e.reps))}`;
  if (e.load != null && e.load > 0) {
    if (e.unit === 'kg') out += ` @ ${e.load} kg`;
    else {
      const ref = moves.find(m => m.name.toLowerCase() === (c.refName ?? '').trim().toLowerCase()) ?? moves[moves.length - 1];
      out += ` @ ${e.load} %1RM ${ref.name}`;
    }
  }
  return out + serializeTails(e);
}

export function serializeStrength(e: StrengthEntry): string {
  if (e.complex) return serializeComplex(e, e.complex);
  const name = sanitizeName(e.name);
  if (!name) return '';
  const sets = Math.max(1, Math.round(e.sets));
  const reps = Math.max(1, Math.round(e.reps));
  // Ordre de l'app (contrat partagé) : charge, repos, tempo. Le parseur lit
  // tous les ordres, y compris les lignes écrites avant (« … — tempo — charge »).
  let out = e.pctOfMax != null
    ? `${name}${SEP}${sets} × ${e.pctOfMax} % du max`
    : `${name}${SEP}${sets} × ${reps}`;
  if (e.pctOfMax == null && e.load != null && e.load > 0) out += ` @ ${e.load} ${e.unit}`;
  return out + serializeTails(e);
}

/** Repos, tempo et charge libre des segments de fin. */
function parseTails(tails: string[]): { restSec: number | null; tempo: string | null; loadNote: string | null } {
  let restSec: number | null = null;
  let tempo: string | null = null;
  let loadNote: string | null = null;
  for (const tail of tails) {
    const rest = tail.match(/^repos\s+(.+)$/i);
    if (rest) { restSec = parseRest(rest[1]); continue; }
    const tp = tail.match(/^tempo\s+(.+)$/i);
    if (tp) { tempo = tp[1].trim(); continue; }
    const ch = tail.match(/^charge\s+(.+)$/i);
    if (ch) loadNote = ch[1].trim();
  }
  return { restSec, tempo, loadNote };
}

/**
 * « Complexe — 1 Deadlift + 1 Power Clean — 5 × 1 @ 75 %1RM Power Clean ».
 * Deux mouvements au moins, chacun avec ses reps ; charge en kg, en %1RM d'un
 * des mouvements (sans mouvement nommé : le dernier), ou aucune. Toute autre
 * forme : `null`. Miroir exact de `parseComplexLine` côté app (#621).
 */
function parseComplexLine(parts: string[]): StrengthEntry | null {
  if (parts.length < 3 || !/^complexe$/i.test(parts[0].trim())) return null;
  const movements: StrengthComplex['movements'] = [];
  for (const raw of parts[1].split('+')) {
    const mv = raw.trim().match(/^(\d+)\s+(\D.*)$/);
    if (!mv || parseInt(mv[1], 10) < 1) return null;
    movements.push({ reps: parseInt(mv[1], 10), name: mv[2].trim() });
  }
  if (movements.length < 2) return null;
  const sc = parts[2].match(/^(\d+)\s*[x×]\s*(\d+)(?:\s*@\s*(\d+(?:[.,]\d+)?)\s*(?:(kg)|%\s*1rm(?:\s+(.+))?))?$/i);
  if (!sc) return null;
  const sets = parseInt(sc[1], 10);
  const reps = parseInt(sc[2], 10);
  if (sets < 1 || reps < 1) return null;
  const load = sc[3] != null ? parseFloat(sc[3].replace(',', '.')) : null;
  const unit: StrengthLoadUnit = load != null && sc[4] == null ? '%1RM' : 'kg';
  let refName: string | null = null;
  if (unit === '%1RM') {
    const wanted = (sc[5] ?? '').trim().toLowerCase();
    const ref = wanted ? movements.find(m => m.name.toLowerCase() === wanted) : movements[movements.length - 1];
    if (!ref) return null;                     // référence hors du complexe
    refName = ref.name;
  }
  const { restSec, tempo, loadNote } = parseTails(parts.slice(3));
  return {
    name: parts[0].trim(),
    sets,
    reps,
    load,
    unit,
    restSec,
    tempo,
    ...(loadNote ? { loadNote } : {}),
    complex: { movements, refName },
  };
}

export function parseStrengthLine(line: string): StrengthEntry | null {
  const raw = (line ?? '').trim();
  if (!raw || /^\d/.test(raw)) return null;    // « reps d'abord » = mouvement de WOD
  const parts = raw.split(/\s+[—–-]\s+/);
  if (parts.length < 2) return null;
  const name = parts[0].trim();
  if (!name) return null;
  const complex = parseComplexLine(parts);
  if (complex) return complex;

  const m = parts[1].match(/^(\d+)\s*[x×]\s*(\d+)(?:\s*@\s*(\d+(?:[.,]\d+)?)\s*(kg|%\s*1rm|%))?$/i);
  // « 3 × 15 % du max » / « 3 × 15 % » : seulement pour un mouvement de
  // gymnastique (un % de son record). Un mouvement chargé reste non reconnu.
  const pm = m ? null : parts[1].match(/^(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*%(?:\s*du\s+max)?$/i);
  if (!m && !(pm && gymPrLabel(name))) return null;

  const load = m?.[3] != null ? parseFloat(m[3].replace(',', '.')) : null;
  const unit: StrengthLoadUnit = m?.[4] != null && m[4].toLowerCase().startsWith('kg') ? 'kg' : '%1RM';

  const { restSec, tempo, loadNote } = parseTails(parts.slice(2));

  return {
    name,
    sets: parseInt((m ?? pm)![1], 10),
    reps: m ? parseInt(m[2], 10) : 0,
    load,
    unit: load == null ? 'kg' : unit,
    restSec,
    tempo,
    ...(loadNote ? { loadNote } : {}),
    ...(pm ? { pctOfMax: parseFloat(pm[2].replace(',', '.')) } : {}),
  };
}

export function isStrengthLine(line: string): boolean {
  return parseStrengthLine(line) !== null;
}

/** Sépare une description en mouvements de WOD (crédités) et blocs de force. */
export function splitStrengthLines(lines: string[]): { wod: string[]; strength: string[] } {
  const wod: string[] = [];
  const strength: string[] = [];
  for (const l of lines) (isStrengthLine(l) ? strength : wod).push(l);
  return { wod, strength };
}
