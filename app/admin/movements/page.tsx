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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
            <Dumbbell size={22} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Mouvements</h1>
            <p className="text-sm text-gray-400">Volumes des athlètes et catalogue `movement_catalog` du générateur</p>
          </div>
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10" role="tablist">
          {TABS.map(t => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              data-testid={`movements-tab-${t.id}`}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                tab === t.id ? 'bg-emerald-500 text-black' : 'text-gray-400 hover:text-white'
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
