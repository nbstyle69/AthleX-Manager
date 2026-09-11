import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { ArrowUpRight, ImageOff, Info, TriangleAlert } from 'lucide-react';
import { HELP_STRINGS, type Locale } from '@/lib/tutorials/i18n';
import { helpPage, isPageId } from '@/lib/tutorials/pages';
import { slugifyHeading } from '@/lib/tutorials/text';
import type { ReactNode } from 'react';

/**
 * Composants autorisés dans les tutoriels (§7) : `Screenshot`, `GoTo`,
 * `Callout`, plus le balisage Markdown de base. Rendus en Server Components —
 * `Screenshot` a besoin du disque pour ne jamais afficher d'image cassée.
 */

function nodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return nodeText((node as { props: { children?: ReactNode } }).props?.children);
  }
  return '';
}

/** Le `src` est-il réellement présent dans `public/` ? */
function hasImage(src: string | undefined): src is string {
  if (!src || !src.startsWith('/')) return false;
  try {
    return fs.existsSync(path.join(process.cwd(), 'public', src.replace(/^\//, '')));
  } catch {
    return false;
  }
}

function Screenshot({ src, alt, locale }: { src?: string; alt: string; locale: Locale }) {
  // Un cadre neutre plutôt qu'une image cassée : les captures arrivent après
  // la première mise en ligne du contenu (§2.1).
  if (!hasImage(src)) {
    return (
      <span className="my-3 flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-center">
        <ImageOff size={16} className="text-gray-500" />
        <span className="text-xs font-semibold text-gray-400">{alt}</span>
        <span className="text-[11px] text-gray-600">{HELP_STRINGS[locale].screenshotPending}</span>
      </span>
    );
  }
  return (
    <span className="my-3 block overflow-hidden rounded-xl border border-white/10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="block w-full" />
    </span>
  );
}

function GoTo({ page, locale }: { page: string; locale: Locale }) {
  if (!isPageId(page)) return null;
  const target = helpPage(page);
  const strings = HELP_STRINGS[locale];
  return (
    <Link
      href={target.route}
      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#0A0A0A] transition-opacity hover:opacity-90"
    >
      {strings.goTo(strings.pages[target.labelKey] ?? target.id)}
      <ArrowUpRight size={16} />
    </Link>
  );
}

function Callout({ type = 'info', children }: { type?: 'info' | 'warning'; children: ReactNode }) {
  const warning = type === 'warning';
  const Icon = warning ? TriangleAlert : Info;
  return (
    <div
      className={
        warning
          ? 'my-4 flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100'
          : 'my-4 flex gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-gray-300'
      }
    >
      <Icon size={16} className={warning ? 'mt-0.5 shrink-0 text-amber-400' : 'mt-0.5 shrink-0 text-gray-400'} />
      <div className="space-y-2 [&_p]:m-0">{children}</div>
    </div>
  );
}

export function helpMdxComponents(locale: Locale) {
  return {
    h2: ({ children }: { children?: ReactNode }) => (
      <h2
        id={slugifyHeading(nodeText(children))}
        className="mt-8 scroll-mt-24 text-lg font-black text-white first:mt-0"
      >
        {children}
      </h2>
    ),
    h3: ({ children }: { children?: ReactNode }) => (
      <h3 className="mt-6 text-sm font-black uppercase tracking-widest text-gray-400">{children}</h3>
    ),
    p: ({ children }: { children?: ReactNode }) => (
      <p className="mt-3 text-sm leading-relaxed text-gray-300">{children}</p>
    ),
    ol: ({ children }: { children?: ReactNode }) => (
      <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-gray-300 marker:font-black marker:text-white">
        {children}
      </ol>
    ),
    ul: ({ children }: { children?: ReactNode }) => (
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-gray-300">{children}</ul>
    ),
    li: ({ children }: { children?: ReactNode }) => <li className="pl-1">{children}</li>,
    strong: ({ children }: { children?: ReactNode }) => (
      <strong className="font-bold text-white">{children}</strong>
    ),
    code: ({ children }: { children?: ReactNode }) => (
      <code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px] font-semibold text-white">
        {children}
      </code>
    ),
    Screenshot: (props: { src?: string; alt: string }) => <Screenshot {...props} locale={locale} />,
    GoTo: (props: { page: string }) => <GoTo {...props} locale={locale} />,
    Callout,
  };
}
