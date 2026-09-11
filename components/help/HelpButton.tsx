'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, CircleHelp, ExternalLink } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useLanguage } from '@/components/language-provider';
import { HELP_STRINGS, type Locale } from '@/lib/tutorials/i18n';
import type { TutorialRole } from '@/lib/tutorials/schema';

export interface HelpSheetItem {
  slug: string;
  title: string;
  summary: string;
  role: TutorialRole;
  /** Corps MDX déjà rendu côté serveur : le sheet n'appelle rien. */
  content: ReactNode;
}

export type HelpSheetItems = Partial<Record<Locale, HelpSheetItem[]>>;

const HelpItemsContext = createContext<HelpSheetItems | null>(null);

/**
 * Les pages clientes du back-office reçoivent leurs tutoriels par contexte,
 * alimenté depuis le layout de la route (donc rendus par le serveur) : le
 * bouton « ? » reste posé à côté du titre de page sans que la page ait besoin
 * de charger quoi que ce soit.
 */
export function HelpItemsProvider({ items, children }: { items: HelpSheetItems; children: ReactNode }) {
  return <HelpItemsContext.Provider value={items}>{children}</HelpItemsContext.Provider>;
}

/**
 * Bouton « ? » de l'en-tête. Ouvre un panneau latéral : la page dessous reste
 * montée, donc un WOD en cours de saisie n'est pas perdu (§5.2). Sans tutoriel
 * pour la page, le bouton n'est pas rendu.
 */
export default function HelpButton({ items: fromProps }: { items?: HelpSheetItems }) {
  const fromContext = useContext(HelpItemsContext);
  const items = fromProps ?? fromContext;
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);

  const list = items?.[lang]?.length ? items[lang]! : (items?.fr ?? []);
  const strings = HELP_STRINGS[lang];
  if (list.length === 0) return null;

  const current = list.find((i) => i.slug === slug) ?? null;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSlug(null);
      }}
    >
      <SheetTrigger
        aria-label={strings.helpButton}
        title={strings.helpButton}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-gray-400 transition-colors hover:border-white/25 hover:text-white"
      >
        <CircleHelp size={16} />
      </SheetTrigger>

      <SheetContent title={strings.sheetTitle} description={strings.sheetSubtitle}>
        {current ? (
          <div>
            <button
              type="button"
              onClick={() => setSlug(null)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 transition-colors hover:text-white"
            >
              <ArrowLeft size={14} />
              {strings.back}
            </button>
            <h3 className="mt-3 text-base font-black text-white">{current.title}</h3>
            <Link
              href={`/help/${current.slug}`}
              className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 underline underline-offset-4 hover:text-white"
            >
              {strings.openInHelp}
              <ExternalLink size={12} />
            </Link>
            <div className="mt-4">{current.content}</div>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((item) => (
              <button
                key={item.slug}
                type="button"
                onClick={() => setSlug(item.slug)}
                className="flex w-full items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left transition-colors hover:border-white/25 hover:bg-white/[0.05]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-white">{item.title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-gray-400">{item.summary}</span>
                </span>
                <ChevronRight size={16} className="mt-0.5 shrink-0 text-gray-500" />
              </button>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
