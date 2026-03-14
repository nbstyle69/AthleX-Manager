'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Building2, Search, Users, Calendar, CheckCircle, XCircle } from 'lucide-react';

interface BoxItem {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  plan: string;
  is_active: boolean;
  created_at: string;
  owner_name: string;
  owner_email: string;
  member_count: number;
}

export default function AdminBoxesPage() {
  const [boxes, setBoxes] = useState<BoxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('boxes')
      .select('*, owner:profiles!boxes_owner_id_fkey(username)')
      .order('created_at', { ascending: false });

    const mapped: BoxItem[] = await Promise.all(
      (data ?? []).map(async (b: any) => {
        const owner = Array.isArray(b.owner) ? b.owner[0] : b.owner;

        const { count } = await supabase
          .from('box_members')
          .select('*', { count: 'exact', head: true })
          .eq('box_id', b.id);

        return {
          id: b.id,
          name: b.name,
          slug: b.slug,
          city: b.city,
          plan: b.plan ?? 'free',
          is_active: b.is_active,
          created_at: b.created_at,
          owner_name: owner?.username ?? 'Inconnu',
          owner_email: '',
          member_count: count ?? 0,
        };
      })
    );
    setBoxes(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = boxes.filter(b =>
    b.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.city?.toLowerCase().includes(search.toLowerCase()) ||
    b.owner_name?.toLowerCase().includes(search.toLowerCase())
  );

  const planColor = (p: string) =>
    p === 'elite' ? 'text-yellow-400 bg-yellow-500/15' :
    p === 'pro' ? 'text-purple-400 bg-purple-500/15' :
    'text-gray-400 bg-white/5';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
            <Building2 size={22} className="text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Boxes</h1>
            <p className="text-sm text-gray-400">{boxes.length} box{boxes.length !== 1 ? 'es' : ''} enregistrée{boxes.length !== 1 ? 's' : ''}</p>
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
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Building2 size={48} className="text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">{search ? 'Aucun résultat.' : 'Aucune box enregistrée.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(box => (
            <div key={box.id} className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5 space-y-4 hover:border-white/10 transition-all">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center text-orange-400 font-black text-sm">
                    {box.name[0]?.toUpperCase() ?? 'B'}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{box.name}</p>
                    {box.city && <p className="text-xs text-gray-500">{box.city}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {box.is_active ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-lg">
                      <CheckCircle size={10} /> Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/15 px-2 py-0.5 rounded-lg">
                      <XCircle size={10} /> Inactive
                    </span>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 text-gray-400">
                  <Users size={12} />
                  <span className="font-semibold">{box.member_count} membre{box.member_count !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-400">
                  <Calendar size={12} />
                  <span className="font-semibold">{new Date(box.created_at).toLocaleDateString('fr-FR')}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Owner</p>
                  <p className="text-xs font-semibold text-gray-300">{box.owner_name}</p>
                </div>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${planColor(box.plan)}`}>
                  {box.plan}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
