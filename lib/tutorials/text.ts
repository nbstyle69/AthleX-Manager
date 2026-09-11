/**
 * Transformations de texte du corps MDX. Module pur (ni `fs` ni React) : il
 * sert au chargement serveur, à l'index de recherche envoyé au navigateur et
 * aux tests.
 */

/** Accents et casse retirés, des deux côtés de la recherche : « visibilite » doit trouver « Visibilité ». */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Corps MDX → texte brut indexable (sans JSX, sans balisage Markdown). */
export function toPlainText(body: string): string {
  return body
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface Heading {
  id: string;
  text: string;
}

/** Titres de niveau 2 du corps, pour le sommaire de `/help/[slug]`. */
export function extractHeadings(body: string): Heading[] {
  const out: Heading[] = [];
  const re = /^##\s+(.+?)\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const text = m[1].replace(/[*`]/g, '').trim();
    out.push({ id: slugifyHeading(text), text });
  }
  return out;
}

export function slugifyHeading(text: string): string {
  return normalize(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Nombre d'étapes numérotées (liste ordonnée de premier niveau). */
export function countSteps(body: string): number {
  return (body.match(/^\d+\.\s+\S/gm) ?? []).length;
}

/** Extrait centré sur la requête, pour les résultats de recherche. */
export function excerpt(plain: string, query: string, radius = 90): string {
  const at = normalize(plain).indexOf(normalize(query.trim()));
  if (query.trim() === '' || at === -1) return plain.slice(0, radius * 2).trim();
  const start = Math.max(0, at - radius);
  const end = Math.min(plain.length, at + query.length + radius);
  return `${start > 0 ? '…' : ''}${plain.slice(start, end).trim()}${end < plain.length ? '…' : ''}`;
}
