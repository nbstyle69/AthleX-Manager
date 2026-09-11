import { MDXRemote } from 'next-mdx-remote/rsc';
import { helpMdxComponents } from './mdx';
import type { Locale } from '@/lib/tutorials/i18n';

/**
 * Rendu du corps MDX en Server Component : le contenu part au navigateur déjà
 * rendu, sans compilateur MDX dans le bundle client ni appel réseau.
 */
export default function TutorialBody({ locale, body }: { locale: Locale; body: string }) {
  return (
    <div className="text-sm text-gray-300">
      <MDXRemote source={body} components={helpMdxComponents(locale)} />
    </div>
  );
}
