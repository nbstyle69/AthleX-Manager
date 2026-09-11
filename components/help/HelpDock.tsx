import type { ReactNode } from 'react';
import TutorialBody from './TutorialBody';
import HelpButton, { HelpItemsProvider, type HelpSheetItems } from './HelpButton';
import { getTutorialsForPage } from '@/lib/tutorials';
import { LOCALES } from '@/lib/tutorials/i18n';
import type { PageId } from '@/lib/tutorials/pages';

/**
 * Côté serveur : lecture des tutoriels de la page et rendu de leur MDX, dans
 * les deux langues. Rien ne transite par le réseau depuis le navigateur, et le
 * changement de langue n'exige pas un rechargement.
 */
function itemsForPage(page: PageId): HelpSheetItems {
  const items: HelpSheetItems = {};
  for (const locale of LOCALES) {
    items[locale] = getTutorialsForPage(locale, page).map((t) => ({
      slug: t.slug,
      title: t.title,
      summary: t.summary,
      role: t.role,
      content: <TutorialBody locale={t.locale} body={t.body} />,
    }));
  }
  return items;
}

/** Bouton « ? » posé directement dans une page rendue côté serveur. */
export default function HelpDock({ page }: { page: PageId }) {
  return <HelpButton items={itemsForPage(page)} />;
}

/**
 * Alimente le bouton « ? » d'une page cliente : posé dans le layout de la
 * route, il fournit les tutoriels par contexte pendant que la page garde son
 * `'use client'`.
 */
export function HelpDockProvider({ page, children }: { page: PageId; children: ReactNode }) {
  return <HelpItemsProvider items={itemsForPage(page)}>{children}</HelpItemsProvider>;
}
