'use client';

import { useState, useEffect, useCallback, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Loader2, UserPlus, UserMinus, Users2, MessageSquare, Search, SlidersHorizontal, X, Pencil, Check } from 'lucide-react';

const COLORS = [
  '#C9A227', '#8B5CF6', '#EC4899', '#EF4444',
  '#F59E0B', '#10B981', '#3B82F6', '#14B8A6',
  '#F97316', '#84CC16',
];
import Link from 'next/link';

interface Member {
  id: string;
  username: string;
  level: string;
  email: string;
  elo: number;
  groups: { id: string; name: string; color: string }[];
}

const LEVELS = ['rx+', 'rx', 'scaled', 'foundations'];
const LEVEL_LABEL: Record<string, string> = { 'rx+': 'RX+', rx: 'RX', scaled: 'SCALED', foundations: 'FOUNDATIONS' };
const LEVEL_COLOR: Record<string, string> = { 'rx+': '#C9A227', rx: '#3B82F6', scaled: '#10B981', foundations: '#8B5CF6' };

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [group,      setGroup]      = useState<{ id: string; name: string; color: string; wod_visibility_mode: string } | null>(null);
  const [members,    setMembers]    = useState<Member[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [allGroups,  setAllGroups]  = useState<{ id: string; name: string; color: string }[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [toggling,   setToggling]   = useState<string | null>(null);
  const [deleting,   setDeleting]   = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [editing,    setEditing]    = useState(false);
  const [editName,   setEditName]   = useState('');
  const [editColor,  setEditColor]  = useState('');
  const [editVisibility, setEditVisibility] = useState<'daily' | 'weekly'>('weekly');
  const [saving,     setSaving]     = useState(false);

  // Filters
  const [search,       setSearch]       = useState('');
  const [filterLevel,  setFilterLevel]  = useState<string>('');
  const [filterGroup,  setFilterGroup]  = useState<string>('');
  const [eloSort,      setEloSort]      = useState<'asc' | 'desc' | ''>('');
  const [showFilters,  setShowFilters]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const { data: box } = await supabase.from('boxes').select('id').eq('owner_id', user.id).single();
    if (!box) { router.push('/login'); return; }

    const [{ data: grp }, { data: grpMembers }, { data: boxMembers }, { data: groups }, { data: groupMemberships }] = await Promise.all([
      supabase.from('message_groups').select('id, name, color, wod_visibility_mode').eq('id', groupId).single(),
      supabase.from('message_group_members')
        .select('member_id, profiles(id, username, level, email, elo)')
        .eq('group_id', groupId),
      supabase.from('box_members')
        .select('member_id, profiles(id, username, level, email, elo)')
        .eq('box_id', box.id).eq('status', 'active'),
      supabase.from('message_groups').select('id, name, color').eq('box_id', box.id),
      supabase.from('message_group_members').select('member_id, group_id'),
    ]);

    if (!grp) { router.push('/groups'); return; }
    setGroup({ ...grp, wod_visibility_mode: grp.wod_visibility_mode ?? 'weekly' });
    setAllGroups(groups ?? []);

    const membershipMap: Record<string, string[]> = {};
    for (const gm of groupMemberships ?? []) {
      if (!membershipMap[gm.member_id]) membershipMap[gm.member_id] = [];
      membershipMap[gm.member_id].push(gm.group_id);
    }
    const groupMap: Record<string, { id: string; name: string; color: string }> = {};
    for (const g of groups ?? []) groupMap[g.id] = g;

    const toMember = (m: any): Member | null => {
      const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      if (!p) return null;
      const memberGroups = (membershipMap[p.id] ?? [])
        .map((gid: string) => groupMap[gid]).filter(Boolean);
      return { id: p.id, username: p.username ?? '?', level: p.level ?? 'rx', email: p.email ?? '', elo: p.elo ?? 1000, groups: memberGroups };
    };

    setMembers((grpMembers ?? []).map(toMember).filter(Boolean) as Member[]);
    setAllMembers((boxMembers ?? []).map(toMember).filter(Boolean) as Member[]);
    setLoading(false);
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  const inGroupIds = useMemo(() => new Set(members.map(m => m.id)), [members]);

  async function toggleMember(memberId: string) {
    setToggling(memberId);
    setError(null);
    if (inGroupIds.has(memberId)) {
      const { error: e } = await supabase.from('message_group_members')
        .delete().eq('group_id', groupId).eq('member_id', memberId);
      if (e) { setError(e.message); } else { setMembers(prev => prev.filter(m => m.id !== memberId)); }
    } else {
      const { error: e } = await supabase.from('message_group_members')
        .insert({ group_id: groupId, member_id: memberId });
      if (e) { setError(e.message); } else {
        const added = allMembers.find(m => m.id === memberId);
        if (added) setMembers(prev => [...prev, added]);
      }
    }
    setToggling(null);
  }

  async function saveGroup() {
    if (!editName.trim()) return;
    setSaving(true);
    const { error: e } = await supabase
      .from('message_groups')
      .update({ name: editName.trim(), color: editColor, wod_visibility_mode: editVisibility })
      .eq('id', groupId);
    if (e) { setError(e.message); } else {
      setGroup({ ...group!, name: editName.trim(), color: editColor, wod_visibility_mode: editVisibility });
      setEditing(false);
    }
    setSaving(false);
  }

  function startEditing() {
    if (!group) return;
    setEditName(group.name);
    setEditColor(group.color);
    setEditVisibility((group.wod_visibility_mode as 'daily' | 'weekly') ?? 'weekly');
    setEditing(true);
  }

  async function deleteGroup() {
    if (!confirm('Supprimer ce groupe ? Les messages associés resteront.')) return;
    setDeleting(true);
    await supabase.from('message_group_members').delete().eq('group_id', groupId);
    await supabase.from('message_groups').delete().eq('id', groupId);
    router.push('/groups');
  }

  const filteredNotInGroup = useMemo(() => {
    let list = allMembers.filter(m => !inGroupIds.has(m.id));
    if (search)      list = list.filter(m => m.username.toLowerCase().includes(search.toLowerCase()));
    if (filterLevel) list = list.filter(m => m.level === filterLevel);
    if (filterGroup) list = list.filter(m => m.groups.some(g => g.id === filterGroup));
    if (eloSort === 'asc')  list = [...list].sort((a, b) => a.elo - b.elo);
    if (eloSort === 'desc') list = [...list].sort((a, b) => b.elo - a.elo);
    return list;
  }, [allMembers, inGroupIds, search, filterLevel, filterGroup, eloSort]);

  const activeFilters = [filterLevel, filterGroup, eloSort].filter(Boolean).length;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Loader2 size={24} className="animate-spin text-[#C9A227]" />
    </div>
  );
  if (!group) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/groups" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft size={18} /></Link>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${group.color}25` }}>
              <Users2 size={18} style={{ color: group.color }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">{group.name}</h1>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500">{members.length} membre(s)</p>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${group.wod_visibility_mode === 'daily' ? 'text-amber-400 bg-amber-400/15' : 'text-emerald-400 bg-emerald-400/15'}`}>
                  {group.wod_visibility_mode === 'daily' ? 'Jour par jour' : 'Semaine'}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={startEditing}
            className="flex items-center gap-1.5 text-sm font-bold px-3 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors">
            <Pencil size={13} /> Modifier
          </button>
          <Link href={`/messages/new?group=${groupId}`}
            className="flex items-center gap-1.5 text-sm font-bold px-3 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors">
            <MessageSquare size={13} /> Message
          </Link>
          <button onClick={deleteGroup} disabled={deleting}
            className="text-xs font-bold px-3 py-2 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors">
            {deleting ? <Loader2 size={12} className="animate-spin" /> : 'Supprimer'}
          </button>
        </div>
      </div>

      {/* Edit panel */}
      {editing && (
        <div className="bg-[#111111] border border-[#C9A227]/30 rounded-2xl p-5 space-y-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Modifier le groupe</p>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Nom</label>
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#C9A227] transition-colors"
              placeholder="Nom du groupe"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2">Couleur</label>
            <div className="flex flex-wrap gap-2.5">
              {COLORS.map(c => (
                <button
                  key={c} type="button"
                  onClick={() => setEditColor(c)}
                  className={`w-8 h-8 rounded-xl transition-all ${editColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#111111] scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2">Diffusion des WODs</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditVisibility('daily')}
                className={`flex-1 text-center text-xs font-bold px-3 py-2.5 rounded-xl border transition-colors ${
                  editVisibility === 'daily'
                    ? 'border-[#C9A227] bg-[#C9A227]/15 text-[#C9A227]'
                    : 'border-white/10 text-gray-500 hover:text-white hover:border-white/20'
                }`}>
                Jour par jour
              </button>
              <button type="button" onClick={() => setEditVisibility('weekly')}
                className={`flex-1 text-center text-xs font-bold px-3 py-2.5 rounded-xl border transition-colors ${
                  editVisibility === 'weekly'
                    ? 'border-[#C9A227] bg-[#C9A227]/15 text-[#C9A227]'
                    : 'border-white/10 text-gray-500 hover:text-white hover:border-white/20'
                }`}>
                Semaine entière
              </button>
            </div>
            <p className="text-[10px] text-gray-600 mt-1.5">
              {editVisibility === 'daily'
                ? 'Les membres ne voient que les WODs du jour (pas les jours futurs)'
                : 'Les membres voient tous les WODs de la semaine'}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button onClick={saveGroup} disabled={saving || !editName.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold bg-[#C9A227] text-white rounded-xl disabled:opacity-60 transition-colors">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Enregistrer
            </button>
            <button onClick={() => setEditing(false)}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-white/10 rounded-xl transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}

      {/* Members in group */}
      <div className="bg-[#111111] border border-white/8 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/8 flex items-center justify-between">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Membres du groupe</p>
          <span className="text-xs text-gray-600">{members.length}</span>
        </div>
        {members.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-500">Aucun membre dans ce groupe.</div>
        ) : members.map(m => {
          const lvlColor = LEVEL_COLOR[m.level] ?? '#6B7280';
          return (
            <div key={m.id} className="flex items-center justify-between px-5 py-3.5 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black" style={{ color: group.color, backgroundColor: `${group.color}15` }}>
                  {m.username[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">{m.username}</p>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ color: lvlColor, backgroundColor: `${lvlColor}20` }}>{LEVEL_LABEL[m.level] ?? m.level.toUpperCase()}</span>
                  </div>
                  <p className="text-xs text-gray-500">⭐ ELO {m.elo}</p>
                </div>
              </div>
              <button onClick={() => toggleMember(m.id)} disabled={toggling === m.id}
                className="flex items-center gap-1.5 text-xs font-bold text-red-400 hover:text-red-300 transition-colors">
                {toggling === m.id ? <Loader2 size={12} className="animate-spin" /> : <UserMinus size={13} />}
                Retirer
              </button>
            </div>
          );
        })}
      </div>

      {/* Add members section */}
      <div className="bg-[#111111] border border-white/8 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/8">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ajouter des membres</p>
        </div>

        {/* Search + filter bar */}
        <div className="px-5 py-3 border-b border-white/5 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un membre…"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#C9A227] transition-colors"
              />
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X size={12} /></button>}
            </div>
            <button onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${showFilters || activeFilters > 0 ? 'border-[#C9A227]/50 text-[#C9A227] bg-[#C9A227]/10' : 'border-white/10 text-gray-400 hover:text-white'}`}>
              <SlidersHorizontal size={13} />
              Filtres{activeFilters > 0 ? ` (${activeFilters})` : ''}
            </button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-2 pt-1">
              {/* Level filter */}
              <div className="flex items-center gap-1">
                {['', ...LEVELS].map(l => (
                  <button key={l} onClick={() => setFilterLevel(l)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${filterLevel === l ? 'text-white' : 'text-gray-500 hover:text-gray-300 bg-white/5'}`}
                    style={filterLevel === l && l ? { backgroundColor: `${LEVEL_COLOR[l]}25`, color: LEVEL_COLOR[l] } : filterLevel === l ? { backgroundColor: 'rgba(255,255,255,0.1)', color: 'white' } : {}}>
                    {l ? LEVEL_LABEL[l] : 'Tous niveaux'}
                  </button>
                ))}
              </div>

              {/* ELO sort */}
              <div className="flex items-center gap-1 ml-auto">
                <span className="text-xs text-gray-600">ELO :</span>
                {[['', 'Défaut'], ['desc', '↓ Haut'], ['asc', '↑ Bas']].map(([val, label]) => (
                  <button key={val} onClick={() => setEloSort(val as any)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${eloSort === val ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300 bg-white/5'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Group filter */}
              {allGroups.filter(g => g.id !== groupId).length > 0 && (
                <div className="w-full">
                  <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A227] transition-colors">
                    <option value="" className="text-black">Tous les groupes</option>
                    {allGroups.filter(g => g.id !== groupId).map(g => (
                      <option key={g.id} value={g.id} className="text-black">{g.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {activeFilters > 0 && (
                <button onClick={() => { setFilterLevel(''); setFilterGroup(''); setEloSort(''); }}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                  <X size={11} /> Réinitialiser
                </button>
              )}
            </div>
          )}
        </div>

        {filteredNotInGroup.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-500">
            {allMembers.filter(m => !inGroupIds.has(m.id)).length === 0 ? 'Tous les membres sont déjà dans ce groupe.' : 'Aucun résultat pour ces filtres.'}
          </div>
        ) : filteredNotInGroup.map(m => {
          const lvlColor = LEVEL_COLOR[m.level] ?? '#6B7280';
          return (
            <div key={m.id} className="flex items-center justify-between px-5 py-3.5 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-black text-gray-400">
                  {m.username[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-200">{m.username}</p>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ color: lvlColor, backgroundColor: `${lvlColor}20` }}>{LEVEL_LABEL[m.level] ?? m.level.toUpperCase()}</span>
                    {m.groups.map(g => (
                      <span key={g.id} className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ color: g.color, backgroundColor: `${g.color}20` }}>{g.name}</span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600">⭐ ELO {m.elo}</p>
                </div>
              </div>
              <button onClick={() => toggleMember(m.id)} disabled={toggling === m.id}
                className="flex items-center gap-1.5 text-xs font-bold text-[#C9A227] hover:text-[#C9A227]/80 transition-colors shrink-0">
                {toggling === m.id ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={13} />}
                Ajouter
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
