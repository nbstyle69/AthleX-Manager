import type { WodType } from '@/lib/wodFields';
import type { ImportWarning } from './types';
import { normalizeQuotes, secondsToTimecap } from './text';

/**
 * Détection du format d'une section (§3 de la spec) : type, time cap (durée
 * totale), rounds, structure d'intervalle. Insensible à la casse ; `'` =
 * minutes, `"` = secondes.
 *
 * Le type rendu est toujours une valeur réelle du select (`for-time`, `amrap`,
 * `emom`, `tabata`, `strength`, `custom`) ou `null` quand rien ne matche : le
 * cœur choisit alors selon le block. `intervals` (ON/OFF) n'existe pas dans le
 * formulaire → `custom` + avertissement `enum-fallback`.
 */
export interface FormatDetection {
  type: WodType | null;
  timecapSec: number | null;
  rounds: number | null;
  emomIntervalMin: number | null;
  tabataWorkSec: number | null;
  tabataRestSec: number | null;
  /** Ligne « structure d'intervalle » destinée aux notes (§7.3). */
  intervalNote: string | null;
  /** Repos détectés (`1'15 REST`), pour la ligne `Repos : …` des notes. */
  rests: string[];
  warnings: ImportWarning[];
  /** Un pattern a matché (sinon le cœur applique la règle « aucun pattern »). */
  matched: boolean;
  /** Le format porte un score (For Time / AMRAP) → candidat `rank`. */
  scored: boolean;
}

const EMPTY: FormatDetection = {
  type: null, timecapSec: null, rounds: null, emomIntervalMin: null,
  tabataWorkSec: null, tabataRestSec: null, intervalNote: null, rests: [],
  warnings: [], matched: false, scored: false,
};

/** `2'30` → 150 ; `12'` → 720 ; `45"` → 45 ; `1'` → 60. */
export function parseDuration(minStr: string | undefined, secStr?: string | undefined): number | null {
  const m = minStr != null && minStr !== '' ? parseInt(minStr, 10) : 0;
  const s = secStr != null && secStr !== '' ? parseInt(secStr, 10) : 0;
  if (Number.isNaN(m) || Number.isNaN(s)) return null;
  const total = m * 60 + s;
  return total > 0 ? total : null;
}

function fmtMin(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m} min` : `${m}'${String(s).padStart(2, '0')}`;
}

const REST_RE = /(\d+)(?:'(\d{2})?|")\s*(?:de\s+)?(?:rest|repos)(?:\s+(?:each|entre|between)\s+(rounds?|s[ée]ries?|sets?))?/gi;

export function extractRests(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(REST_RE)) {
    const dur = m[0].match(/^\d+(?:'\d{2}?|")/)?.[0] ?? m[1];
    const scope = m[3]?.toLowerCase();
    const where = scope
      ? (scope.startsWith('round') ? 'entre rounds' : 'entre séries')
      : '';
    out.push(`${dur}${where ? ` ${where}` : ''}`);
  }
  return Array.from(new Set(out));
}

/** Time cap explicite : `TC 12'`, `CAP à 20'`, `Time Cap : 15'`, `TC 12:00`. */
export function extractTimeCap(text: string): number | null {
  const t = normalizeQuotes(text);
  const m = t.match(/\b(?:TC|time\s*cap|cap)\b\s*(?:à|a|:|de)?\s*(\d{1,3})(?::(\d{2})|'(\d{2})?|\s*min)?/i);
  if (!m) return null;
  return parseDuration(m[1], m[2] ?? m[3]);
}

/**
 * Intervalle « toutes les X » : `emom` si l'intervalle est un nombre entier de
 * minutes (champ `emom_interval_minutes`), sinon `custom` + note + repli enum
 * (décision B : `Every 1'30 x4` → custom, cap 06:00).
 */
function intervalResult(base: FormatDetection, everySec: number, n: number): FormatDetection {
  const whole = everySec % 60 === 0;
  return {
    ...base,
    type: whole ? 'emom' : 'custom',
    matched: true,
    rounds: n,
    emomIntervalMin: whole ? everySec / 60 : null,
    timecapSec: everySec * n,
    intervalNote: `Toutes les ${fmtMin(everySec)} × ${n}`,
    warnings: whole ? base.warnings : [...base.warnings, 'enum-fallback'],
  };
}

export function detectFormat(rawText: string): FormatDetection {
  const text = normalizeQuotes(rawText);
  const rests = extractRests(text);
  const explicitCap = extractTimeCap(text);
  const base: FormatDetection = { ...EMPTY, rests, warnings: [] };

  let m: RegExpMatchArray | null;

  // Tabata
  if (/\btabata\b/i.test(text)) {
    const w = text.match(/(\d+)"\s*(?:on|work|effort)?\s*\/\s*(\d+)"\s*(?:off|rest|repos)?/i);
    const work = w ? parseInt(w[1], 10) : 20;
    const rest = w ? parseInt(w[2], 10) : 10;
    const rounds = (() => { const r = text.match(/tabata[^\n]*?[x×]\s*(\d+)/i); return r ? parseInt(r[1], 10) : 8; })();
    return {
      ...base, type: 'tabata', matched: true,
      tabataWorkSec: work, tabataRestSec: rest, rounds,
      timecapSec: rounds * (work + rest),
    };
  }

  // Death By
  if (/\bdeath\s*by\b/i.test(text)) {
    return { ...base, type: 'emom', matched: true, intervalNote: 'Death by', timecapSec: explicitCap };
  }

  // E2MOM X 5 / E2'30MOM x4 / E3MOM x 6
  m = text.match(/\bE(\d+)(?:'(\d{2}))?\s*MOM\s*[x×]\s*(\d+)/i);
  if (m) {
    return intervalResult(base, parseDuration(m[1], m[2]) ?? 60, parseInt(m[3], 10));
  }

  // Every 1'30 X 4 / Every 2' x 5 / Every 90" x 4
  m = text.match(/\bevery\s+(\d+)(?:'(\d{2})?|")\s*[x×]\s*(\d+)/i);
  if (m) {
    const isSec = m[0].includes('"');
    const every = isSec ? parseInt(m[1], 10) : (parseDuration(m[1], m[2]) ?? 60);
    return intervalResult(base, every, parseInt(m[3], 10));
  }

  // EMOM 12' / EMOM 12 / EMOM 12 min / EMOM 12:00
  m = text.match(/\bEMOM\s*(\d{1,3})(?::(\d{2})|'(\d{2})?|\s*min)?/i);
  if (m) {
    const total = parseDuration(m[1], m[2] ?? m[3]) ?? parseInt(m[1], 10) * 60;
    return { ...base, type: 'emom', matched: true, emomIntervalMin: 1, timecapSec: total };
  }

  // AMRAP 15 à 20'
  m = text.match(/\bAMRAP\s*(\d{1,3})\s*(?:à|a|-|–)\s*(\d{1,3})'?/i);
  if (m) {
    return {
      ...base, type: 'amrap', matched: true, scored: true,
      timecapSec: parseInt(m[2], 10) * 60,
      intervalNote: `AMRAP ${m[1]} à ${m[2]} min`,
    };
  }

  // AMRAP 12' / AMRAP 12 / AMRAP 12:00 / AMRAP 12 min
  m = text.match(/\bAMRAP\s*(\d{1,3})(?::(\d{2})|'(\d{2})?|\s*min)?/i);
  if (m) {
    return { ...base, type: 'amrap', matched: true, scored: true, timecapSec: parseDuration(m[1], m[2] ?? m[3]) };
  }

  // 30" ON / 15" OFF X 8  → pas de type « intervals » dans le formulaire
  m = text.match(/(\d+)"\s*on\s*\/\s*(\d+)"\s*off\s*[x×]\s*(\d+)/i);
  if (m) {
    const on = parseInt(m[1], 10), off = parseInt(m[2], 10), n = parseInt(m[3], 10);
    return {
      ...base, type: 'custom', matched: true, rounds: n,
      tabataWorkSec: on, tabataRestSec: off,
      timecapSec: n * (on + off),
      intervalNote: `${on}" on / ${off}" off × ${n}`,
      warnings: ['enum-fallback'],
    };
  }

  // N Rounds For Time / For Time
  m = text.match(/(\d+)\s*rounds?\s*(?:for\s*time|FT)\b/i);
  if (m) {
    return { ...base, type: 'for-time', matched: true, scored: true, rounds: parseInt(m[1], 10), timecapSec: explicitCap };
  }
  if (/\bfor\s*time\b/i.test(text)) {
    const rft = text.match(/(\d+)\s*(?:rounds?|rds?|tours?)\b/i);
    return {
      ...base, type: 'for-time', matched: true, scored: true,
      rounds: rft ? parseInt(rft[1], 10) : null, timecapSec: explicitCap,
    };
  }

  // Dans une fenêtre de (maximum) 20'
  m = text.match(/dans\s+une\s+fen[êe]tre\s+de\s+(?:maximum\s+)?(\d{1,3})'?/i);
  if (m) {
    return { ...base, type: null, matched: true, timecapSec: parseInt(m[1], 10) * 60 };
  }

  // N Rounds seul
  m = text.match(/(\d+)\s*rounds?\b/i);
  if (m) {
    return { ...base, type: null, matched: true, rounds: parseInt(m[1], 10) };
  }

  // TC seul (aucun format mais un cap)
  if (explicitCap != null) {
    return { ...base, type: null, matched: true, timecapSec: explicitCap };
  }

  return base;
}

export function timecapOf(d: FormatDetection): string | null {
  return secondsToTimecap(d.timecapSec);
}
