import type { ParsedStrength } from './types';
import { EXEC_QUALIFIER_RE, resolveMovementName } from './movements';
import { applyTypoFixes, normalizeQuotes } from './text';

/**
 * Lignes de musculation (§5) : séries × reps × charge. `percent` est un nombre
 * ou `null` ; tout ce qui n'est pas un pourcentage numérique va dans
 * `charge_note`. Une ligne par série progressive.
 */

export interface StrengthParseOptions {
  synonyms: Record<string, string>;
  typoFixes: Record<string, string>;
  /** Rounds du sous-bloc : `sets` par défaut d'une ligne `- 15 2DB Floor Press`. */
  defaultSets?: number | null;
}

const LINE_PREFIX = /^\s*[-•·*]\s*/;

function parseTempo(s: string): { rest: string; tempo: string | null } {
  // `3" pause ras le sol`, `2" pause sous la parallèle`, `tempo 30X1`
  const m = s.match(/(\d+"\s*pause(?:\s+[a-zà-ü]+)*|tempo\s+[\dXx]+)/i);
  if (!m) return { rest: s, tempo: null };
  return { rest: s.replace(m[0], ' ').replace(/\s+/g, ' ').trim(), tempo: m[1].trim() };
}

function parseRest(s: string): { rest: string; restNote: string | null } {
  const m = s.match(/(\d+)(?:'(\d{2})?|")\s*(?:de\s+)?(?:rest|repos)/i);
  if (!m) return { rest: s, restNote: null };
  return { rest: s.replace(m[0], ' ').replace(/\s+/g, ' ').trim(), restNote: m[0].match(/^\d+(?:'(?:\d{2})?|")/)?.[0] ?? m[0] };
}

/** Interprète la charge après `@` : pourcentage numérique, RPE, ou note. */
export function interpretLoad(raw: string | null): { percent: number | null; rpe: string | null; note: string | null } {
  if (!raw) return { percent: null, rpe: null, note: null };
  const c = raw.replace(/^de\s+/i, '').trim();
  const rpe = c.match(/^RPE\s*(\d+(?:[.,]\d+)?(?:\s*[/-]\s*\d+)?)$/i);
  if (rpe) return { percent: null, rpe: rpe[1].replace(/\s+/g, ''), note: null };
  const single = c.match(/^(\d+(?:[.,]\d+)?)\s*%$/);
  if (single) return { percent: parseFloat(single[1].replace(',', '.')), rpe: null, note: null };
  const range = c.match(/^(\d+)\s*(?:-|à|a)\s*(\d+)\s*%$/);
  if (range) return { percent: null, rpe: null, note: `${range[1]}-${range[2]}%` };
  const rel = c.match(/^([+-])\s*(\d+)\s*%\s+de\s+la\s+charge\s+(?:utilis[ée]e|pr[ée]c[ée]dente)/i);
  if (rel) return { percent: null, rpe: null, note: `${rel[1]}${rel[2]} % de la charge précédente` };
  const kgDelta = c.match(/^([+-])\s*([\d,.]+(?:\s*à\s*[\d,.]+)?)\s*kg/i);
  if (kgDelta) return { percent: null, rpe: null, note: `${kgDelta[1]}${kgDelta[2]} kg vs série précédente` };
  return { percent: null, rpe: null, note: c };
}

export function parseStrengthLine(rawLine: string, opts: StrengthParseOptions): ParsedStrength | null {
  let line = normalizeQuotes(applyTypoFixes(rawLine, opts.typoFixes)).replace(LINE_PREFIX, '').trim();
  if (!line) return null;

  const notes: string[] = [];
  let rpe: string | null = null;

  // Parenthèses
  line = line.replace(/\(([^)]*)\)/g, (_, inner: string) => {
    const t = inner.trim();
    const r = t.match(/^RPE\s*(\d+(?:[.,]\d+)?(?:\s*[/-]\s*\d+)?)$/i);
    if (r) { rpe = r[1].replace(/\s+/g, ''); return ' '; }
    if (/^DU\s+RM\s+CLEAN/i.test(t)) { notes.push('⚠️ RM Clean'); return ' '; }
    if (/^\+\s*lourd/i.test(t)) { notes.push(t.replace(/^\+\s*/, '+ ')); return ' '; }
    if (t) notes.push(t);
    return ' ';
  }).replace(/\s+/g, ' ').trim();

  const tempoRes = parseTempo(line);
  line = tempoRes.rest;
  const restRes = parseRest(line);
  line = restRes.rest;

  // Charge après @
  let loadRaw: string | null = null;
  const at = line.match(/\s*@\s*(.+)$/);
  if (at) { loadRaw = at[1].trim(); line = line.slice(0, at.index).trim(); }
  const rpeSuffix = line.match(/\s+RPE\s*(\d+(?:[.,]\d+)?(?:\s*[/-]\s*\d+)?)$/i);
  if (rpeSuffix) { rpe = rpeSuffix[1].replace(/\s+/g, ''); line = line.slice(0, rpeSuffix.index).trim(); }

  let sets: number | null = null;
  let reps: number | null = null;
  let exercise: string | null = null;
  let m: RegExpMatchArray | null;

  if ((m = line.match(/^(\d+)(?:\s*à\s*(\d+))?\s*[xX×]\s*(\d+)\s*(.*)$/))) {
    sets = parseInt(m[2] ?? m[1], 10);
    if (m[2]) notes.unshift(`${m[1]} à ${m[2]} séries`);
    reps = parseInt(m[3], 10);
    exercise = m[4].trim();
  } else if ((m = line.match(/^1\s*RM\s+(.+?)\s+du\s+jour$/i)) || (m = line.match(/^1\s*RM\s+(.+)$/i))) {
    sets = 1; reps = 1; exercise = m[1].trim();
    notes.unshift('1RM du jour');
  } else if ((m = line.match(/^(\d+)(?:\s*à\s*(\d+))?\s+(.+)$/))) {
    sets = opts.defaultSets ?? null;
    reps = parseInt(m[2] ?? m[1], 10);
    if (m[2]) notes.unshift(`${m[1]} à ${m[2]} reps`);
    exercise = m[3].trim();
  } else if ((m = line.match(/^AMRAP\s+(.+)$/i))) {
    sets = opts.defaultSets ?? null; reps = null; exercise = m[1].trim();
    notes.unshift('AMRAP');
  } else {
    return null;
  }

  const qual = exercise?.match(EXEC_QUALIFIER_RE);
  if (qual && exercise) { exercise = exercise.replace(EXEC_QUALIFIER_RE, ' ').trim(); notes.push(qual[1]); }

  const load = interpretLoad(loadRaw);
  if (load.rpe) rpe = load.rpe;
  if (load.note) notes.unshift(load.note);

  const chargeNote = notes.length ? Array.from(new Set(notes)).join(' ') : null;
  const res = exercise ? resolveMovementName(exercise, opts.synonyms) : { name: '', resolved: false };

  return {
    exercise: res.name,
    resolved: res.resolved,
    sets,
    reps,
    percent: load.percent,
    rpe,
    charge_note: chargeNote,
    tempo: tempoRes.tempo,
    rest: restRes.restNote,
  };
}
