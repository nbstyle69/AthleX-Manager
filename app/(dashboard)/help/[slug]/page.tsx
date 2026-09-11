import { notFound } from 'next/navigation';
import TutorialBody from '@/components/help/TutorialBody';
import TutorialView, { type TutorialVariant } from '@/components/help/TutorialView';
import { allSlugs, getTutorialWithFallback, neighbours } from '@/lib/tutorials';
import { LOCALES, type Locale } from '@/lib/tutorials/i18n';

export function generateStaticParams() {
  return allSlugs().map((slug) => ({ slug }));
}

/** Un tutoriel illisible rend un 404, jamais une erreur de rendu. */
function safe<T>(read: () => T | null): T | null {
  try {
    return read();
  } catch (err) {
    console.error('[help] tutoriel illisible', err);
    return null;
  }
}

/**
 * Un slug, deux langues rendues côté serveur : l'URL ne change pas quand le
 * gérant passe en anglais (§5.3). Un slug inconnu rend un 404 propre.
 */
export default async function TutorialPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const variants: Partial<Record<Locale, TutorialVariant>> = {};
  for (const locale of LOCALES) {
    const found = safe(() => getTutorialWithFallback(locale, slug));
    if (!found) continue;
    const { previous, next } = neighbours(found.tutorial.locale, slug);
    variants[locale] = {
      title: found.tutorial.title,
      summary: found.tutorial.summary,
      role: found.tutorial.role,
      headings: found.tutorial.headings,
      previous: previous ? { slug: previous.slug, title: previous.title } : null,
      next: next ? { slug: next.slug, title: next.title } : null,
      content: <TutorialBody locale={found.tutorial.locale} slug={found.tutorial.slug} />,
      fallback: found.fallback,
    };
  }

  if (Object.keys(variants).length === 0) notFound();

  return <TutorialView variants={variants} />;
}
