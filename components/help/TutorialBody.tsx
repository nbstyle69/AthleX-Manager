import { helpMdxComponents } from './mdx';
import { TUTORIAL_COMPONENTS } from '@/lib/tutorials/components.generated';
import type { Locale } from '@/lib/tutorials/i18n';

/**
 * Rendu du corps d'un tutoriel en Server Component. Le MDX est compilé au
 * build (imports statiques), donc aucun compilateur ni lecture disque à la
 * requête et un seul runtime JSX.
 */
export default function TutorialBody({ locale, slug }: { locale: Locale; slug: string }) {
  const Body = TUTORIAL_COMPONENTS[locale]?.[slug];
  if (!Body) return null;
  return (
    <div className="text-sm text-gray-300">
      <Body components={helpMdxComponents(locale)} />
    </div>
  );
}
