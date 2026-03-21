'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Award, Search, Users } from 'lucide-react';

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

  const catColor = (c: string) =>
    c === 'activity' ? 'text-orange-400 bg-orange-500/15' :
    c === 'tournament' ? 'text-yellow-400 bg-yellow-500/15' :
    c === 'social' ? 'text-blue-400 bg-blue-500/15' :
    c === 'wod' ? 'text-emerald-400 bg-emerald-500/15' :
    c === 'elo' ? 'text-purple-400 bg-purple-500/15' :
    c === 'movement' ? 'text-red-400 bg-red-500/15' :
    'text-gray-400 bg-white/5';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
            <Award size={22} className="text-yellow-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Badges</h1>
            <p className="text-sm text-gray-400">{badges.length} badges · {totalEarned} attribués au total</p>
          </div>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 w-64"
          />
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setCatFilter(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              catFilter === c
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-white/5 text-gray-500 border border-white/10 hover:text-white'
            }`}
          >
            {c === 'all' ? 'Tous' : c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(b => (
            <div
              key={b.badge_key}
              className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5 hover:border-white/10 transition-all"
            >
              <div className="flex items-start gap-3 mb-3">
                <span className="text-3xl">{b.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-white truncate">{b.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{b.description}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-4">
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${catColor(b.category)}`}>
                  {b.category}
                </span>
                <div className="flex items-center gap-1.5">
                  <Users size={12} className="text-gray-500" />
                  <span className="text-xs font-bold text-gray-400">{b.earned_count} gagné{b.earned_count > 1 ? 's' : ''}</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-600 mt-2 font-mono">{b.badge_key}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
