import { MOVEMENT_CATALOG } from '@/lib/movements';
import GLOBAL_SYNONYMS from './movement-synonyms.json';
import type { ChargeOrder, ParsedMovement } from './types';
import { applyTypoFixes, normKey, normalizeQuotes, stripAccents } from './text';

/**
 * Lignes de mouvement (§4) et résolution vers le catalogue officiel (§4.4).
 *
 * Le catalogue (`MOVEMENT_CATALOG`) est un tableau statique sans identifiant :
 * « résolu » = le nom nettoyé correspond, via synonymes puis rapprochement
 * flou (≥ 0,85), à un nom du catalogue. Un mouvement résolu prend la casse
 * exacte du catalogue ; un mouvement non résolu garde son nom brut nettoyé et
 * reste insérable (ligne orange en preview).
 */

export interface MovementParseOptions {
  chargeOrder: ChargeOrder;
  synonyms: Record<string, string>;
  typoFixes: Record<string, string>;
}

export interface MovementParse {
  movement: ParsedMovement;
  /** `chargeOrder = unknown` et deux charges → la plus lourde = H, à vérifier. */
  chargeAmbiguous: boolean;
}

const CATALOG_BY_KEY = new Map<string, string>(
  MOVEMENT_CATALOG.map(m => [normKey(m.name), m.name]),
);
const GLOBAL_SYN: Record<string, string> = GLOBAL_SYNONYMS;

export interface Resolution { name: string; resolved: boolean }

export function resolveMovementName(raw: string, profileSynonyms: Record<string, string> = {}): Resolution {
  const cleaned = cleanMovementName(raw);
  if (!cleaned) return { name: raw.trim(), resolved: false };
  const key = normKey(cleaned);

  const viaProfile = lookupSyn(key, profileSynonyms);
  if (viaProfile) return viaProfile;
  const viaGlobal = lookupSyn(key, GLOBAL_SYN);
  if (viaGlobal) return viaGlobal;

  const exact = CATALOG_BY_KEY.get(key);
  if (exact) return { name: exact, resolved: true };

  // Pluriel / singulier simple
  const sing = key.replace(/s\b/g, '');
  for (const [k, name] of CATALOG_BY_KEY) {
    if (k.replace(/s\b/g, '') === sing) return { name, resolved: true };
  }

  let best: { name: string; score: number } | null = null;
  for (const [k, name] of CATALOG_BY_KEY) {
    const score = similarity(key, k);
    if (!best || score > best.score) best = { name, score };
  }
  if (best && best.score >= 0.85) return { name: best.name, resolved: true };
  return { name: cleaned, resolved: false };
}

function lookupSyn(key: string, table: Record<string, string>): Resolution | null {
  for (const [from, to] of Object.entries(table)) {
    if (normKey(from) === key) {
      const cat = CATALOG_BY_KEY.get(normKey(to));
      return cat ? { name: cat, resolved: true } : { name: to, resolved: false };
    }
  }
  return null;
}

/** Retire les qualificatifs entre parenthèses de type `(technique)` et l'espace superflu. */
export function cleanMovementName(raw: string): string {
  return stripAccents(raw)
    .replace(/\((?:technique|resistance|résistance|skill)\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Similarité de Levenshtein normalisée (1 = identique). */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const prev = new Array<number>(b.length + 1);
  const cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
}

// ── Ligne de mouvement ─────────────────────────────────────────────────────

const LINE_PREFIX = /^\s*[-•·*]\s*/;

/** Une ligne « mouvement » commence par un tiret puis un chiffre, un `X` ou un pourcentage. */
export function looksLikeMovementLine(line: string): boolean {
  const s = normalizeQuotes(line).replace(LINE_PREFIX, '');
  return /^(?:\d|X\s|♀|♂)/i.test(s);
}

function extractParens(s: string): { rest: string; notes: string[] } {
  const notes: string[] = [];
  const rest = s.replace(/\(([^)]*)\)/g, (_, inner: string) => {
    const t = inner.trim();
    if (t) notes.push(t);
    return ' ';
  }).replace(/\s+/g, ' ').trim();
  return { rest, notes };
}

function normalizeRpe(s: string): string | null {
  const m = s.match(/RPE\s*(\d+(?:[.,]\d+)?(?:\s*[/-]\s*\d+)?)/i);
  return m ? `RPE ${m[1].replace(/\s+/g, '')}` : null;
}

/** `35/50kg` → ["35kg","50kg"] ; `2X24 / 2X16` → ["2X24","2X16"]. */
function splitPair(charge: string): [string, string] | null {
  const m = charge.match(/^\s*([\d.,]+(?:\s*[xX×]\s*[\d.,]+)?)\s*\/\s*([\d.,]+(?:\s*[xX×]\s*[\d.,]+)?)\s*(kg|lbs?|%)?\s*$/i);
  if (!m) return null;
  const unit = m[3] ?? '';
  return [`${m[1].replace(/\s+/g, '')}${unit}`, `${m[2].replace(/\s+/g, '')}${unit}`];
}

function chargeWeight(s: string): number {
  const m = s.match(/([\d.,]+)\s*[xX×]\s*([\d.,]+)/);
  if (m) return parseFloat(m[1].replace(',', '.')) * parseFloat(m[2].replace(',', '.'));
  const n = s.match(/[\d.,]+/);
  return n ? parseFloat(n[0].replace(',', '.')) : 0;
}

export function assignCharges(
  charge: string | null,
  order: ChargeOrder,
): { charge_h: string | null; charge_f: string | null; ambiguous: boolean } {
  if (!charge) return { charge_h: null, charge_f: null, ambiguous: false };
  const pair = splitPair(charge);
  if (!pair) return { charge_h: charge, charge_f: charge, ambiguous: false };
  const [a, b] = pair;
  if (order === 'FH') return { charge_f: a, charge_h: b, ambiguous: false };
  if (order === 'HF') return { charge_h: a, charge_f: b, ambiguous: false };
  const heavyFirst = chargeWeight(a) >= chargeWeight(b);
  return { charge_h: heavyFirst ? a : b, charge_f: heavyFirst ? b : a, ambiguous: true };
}

/**
 * Analyse une ligne de mouvement selon les regex §4.2 (premier qui matche).
 * Rend `null` si la ligne n'est pas un mouvement.
 */
export function parseMovementLine(rawLine: string, opts: MovementParseOptions): MovementParse | null {
  let line = normalizeQuotes(applyTypoFixes(rawLine, opts.typoFixes)).replace(LINE_PREFIX, '').trim();
  if (!line) return null;

  const notes: string[] = [];
  let charge: string | null = null;
  let reps_h: string | null = null;
  let reps_f: string | null = null;

  // ♀ 2 RMU / ♂ 3 RMU
  const sexes = line.match(/♀\s*(\d+)\s*([^/]+?)\s*\/\s*♂\s*(\d+)\s*(.+)$/) ?? line.match(/♂\s*(\d+)\s*([^/]+?)\s*\/\s*♀\s*(\d+)\s*(.+)$/);
  if (sexes) {
    const femaleFirst = line.trim().startsWith('♀');
    reps_f = femaleFirst ? sexes[1] : sexes[3];
    reps_h = femaleFirst ? sexes[3] : sexes[1];
    line = `${reps_h} ${sexes[4].trim()}`;
  }

  // RPE (entre parenthèses, en suffixe, ou après @)
  const paren = extractParens(line);
  line = paren.rest;
  for (const n of paren.notes) {
    const rpe = normalizeRpe(n);
    if (rpe && /^RPE/i.test(n.trim())) { charge = rpe; continue; }
    if (/^CAP\b/i.test(n)) { notes.push(n.replace(/\s+/g, ' ')); continue; }
    if (/^DU\s+RM\s+CLEAN/i.test(n)) { notes.push('⚠️ RM Clean, pas RM Front Squat'); continue; }
    if (/^RM\s+\w+/i.test(n)) { notes.push(n.replace(/\s+/g, ' ')); continue; }
    if (/UBK\s+max/i.test(n)) { notes.push(n.replace(/maximum/i, 'max')); continue; }
    notes.push(n);
  }
  const rpeSuffix = line.match(/\s*@?\s*(RPE\s*\d+(?:[.,]\d+)?(?:\s*[/-]\s*\d+)?)\s*$/i);
  if (rpeSuffix) {
    charge = normalizeRpe(rpeSuffix[1]);
    line = line.slice(0, rpeSuffix.index).trim();
  }

  // Charge après @, ou en suffixe nu (`21 Thruster 35/50kg`, `10 KB Swing 24kg`)
  const at = line.match(/\s*@\s*(.+)$/);
  if (at) {
    const c = at[1].trim();
    line = line.slice(0, at.index).trim();
    charge = normalizeRpe(c) ?? c.replace(/^de\s+/i, '');
  } else {
    const bare = line.match(/\s+([\d.,]+(?:\s*[xX×]\s*[\d.,]+)?(?:\s*\/\s*[\d.,]+(?:\s*[xX×]\s*[\d.,]+)?)?\s*(?:kg|lbs?))$/i);
    if (bare && /\S\s+\S/.test(line.slice(0, bare.index))) {
      charge = bare[1].replace(/\s+/g, '');
      line = line.slice(0, bare.index).trim();
    }
  }

  let reps: string | null = null;
  let name: string | null = null;
  let m: RegExpMatchArray | null;

  // sets X reps name  (`6X1 Squat Snatch`, `3 à 4 X3 Clean Pull`)
  if ((m = line.match(/^(\d+)(?:\s*à\s*(\d+))?\s*[xX×]\s*(\d+)\s+(.+)$/))) {
    const sets = m[2] ?? m[1];
    if (m[2]) notes.unshift(`${m[1]} à ${m[2]} séries`);
    reps = `${sets}×${m[3]}`;
    name = m[4];
  }
  // reps(/side)(unit) name  (`8/bras Tirage`, `8/8 Single leg`, `20-30"/côté Plank`, `500m Ski`, `40 Cal Row`)
  else if ((m = line.match(/^(\d+(?:\s*(?:-|à)\s*\d+)?)\s*(m|km|cal|"|')?\s*(?:\/\s*(c[oô]t[ée]|bras|jambe|\d+))?\s*(m|km|cal|"|')?\s+(.+)$/i))) {
    // On garde la forme lue (`8/bras`, `20-30"/côté`, `12m`, `40 Cal`) : elle est
    // relue telle quelle par le coach en preview.
    reps = line.slice(0, line.length - m[5].length).replace(/\s*à\s*/, '-').replace(/\s+/g, ' ').trim();
    name = m[5];
  }
  // pct% name  (`25% T2B`)
  else if ((m = line.match(/^(\d+)\s*%\s+(.+)$/))) {
    name = m[2];
    const maxIdx = notes.findIndex(n => /s[ée]rie\s+max/i.test(n));
    if (maxIdx >= 0) {
      const nameWords = new Set(name.toLowerCase().split(/\s+/));
      const qualifier = notes[maxIdx]
        .replace(/s[ée]rie\s+max/i, '')
        .split(/\s+/)
        .filter(w => w && !nameWords.has(w.toLowerCase()))
        .join(' ');
      notes.splice(maxIdx, 1);
      reps = `${m[1]}% du max${qualifier ? ` ${qualifier}` : ''}`;
    } else {
      reps = `${m[1]}%`;
    }
  }
  // X name  (`X RMU`) → selon niveau
  else if ((m = line.match(/^X\s+(.+)$/i))) {
    reps = 'selon niveau';
    name = m[1];
  }
  else return null;

  // « … sur deux Row en relais libre » : le nom s'arrête au premier mot de liaison
  const tail = name.match(/^(.+?)\s+(sur|avec|en|puis|then|same time)\s+(.+)$/i);
  if (tail && tail[1].trim().split(/\s+/).length <= 4) {
    name = tail[1];
    notes.push(/^same time$/i.test(tail[2]) ? `simultané avec ${tail[3]}` : `${tail[2]} ${tail[3]}`);
  }
  // `J1` / `J2` en suffixe = note
  const jour = name.match(/^(.+?)\s+(J\d)$/);
  if (jour) { name = jour[1]; notes.unshift(jour[2]); }

  const { charge_h, charge_f, ambiguous } = assignCharges(charge, opts.chargeOrder);
  const res = resolveMovementName(name, opts.synonyms);

  return {
    movement: {
      name: res.name,
      resolved: res.resolved,
      reps,
      charge_h,
      charge_f,
      reps_h,
      reps_f,
      note: notes.length ? Array.from(new Set(notes)).join(' · ') : null,
    },
    chargeAmbiguous: ambiguous,
  };
}
