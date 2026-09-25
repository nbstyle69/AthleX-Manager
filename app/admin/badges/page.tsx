'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Award, Search, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PURPLE_SOFT, SUB_ORANGE_SOFT, SUB_ORANGE_TEXT, chipClass } from '@/components/admin/adminTokens';

// Libellés affichés seulement : le filtre et la base gardent les clés.
const CATEGORY_LABEL: Record<string, string> = {
  activity: 'Activité', tournament: 'Tournoi', social: 'Social', wod: 'WOD',
  elo: 'ELO', movement: 'Mouvement', other: 'Autre',
};
const categoryLabel = (c: string) => CATEGORY_LABEL[c] ?? c;

interface Badge {
  badge_key: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  sort_order: number;
  earned_count: number;
}

export default function AdminBadgesPage() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);

    // Fetch badge catalog
    const { data: catalog } = await supabase
      .from('badges_catalog')
      .select('*')
      .order('sort_order', { ascending: true });

    // Fetch earned badge counts
    const { data: earned } = await supabase
      .from('earned_badges')
      .select('badge_key');

    const countMap = new Map<string, number>();
    (earned ?? []).forEach((e: any) => {
      countMap.set(e.badge_key, (countMap.get(e.badge_key) ?? 0) + 1);
    });

    setBadges(
      (catalog ?? []).map((b: any) => ({
        ...b,
        earned_count: countMap.get(b.badge_key) ?? 0,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = ['all', ...Array.from(new Set(badges.map(b => b.category)))];

  const filtered = badges.filter(b => {
    if (catFilter !== 'all' && b.category !== catFilter) return false;
    if (search && !b.title.toLowerCase().includes(search.toLowerCase()) && !b.badge_key.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalEarned = badges.reduce((s, b) => s + b.earned_count, 0);

  // Même couleur par catégorie qu'avant, en jetons lisibles dans les deux thèmes.
  const catColor = (c: string) =>
    c === 'activity' ? `${SUB_ORANGE_TEXT} ${SUB_ORANGE_SOFT}` :
    c === 'tournament' ? 'text-ax-warning bg-ax-warning-soft' :
    c === 'social' ? 'text-ax-info bg-ax-info-soft' :
    c === 'wod' ? 'text-ax-success bg-ax-success-soft' :
    c === 'elo' ? `text-ax-purple ${PURPLE_SOFT}` :
    c === 'movement' ? 'text-ax-danger bg-ax-danger-soft' :
    'text-ax-text-secondary bg-ax-neutral-soft';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-ax-control bg-ax-warning-soft flex items-center justify-center">
            <Award size={22} className="text-ax-warning" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-medium uppercase tracking-wide text-ax-text">Badges</h1>
            <p className="text-sm text-ax-text-secondary">{badges.length} badges · {totalEarned} attribués au total</p>
          </div>
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ax-text-muted pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            aria-label="Rechercher un badge"
            className="pl-9"
          />
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setCatFilter(c)}
            aria-pressed={catFilter === c}
            className={chipClass(catFilter === c)}
          >
            {c === 'all' ? 'Tous' : categoryLabel(c)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-ax-border border-t-ax-accent-text rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(b => (
            <div
              key={b.badge_key}
              className="bg-ax-surface border border-ax-border rounded-ax-card p-5 transition-colors hover:bg-ax-hover motion-reduce:transition-none"
            >
              <div className="flex items-start gap-3 mb-3">
                <span className="text-3xl shrink-0" aria-hidden="true">{b.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-ax-text break-words">{b.title}</p>
                  <p className="text-xs text-ax-text-secondary mt-0.5 break-words">{b.description}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-ax-badge ${catColor(b.category)}`}>
                  {categoryLabel(b.category)}
                </span>
                <div className="flex items-center gap-1.5">
                  <Users size={12} className="text-ax-text-muted" />
                  <span className="text-xs font-bold text-ax-text-secondary">{b.earned_count} gagné{b.earned_count > 1 ? 's' : ''}</span>
                </div>
              </div>
              <p className="text-[10px] text-ax-text-secondary mt-2 font-mono break-all">{b.badge_key}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
