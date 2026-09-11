'use client';

import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Languages } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { HELP_STRINGS, type Locale } from '@/lib/tutorials/i18n';
import type { Heading } from '@/lib/tutorials/text';
import type { TutorialRole } from '@/lib/tutorials/schema';
import type { ReactNode } from 'react';

export interface TutorialVariant {
  title: string;
  summary: string;
  role: TutorialRole;
  headings: Heading[];
  previous: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
  /** Corps MDX déjà rendu côté serveur. */
  content: ReactNode;
  /** Vrai quand la langue demandée n'existe pas et que le FR est servi (§5.3). */
  fallback: boolean;
}

/**
 * Lecture d'un tutoriel. Les deux langues sont rendues par le serveur et le
 * basculement FR/EN se fait sans rechargement, sur le même slug d'URL.
 */
export default function TutorialView({
  variants,
}: {
  variants: Partial<Record<Locale, TutorialVariant>>;
}) {
  const { lang } = useLanguage();
  const variant = variants[lang] ?? variants.fr ?? variants.en;
  const strings = HELP_STRINGS[lang];
  if (!variant) return null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 md:px-8">
      <Link
        href="/help"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 transition-colors hover:text-white"
      >
        <ArrowLeft size={14} />
        {strings.back}
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">{variant.title}</h1>
          <p className="mt-1 text-sm text-gray-500">{variant.summary}</p>
        </div>
        <span className="mt-1 shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
          {strings.roles[variant.role]}
        </span>
      </div>

      {variant.fallback && (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs text-gray-300">
          <Languages size={14} className="shrink-0 text-gray-400" />
          {strings.untranslated}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-8 lg:flex-row-reverse lg:items-start">
        <article className="min-w-0 flex-1">{variant.content}</article>

        {variant.headings.length > 0 && (
          <nav className="hidden w-56 shrink-0 lg:block">
            <p className="text-[11px] font-black uppercase tracking-widest text-gray-500">{strings.toc}</p>
            <ul className="mt-3 space-y-2 border-l border-white/10 pl-3">
              {variant.headings.map((h) => (
                <li key={h.id}>
                  <a href={`#${h.id}`} className="text-xs text-gray-400 transition-colors hover:text-white">
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>

      <div className="mt-10 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-5">
        {variant.previous ? (
          <Link
            href={`/help/${variant.previous.slug}`}
            className="inline-flex min-w-0 items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
          >
            <ChevronLeft size={16} className="shrink-0" />
            <span className="truncate">{variant.previous.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {variant.next ? (
          <Link
            href={`/help/${variant.next.slug}`}
            className="inline-flex min-w-0 items-center gap-2 text-right text-sm text-gray-400 transition-colors hover:text-white"
          >
            <span className="truncate">{variant.next.title}</span>
            <ChevronRight size={16} className="shrink-0" />
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
