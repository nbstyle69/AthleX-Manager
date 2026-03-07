'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, UserPlus, Trash2, Users2, Loader2, Search } from 'lucide-react';
import Link from 'next/link';

interface Profile { id: string; full_name: string | null; avatar_url: string | null; }
interface Member  { id: string; profile: Profile | null; }
interface Group   { id: string; name: string; color: string | null; created_at: string; }

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router  = useRouter();
  const supabase = createClient();

  const [group,    setGroup]    = useState<Group | null>(null);
  const [members,  setMembers]  = useState<Member[]>([]);
  const [allProfs, setAllProfs] = useState<Profile[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [adding,   setAdding]   = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [tab,      setTab]      = useState<'members' | 'add'>('members');

  async function loadData() {
    setLoading(true);

    const { data: g } = await supabase
      .from('message_groups').select('id, name, color, created_at').eq('id', id).single();
    setGroup(g);

    const { data: gm } = await supabase
      .from('message_group_members')
      .select('id, profile:profiles(id, full_name, avatar_url)')
      .eq('group_id', id);
    setMembers(((gm ?? []) as unknown) as Member[]);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: box } = await supabase.from('boxes').select('id').eq('owner_id', user.id).single();
      if (box) {
        const { data: bm } = await supabase
          .from('box_members')
          .select('profile:profiles(id, full_name, avatar_url)')
          .eq('box_id', box.id)
          .eq('status', 'active');
        setAllProfs(((bm ?? []) as any[]).map((r: any) => r.profile).filter(Boolean));
      }
    }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [id]);

  async function addMember(profileId: string) {
    setAdding(profileId);
    await supabase.from('message_group_members').insert({ group_id: id, user_id: profileId });
    await loadData();
    setAdding(null);
  }

  async function removeMember(memberId: string) {
    setRemoving(memberId);
    await supabase.from('message_group_members').delete().eq('id', memberId);
    await loadData();
    setRemoving(null);
  }

  async function deleteGroup() {
    if (!confirm(`Supprimer le groupe "${group?.name}" ?`)) return;
    await supabase.from('message_group_members').delete().eq('group_id', id);
    await supabase.from('message_groups').delete().eq('id', id);
    router.push('/groups');
  }

  const memberProfileIds = new Set(members.map(m => m.profile?.id).filter(Boolean));
  const filteredProfs = allProfs.filter(p =>
    !memberProfileIds.has(p.id) &&
    (p.full_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const color = group?.color ?? '#6366F1';

  function Avatar({ name, size = 'md' }: { name: string | null | undefined; size?: 'sm' | 'md' }) {
    const s = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs';
    return (
      <div className={`${s} rounded-full flex items-center justify-center font-black shrink-0`}
        style={{ backgroundColor: `${color}30`, color }}>
        {(name ?? '?')[0]?.toUpperCase()}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-400" size={28} /></div>
    );
  }

  if (!group) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Groupe introuvable.</p>
        <Link href="/groups" className="text-indigo-400 text-sm mt-2 inline-block">← Retour aux groupes</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/groups" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft size={18} /></Link>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}25` }}>
            <Users2 size={18} style={{ color }} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">{group.name}</h1>
            <p className="text-xs text-gray-500">{members.length} membre{members.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button onClick={deleteGroup} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-2 rounded-xl transition-colors">
          <Trash2 size={13} /> Supprimer
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit">
        {(['members', 'add'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t ? 'bg-[#16162A] text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            {t === 'members' ? `Membres (${members.length})` : '+ Ajouter des membres'}
          </button>
        ))}
      </div>

      {/* Members tab */}
      {tab === 'members' && (
        <div className="bg-[#16162A] border border-white/8 rounded-2xl overflow-hidden">
          {members.length === 0 ? (
            <div className="py-12 text-center">
              <Users2 size={32} className="text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Aucun membre dans ce groupe.</p>
              <button onClick={() => setTab('add')}
                className="mt-3 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                + Ajouter des membres
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {members.map(m => (
                <li key={m.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.profile?.full_name} />
                    <span className="text-sm font-semibold text-white">{m.profile?.full_name ?? 'Inconnu'}</span>
                  </div>
                  <button
                    onClick={() => removeMember(m.id)}
                    disabled={removing === m.id}
                    className="p-2 rounded-xl hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-40"
                  >
                    {removing === m.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Add members tab */}
      {tab === 'add' && (
        <div className="bg-[#16162A] border border-white/8 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un athlète…"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {filteredProfs.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">
              {allProfs.length === 0 ? 'Aucun membre actif dans la box.' : 'Tous les membres sont déjà dans le groupe.'}
            </div>
          ) : (
            <ul className="divide-y divide-white/5 max-h-96 overflow-y-auto">
              {filteredProfs.map(p => (
                <li key={p.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={p.full_name} />
                    <span className="text-sm font-semibold text-white">{p.full_name ?? 'Inconnu'}</span>
                  </div>
                  <button
                    onClick={() => addMember(p.id)}
                    disabled={adding === p.id}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                    style={{ backgroundColor: `${color}20`, color }}
                  >
                    {adding === p.id ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={13} />}
                    Ajouter
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
