import { RAW_TUTORIALS } from './content.generated';
import { parseFrontmatter, tutorialFrontmatterSchema, type TutorialFrontmatter } from './schema';
import { LOCALES, themeForOrder, type Locale, type ThemeId } from './i18n';
import { countSteps, extractHeadings, toPlainText, type Heading } from './text';
import type { PageId } from './pages';

/**
 * Chargement des tutoriels de `content/tutorials/{fr,en}` : validation zod, tri
 * par `order`. Aucun appel réseau, aucune table Supabase, et aucun accès disque
 * à la requête — le MDX est embarqué dans le bundle au build par
 * `scripts/generate-tutorials-content.mjs`, car le dossier `content/` n'est pas
 * déployé avec les fonctions serverless.
 */

export interface TutorialMeta extends TutorialFrontmatter {
  locale: Locale;
  theme: ThemeId;
  /** Corps sans MDX, indexé par la recherche. */
  plain: string;
  steps: number;
}

export interface Tutorial extends TutorialMeta {
  body: string;
  headings: Heading[];
}

const cache = new Map<Locale, Tutorial[]>();

export function listSlugs(locale: Locale): string[] {
  return Object.keys(RAW_TUTORIALS[locale] ?? {}).sort();
}

function load(locale: Locale): Tutorial[] {
  const cached = cache.get(locale);
  if (cached && process.env.NODE_ENV === 'production') return cached;

  const tutorials = listSlugs(locale).map((slug) => {
    const raw = RAW_TUTORIALS[locale][slug];
    let front: TutorialFrontmatter;
    let body: string;
    try {
      const parsed = parseFrontmatter(raw);
      front = tutorialFrontmatterSchema.parse(parsed.data);
      body = parsed.body;
    } catch (err) {
      throw new Error(
        `content/tutorials/${locale}/${slug}.mdx : front-matter invalide — ${(err as Error).message}`,
      );
    }
    if (front.slug !== slug) {
      throw new Error(`content/tutorials/${locale}/${slug}.mdx : slug « ${front.slug} » ≠ nom de fichier`);
    }
    return {
      ...front,
      locale,
      theme: themeForOrder(front.order),
      plain: toPlainText(body),
      steps: countSteps(body),
      body,
      headings: extractHeadings(body),
    } satisfies Tutorial;
  });

  tutorials.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
  cache.set(locale, tutorials);
  return tutorials;
}

/** Tous les tutoriels d'une langue, triés par `order` (§6). */
export function getTutorials(locale: Locale): Tutorial[] {
  return load(locale);
}

/** Métadonnées seules : ce qui part au navigateur pour la recherche et les cartes. */
export function getTutorialIndex(locale: Locale): TutorialMeta[] {
  return load(locale).map(({ body: _body, headings: _headings, ...meta }) => meta);
}

export function getTutorial(locale: Locale, slug: string): Tutorial | null {
  return load(locale).find((t) => t.slug === slug) ?? null;
}

/**
 * Chaîne de repli de §5.3 : un slug absent en EN rend le FR, signalé par un
 * bandeau. Le test de parité fait échouer le build dans ce cas, donc ce repli
 * ne joue qu'en développement, le temps d'écrire la traduction.
 */
export function getTutorialWithFallback(
  locale: Locale,
  slug: string,
): { tutorial: Tutorial; fallback: boolean } | null {
  const asked = getTutorial(locale, slug);
  if (asked) return { tutorial: asked, fallback: false };
  const french = locale === 'fr' ? null : getTutorial('fr', slug);
  return french ? { tutorial: french, fallback: true } : null;
}

/** Tutoriels liés à une page du registre, pour le bouton « ? » (§5.2). */
export function getTutorialsForPage(locale: Locale, page: PageId): Tutorial[] {
  return load(locale).filter((t) => t.pages.includes(page));
}

/** Union des slugs de toutes les langues : source de `generateStaticParams`. */
export function allSlugs(): string[] {
  const slugs = new Set<string>();
  for (const locale of LOCALES) for (const slug of listSlugs(locale)) slugs.add(slug);
  return [...slugs].sort();
}

export function neighbours(
  locale: Locale,
  slug: string,
): { previous: TutorialMeta | null; next: TutorialMeta | null } {
  const list = getTutorialIndex(locale);
  const at = list.findIndex((t) => t.slug === slug);
  if (at === -1) return { previous: null, next: null };
  return { previous: list[at - 1] ?? null, next: list[at + 1] ?? null };
}
