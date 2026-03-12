'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Users, Search, Shield, Dumbbell } from 'lucide-react';

interface UserProfile {
  id: string;
  username: string;
  role: string;
  level: string;
  elo: number;
  total_matches: number;
  wins: number;
  created_at: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, username, role, level, elo, total_matches, wins, created_at')
      .order('elo', { ascending: false })
      .limit(100);
    setUsers(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(u =>
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.role?.toLowerCase().includes(search.toLowerCase())
  );

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
                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Utilisateur</th>
                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Rôle</th>
                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Niveau</th>
                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">ELO</th>
                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Matchs</th>
                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Wins</th>
                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Inscrit le</th>
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
