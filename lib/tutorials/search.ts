import Fuse, { type IFuseOptions } from 'fuse.js';
import type { TutorialMeta } from './index';
import { normalize } from './text';
import type { TutorialRole } from './schema';

/**
 * Recherche 100 % navigateur : l'index est construit depuis les métadonnées
 * déjà rendues avec la page, sans requête réseau ni table Supabase (§6).
 *
 * Les champs sont normalisés (accents, casse) des deux côtés — sans quoi
 * « visibilite » ne trouve pas « Visibilité », qui est précisément la requête
 * d'un gérant pressé.
 */
export interface SearchDoc {
  slug: string;
  title: string;
  tags: string;
  summary: string;
  plain: string;
}

export const FUSE_OPTIONS: IFuseOptions<SearchDoc> = {
  includeScore: true,
  threshold: 0.35,
  ignoreLocation: true,
  keys: [
    { name: 'title', weight: 0.5 },
    { name: 'tags', weight: 0.3 },
    { name: 'summary', weight: 0.1 },
    { name: 'plain', weight: 0.1 },
  ],
};

export function toSearchDoc(t: TutorialMeta): SearchDoc {
  return {
    slug: t.slug,
    title: normalize(t.title),
    tags: normalize(t.tags.join(' ')),
    summary: normalize(t.summary),
    plain: normalize(t.plain),
  };
}

export function buildIndex(tutorials: readonly TutorialMeta[]): Fuse<SearchDoc> {
  return new Fuse(tutorials.map(toSearchDoc), FUSE_OPTIONS);
}

/** Slugs classés par pertinence pour la requête donnée. */
export function searchSlugs(index: Fuse<SearchDoc>, query: string): string[] {
  const q = normalize(query.trim());
  if (!q) return [];
  return index.search(q).map((r) => r.item.slug);
}

export function matchesRole(role: TutorialRole, filter: 'all' | 'owner' | 'coach'): boolean {
  if (filter === 'all') return true;
  return role === filter || role === 'both';
}
