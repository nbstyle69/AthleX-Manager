import { z } from 'zod';
import { PAGE_IDS } from './pages';

/**
 * Front-matter des tutoriels, validé au chargement (donc au build et dans les
 * tests). Un front-matter incomplet est une erreur de rédaction : mieux vaut
 * un échec de build qu'une carte sans titre en production.
 */
export const tutorialFrontmatterSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'slug en minuscules et tirets'),
  title: z.string().min(1),
  summary: z.string().min(1),
  role: z.enum(['owner', 'coach', 'both']),
  pages: z.array(z.enum(PAGE_IDS)).min(1),
  tags: z.array(z.string().min(1)).min(1),
  order: z.number().int().positive(),
});

export type TutorialFrontmatter = z.infer<typeof tutorialFrontmatterSchema>;
export type TutorialRole = TutorialFrontmatter['role'];

/**
 * Lecture du bloc `---` en tête de fichier. Sous-ensemble volontairement
 * minuscule de YAML (scalaires et listes en ligne) : le front-matter est écrit
 * par nous, et une dépendance de plus pour six clés ne se justifie pas.
 */
export function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) throw new Error('front-matter absent');

  const data: Record<string, unknown> = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const sep = line.indexOf(':');
    if (sep === -1) throw new Error(`ligne de front-matter illisible : ${line}`);
    const key = line.slice(0, sep).trim();
    data[key] = parseScalar(line.slice(sep + 1).trim());
  }

  return { data, body: raw.slice(match[0].length) };
}

function parseScalar(value: string): unknown {
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((item) => unquote(item.trim()));
  }
  if (/^-?\d+$/.test(value)) return Number(value);
  return unquote(value);
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
    (value.startsWith("'") && value.endsWith("'") && value.length > 1)
  ) {
    return value.slice(1, -1);
  }
  return value;
}
