'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Building2, Search, Users, Calendar, CheckCircle, XCircle, ChevronRight, Plus, X } from 'lucide-react';
import Link from 'next/link';

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
  logo_url: string | null;
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
          logo_url: b.logo_url ?? null,
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

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newOwnerUsername, setNewOwnerUsername] = useState('');
  const [createError, setCreateError] = useState('');

  async function handleCreate() {
    if (!newName.trim()) { setCreateError('Le nom est requis.'); return; }
    if (!newOwnerUsername.trim()) { setCreateError('Le username du propriétaire est requis.'); return; }
    setCreating(true);
    setCreateError('');

    // Find owner by username (read-only, OK with client)
    const { data: ownerData } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', newOwnerUsername.trim())
      .single();

    if (!ownerData) {
      setCreateError(`Utilisateur "${newOwnerUsername}" introuvable.`);
      setCreating(false);
      return;
    }

    // Generate invite code
    const code = newName.trim().replace(/\s+/g, '').substring(0, 3).toUpperCase()
      + String(Math.floor(Math.random() * 900) + 100);

    // Use API route with service client to bypass RLS
    const res = await fetch('/api/admin/boxes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName.trim(),
        description: newDesc.trim() || null,
        city: newCity.trim() || null,
        owner_id: ownerData.id,
        invite_code: code,
      }),
    });

    setCreating(false);
    if (!res.ok) {
      const err = await res.json();
      setCreateError(err.error ?? 'Erreur lors de la création.');
      return;
    }
    setShowCreate(false);
    setNewName(''); setNewDesc(''); setNewCity(''); setNewOwnerUsername('');
    load();
  }

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
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors"
          >
            <Plus size={16} /> Créer une box
          </button>
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
      </div>

      {/* Create Box Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111111] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-white">Créer une Box</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Nom *</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Crossfit NBS"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Description</label>
                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description de la box..."
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 h-20 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Ville</label>
                <input value={newCity} onChange={e => setNewCity(e.target.value)} placeholder="Paris"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Username du propriétaire *</label>
                <input value={newOwnerUsername} onChange={e => setNewOwnerUsername(e.target.value)} placeholder="nbstyle"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
              </div>
              {createError && <p className="text-xs text-red-400">{createError}</p>}
            </div>
            <button onClick={handleCreate} disabled={creating}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-bold transition-colors">
              {creating ? 'Création...' : 'Créer la box'}
            </button>
          </div>
        </div>
      )}

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
            <Link key={box.id} href={`/admin/boxes/${box.id}`} className="block bg-[#111111] border border-white/[0.06] rounded-2xl p-5 space-y-4 hover:border-emerald-500/30 transition-all cursor-pointer group">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {box.logo_url ? (
                    <img src={box.logo_url} alt={box.name} className="w-10 h-10 rounded-xl object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center text-orange-400 font-black text-sm">
                      {box.name[0]?.toUpperCase() ?? 'B'}
                    </div>
                  )}
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
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${planColor(box.plan)}`}>
                    {box.plan}
                  </span>
                  <ChevronRight size={14} className="text-gray-600 group-hover:text-emerald-400 transition-colors" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
