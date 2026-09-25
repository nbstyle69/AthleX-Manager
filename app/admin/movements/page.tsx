'use client';

import { useState } from 'react';
import { Dumbbell } from 'lucide-react';
import MovementStats from '@/components/admin/MovementStats';
import MovementCatalogEditor from '@/components/admin/MovementCatalogEditor';

type Tab = 'stats' | 'catalog';

const TABS: { id: Tab; label: string }[] = [
  { id: 'stats', label: 'Statistiques' },
  { id: 'catalog', label: 'Catalogue' },
];

export default function AdminMovementsPage() {
  const [tab, setTab] = useState<Tab>('stats');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-ax-control bg-ax-danger-soft flex items-center justify-center">
            <Dumbbell size={22} className="text-ax-danger" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-medium uppercase tracking-wide text-ax-text">Mouvements</h1>
            <p className="text-sm text-ax-text-secondary break-words">Volumes des athlètes et catalogue des mouvements du générateur</p>
          </div>
        </div>
        <div className="flex gap-1 p-1 rounded-ax-control border border-ax-border" role="tablist">
          {TABS.map(t => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              data-testid={`movements-tab-${t.id}`}
              className={`px-4 py-1.5 rounded-ax-control text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus motion-reduce:transition-none ${
                tab === t.id ? 'bg-ax-accent-soft text-ax-accent-text' : 'text-ax-text-secondary hover:text-ax-text hover:bg-ax-hover'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'stats' ? <MovementStats /> : <MovementCatalogEditor />}
    </div>
  );
}
