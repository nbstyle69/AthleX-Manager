/**
 * Nettoyage de texte partagé par le cœur et les profils. Aucune règle propre à
 * un coach ici : les typos et artefacts viennent du profil.
 */

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{1F1E6}-\u{1F1FF}]/gu;

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function stripEmojis(s: string): string {
  return s.replace(EMOJI_RE, '').replace(/\s{2,}/g, ' ').trim();
}

/** `’` → `'`, `″` → `"`, `''` → `"`, `×` reste, espaces insécables → espace. */
export function normalizeQuotes(s: string): string {
  return s
    .replace(/[\u2019\u2018\u00B4`]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/''/g, '"')
    .replace(/[\u00A0\u202F]/g, ' ');
}

export function applyTypoFixes(s: string, fixes: Record<string, string>): string {
  let out = s;
  for (const [from, to] of Object.entries(fixes)) {
    const re = new RegExp(escapeRegExp(from), 'gi');
    // `SPlit` → `Split` ne doit pas toucher `SPLIT JERK` : un mot tout en capitales garde sa casse.
    out = out.replace(re, hit => (hit === hit.toUpperCase() && hit !== hit.toLowerCase() && from !== from.toUpperCase()) ? hit : to);
  }
  return out;
}

export function removeArtefacts(lines: string[], artefacts: RegExp[]): string[] {
  return lines
    .map(l => {
      let s = l;
      for (const re of artefacts) s = s.replace(re, '');
      return s.trim();
    })
    .filter(l => l.length > 0);
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Clé de comparaison : minuscules, sans accents, espaces réduits. */
export function normKey(s: string): string {
  return stripAccents(s).toLowerCase().replace(/[^a-z0-9&+%/'"-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Découpe un texte de page en lignes propres. */
export function toLines(text: string): string[] {
  return normalizeQuotes(text)
    .split(/\r?\n/)
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** `MM:SS` strict depuis des secondes. */
export function secondsToTimecap(sec: number | null): string | null {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function timecapToSeconds(tc: string | null): number | null {
  if (!tc) return null;
  const m = tc.match(/^(\d{1,3}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}
