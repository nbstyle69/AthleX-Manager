'use client';

import { Apple, Smartphone } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { APP_STORE_URL, PLAY_STORE_URL, STORES_LIVE } from '@/lib/store-links';
import { cn } from '@/lib/utils';

/**
 * Badges des boutiques mobiles.
 *
 * Tant que `STORES_LIVE` est faux, les badges s'affichent sans être cliquables :
 * une fiche non publiée renverrait sur l'accueil de la boutique, ce qui est pire
 * qu'un badge inerte. Le jour de la validation, `STORES_LIVE = true` les active.
 */
export function StoreBadges({
  layout = 'inline',
  className,
}: {
  layout?: 'inline' | 'stacked';
  className?: string;
}) {
  const { t } = useLanguage();

  const items = [
    { href: APP_STORE_URL, label: t.stores.appStore, Icon: Apple },
    { href: PLAY_STORE_URL, label: t.stores.playStore, Icon: Smartphone },
  ];

  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground';

  return (
    <div className={cn(layout === 'stacked' ? 'flex flex-col gap-2' : 'flex flex-wrap gap-3', className)}>
      {items.map(({ href, label, Icon }) =>
        STORES_LIVE ? (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(base, 'transition-colors hover:border-foreground/40')}
          >
            <Icon className="h-4 w-4" /> {label}
          </a>
        ) : (
          <span key={label} className={cn(base, 'cursor-default opacity-60')} aria-disabled="true">
            <Icon className="h-4 w-4" /> {label}
            <span className="text-xs font-normal text-muted-foreground">· {t.stores.soon}</span>
          </span>
        ),
      )}
    </div>
  );
}
