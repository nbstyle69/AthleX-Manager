'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Users, Search, Shield, Dumbbell, Building2, ChevronUp, ChevronDown } from 'lucide-react';

interface UserProfile {
  id: string;
  username: string;
  role: string;
  level: string;
  elo: number;
  total_matches: number;
  wins: number;
  created_at: string;
  box_name: string | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  type SortCol = 'username' | 'role' | 'box' | 'level' | 'elo' | 'matches' | 'wins' | 'date' | '';
  const [sortCol, setSortCol] = useState<SortCol>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  function toggleSort(col: SortCol) {
    if (sortCol === col) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
    else { setSortCol(col); setSortDir(col === 'elo' || col === 'matches' || col === 'wins' ? 'desc' : 'asc'); }
  }
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, role, level, elo, total_matches, wins, created_at')
      .order('elo', { ascending: false })
      .limit(200);

    // Fetch box memberships to map user → box name
    const { data: memberships } = await supabase
      .from('box_members')
      .select('member_id, box:boxes!box_members_box_id_fkey(name)')
      .eq('status', 'active');

    const boxMap = new Map<string, string>();
    (memberships ?? []).forEach((m: any) => {
      const box = Array.isArray(m.box) ? m.box[0] : m.box;
      if (box?.name) boxMap.set(m.member_id, box.name);
    });

    // Also check box owners directly
    const { data: boxes } = await supabase
      .from('boxes')
      .select('owner_id, name');
    (boxes ?? []).forEach((b: any) => {
      if (b.owner_id && !boxMap.has(b.owner_id)) boxMap.set(b.owner_id, b.name);
    });

    setUsers((profiles ?? []).map(p => ({ ...p, box_name: boxMap.get(p.id) ?? null })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = (() => {
    let list = users.filter(u =>
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.role?.toLowerCase().includes(search.toLowerCase())
    );
    if (sortCol) {
      const dir = sortDir === 'asc' ? 1 : -1;
      const LEVEL_ORDER: Record<string, number> = { pro: 6, gx: 5, 'rx+': 4, rx: 3, inter: 2, scaled: 1 };
      list = [...list].sort((a, b) => {
        switch (sortCol) {
          case 'username': return dir * (a.username ?? '').localeCompare(b.username ?? '');
          case 'role':     return dir * (a.role ?? '').localeCompare(b.role ?? '');
          case 'box':      return dir * (a.box_name ?? '').localeCompare(b.box_name ?? '');
          case 'level':    return dir * ((LEVEL_ORDER[a.level] ?? 0) - (LEVEL_ORDER[b.level] ?? 0));
          case 'elo':      return dir * (a.elo - b.elo);
          case 'matches':  return dir * (a.total_matches - b.total_matches);
          case 'wins':     return dir * (a.wins - b.wins);
          case 'date':     return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          default: return 0;
        }
      });
    }
    return list;
  })();

  const roleColor = (r: string) =>
    r === 'super_admin' ? 'text-emerald-400 bg-emerald-500/15' :
    r === 'admin' ? 'text-blue-400 bg-blue-500/15' :
    r === 'box_owner' ? 'text-purple-400 bg-purple-500/15' :
    'text-gray-400 bg-white/5';

  const levelColor = (l: string) =>
    l === 'pro' ? 'text-red-400' :
    l === 'gx' ? 'text-purple-400' :
    l === 'rx+' ? 'text-orange-400' :
    l === 'rx' ? 'text-emerald-400' :
    l === 'inter' ? 'text-blue-400' :
    'text-gray-400';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Users size={22} className="text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Utilisateurs</h1>
            <p className="text-sm text-gray-400">{users.length} athlètes inscrits</p>
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

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.03] text-left">
                {[
                  { key: 'username' as SortCol, label: 'Utilisateur' },
                  { key: 'role' as SortCol, label: 'Rôle' },
                  { key: 'box' as SortCol, label: 'Box' },
                  { key: 'level' as SortCol, label: 'Niveau' },
                  { key: 'elo' as SortCol, label: 'ELO' },
                  { key: 'matches' as SortCol, label: 'Matchs' },
                  { key: 'wins' as SortCol, label: 'Wins' },
                  { key: 'date' as SortCol, label: 'Inscrit le' },
                ].map(col => (
                  <th key={col.label}
                    onClick={() => toggleSort(col.key)}
                    className={`px-5 py-3 text-xs font-bold uppercase tracking-wider select-none cursor-pointer hover:text-white transition-colors ${
                      sortCol === col.key ? 'text-emerald-400' : 'text-gray-500'
                    }`}>
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortCol === col.key && (
                        sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-black text-gray-400">
                        {u.username?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <span className="font-bold text-white">{u.username}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${roleColor(u.role)}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {u.box_name ? (
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-orange-400">
                        <Building2 size={12} />
                        {u.box_name}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-black uppercase ${levelColor(u.level)}`}>
                      {u.level}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-black text-yellow-500">{u.elo}</span>
                  </td>
                  <td className="px-5 py-4 text-gray-300">{u.total_matches}</td>
                  <td className="px-5 py-4 text-gray-300">{u.wins}</td>
                  <td className="px-5 py-4 text-gray-500 text-xs">
                    {new Date(u.created_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
