'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Store } from 'lucide-react';
import HelpButton from '@/components/help/HelpButton';

export type MarketplaceTab = 'catalogue' | 'offers' | 'athletes';

const TABS: { tab: MarketplaceTab; href: string; label: string }[] = [
  { tab: 'catalogue', href: '/programming', label: 'Catalogue' },
  { tab: 'offers', href: '/programming/offers', label: 'Mes offres' },
  { tab: 'athletes', href: '/programming/athletes', label: 'Programmes athlètes' },
];

const SUBTITLES: Record<MarketplaceTab, string> = {
  catalogue: 'Abonne-toi aux programmations d\u2019autres box : ce que tu reçois arrive dans ton Whiteboard.',
  offers: 'Publie tes programmations et vends-les aux autres box.',
  athletes: 'Vends des programmes à tes athlètes : séances, tarif, accès.',
};

export default function MarketplaceShell({
  tab, children,
}: {
  tab: MarketplaceTab;
  children: ReactNode;
}) {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-1">
        <Store className="text-white" size={26} />
        <h1 className="text-2xl font-black text-white">Marketplace</h1>
        <HelpButton />
      </div>
      <p className="text-sm text-gray-400 mb-6">{SUBTITLES[tab]}</p>

      <div className="flex gap-1 mb-6 border-b border-white/10">
        {TABS.map((t) => (
          <Link key={t.tab} href={t.href}
            aria-current={t.tab === tab ? 'page' : undefined}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${
              t.tab === tab ? 'border-white text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {t.label}
          </Link>
        ))}
      </div>

      {children}
    </div>
  );
}
