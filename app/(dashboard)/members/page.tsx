'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Users, Search, SlidersHorizontal, X, Loader2, ChevronDown, ChevronUp, Check, Plus, Trash2, CreditCard, ShieldCheck, Crown } from 'lucide-react';
import { getMyBox } from '@/lib/getMyBox';

const LEVELS = ['rx+', 'rx', 'scaled', 'foundations'];
const LEVEL_LABEL: Record<string, string> = { 'rx+': 'RX+', rx: 'RX', scaled: 'SCALED', foundations: 'FOUNDATIONS' };
const LEVEL_COLOR: Record<string, string> = { 'rx+': '#C9A227', rx: '#3B82F6', scaled: '#10B981', foundations: '#8B5CF6' };

interface MembershipPlan {
  id: string;
  name: string;
  max_sessions_per_week: number | null;
  color: string;
}

interface Member {
  id: string; username: string; level: string; elo: number;
  email: string; joined_at: string; is_banned: boolean;
  plan_id: string | null;
  role: 'member' | 'coach' | 'owner';
  groups: { id: string; name: string; color: string }[];
}

function GroupsPopover({ member, allGroups, onToggle, toggling }: {
  member: Member;
  allGroups: { id: string; name: string; color: string }[];
  onToggle: (memberId: string, groupId: string, inGroup: boolean) => void;
  toggling: string | null;
}) {
  const [open, setOpen] = useState(false);
  const memberGroupIds = new Set(member.groups.map(g => g.id));
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-white border border-white/10 hover:border-white/20 px-2.5 py-1.5 rounded-lg transition-colors">
        Groupes <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl min-w-[180px] py-1 overflow-hidden">
            {allGroups.length === 0 && <p className="px-3 py-2 text-xs text-gray-500">Aucun groupe</p>}
            {allGroups.map(g => {
              const inGroup = memberGroupIds.has(g.id);
              const isLoading = toggling === `${member.id}-${g.id}`;
              return (
                <button key={g.id} onClick={() => onToggle(member.id, g.id, inGroup)}
                  disabled={isLoading}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-white/5 transition-colors text-left">
                  {isLoading ? <Loader2 size={12} className="animate-spin text-gray-400" /> : (
                    <div className={`w-4 h-4 rounded flex items-center justify-center border ${inGroup ? 'border-transparent' : 'border-white/20'}`}
                      style={inGroup ? { backgroundColor: g.color } : {}}>
                      {inGroup && <Check size={10} color="#000" strokeWidth={3} />}
                    </div>
                  )}
                  <span className="flex-1 font-semibold" style={{ color: inGroup ? g.color : '#9ca3af' }}>{g.name}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function PlanPopover({ member, plans, onAssign, saving }: {
  member: Member;
  plans: MembershipPlan[];
  onAssign: (memberId: string, planId: string | null) => void;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const currentPlan = plans.find(p => p.id === member.plan_id);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={saving}
        className="flex items-center gap-2 text-xs font-semibold border border-white/10 hover:border-white/20 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        style={currentPlan ? { color: currentPlan.color, borderColor: `${currentPlan.color}40`, backgroundColor: `${currentPlan.color}10` } : { color: '#9ca3af' }}
      >
        {currentPlan && <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: currentPlan.color }} />}
        {currentPlan ? currentPlan.name : 'Illimité'}
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl min-w-[180px] py-1 overflow-hidden">
            <button
              onClick={() => { onAssign(member.id, null); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-white/5 transition-colors text-left ${!member.plan_id ? 'text-white' : 'text-gray-400'}`}
            >
              <div className={`w-4 h-4 rounded flex items-center justify-center border ${!member.plan_id ? 'border-transparent bg-white/20' : 'border-white/20'}`}>
                {!member.plan_id && <Check size={10} color="#fff" strokeWidth={3} />}
              </div>
              <span className="flex-1 font-semibold">Illimité</span>
            </button>
            {plans.map(p => {
              const selected = member.plan_id === p.id;
              return (
                <button key={p.id}
                  onClick={() => { onAssign(member.id, p.id); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-white/5 transition-colors text-left"
                >
                  <div className={`w-4 h-4 rounded flex items-center justify-center border ${selected ? 'border-transparent' : 'border-white/20'}`}
                    style={selected ? { backgroundColor: p.color } : {}}>
                    {selected && <Check size={10} color="#000" strokeWidth={3} />}
                  </div>
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="flex-1 font-semibold" style={{ color: selected ? p.color : '#9ca3af' }}>
                    {p.name}
                  </span>
                  {p.max_sessions_per_week && (
                    <span className="text-[10px] text-gray-600">{p.max_sessions_per_week}x/sem</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const ROLES: { key: 'member' | 'coach' | 'owner'; label: string; icon: any; color: string }[] = [
  { key: 'member', label: 'Membre', icon: Users, color: '#6B7280' },
  { key: 'coach',  label: 'Coach',  icon: ShieldCheck, color: '#3B82F6' },
  { key: 'owner',  label: 'Owner',  icon: Crown, color: '#C9A227' },
];

function RolePopover({ member, onChange }: {
  member: Member;
  onChange: (member: Member, role: 'member' | 'coach' | 'owner') => void;
}) {
  const [open, setOpen] = useState(false);
  const current = ROLES.find(r => r.key === member.role) ?? ROLES[0];
  const Icon = current.icon;
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} disabled={member.is_banned}
        className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-colors ${member.is_banned ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:border-white/20'}`}
        style={{ color: current.color, borderColor: `${current.color}40`, backgroundColor: `${current.color}10` }}>
        <Icon size={12} />
        {current.label}
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl min-w-[150px] py-1 overflow-hidden">
            {ROLES.map(r => {
              const selected = member.role === r.key;
              const RIcon = r.icon;
              return (
                <button key={r.key}
                  onClick={() => { onChange(member, r.key); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-white/5 transition-colors text-left">
                  <div className={`w-4 h-4 rounded flex items-center justify-center border ${selected ? 'border-transparent' : 'border-white/20'}`}
                    style={selected ? { backgroundColor: r.color } : {}}>
                    {selected && <Check size={10} color="#000" strokeWidth={3} />}
                  </div>
                  <RIcon size={12} style={{ color: selected ? r.color : '#6B7280' }} />
                  <span className="flex-1 font-semibold" style={{ color: selected ? r.color : '#9ca3af' }}>{r.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function MembersPage() {
  const router = useRouter();
  const supabase = createClient();

  const [members,    setMembers]    = useState<Member[]>([]);
  const [allGroups,  setAllGroups]  = useState<{ id: string; name: string; color: string }[]>([]);
  const [boxId,      setBoxId]      = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [toggling,   setToggling]   = useState<string | null>(null);
  const [banning,    setBanning]    = useState<string | null>(null);
  const [plans,      setPlans]      = useState<MembershipPlan[]>([]);
  const [planSaving, setPlanSaving]  = useState<string | null>(null);
  const [showPlans,  setShowPlans]   = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanMax,  setNewPlanMax]  = useState('');
  const [newPlanColor, setNewPlanColor] = useState('#C9A227');
  const [creatingPlan, setCreatingPlan] = useState(false);

  const [search,      setSearch]      = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [eloSort,     setEloSort]     = useState<'asc' | 'desc' | ''>('');
  const [showFilters, setShowFilters] = useState(false);

  type SortCol = 'username' | 'level' | 'elo' | 'plan' | 'role' | 'status' | '';
  const [sortCol, setSortCol] = useState<SortCol>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function toggleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir(col === 'elo' ? 'desc' : 'asc');
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const box = await getMyBox(supabase, user.id);
    if (!box) { router.push('/login'); return; }
    setBoxId(box.id);

    const [{ data: membersRaw }, { data: groups }, { data: groupMemberships }, { data: plansData }] = await Promise.all([
      supabase.from('box_members')
        .select('member_id, status, joined_at, plan_id, role, profile:profiles(id, username, level, elo, email)')
        .eq('box_id', box.id).in('status', ['active', 'banned'])
        .order('joined_at', { ascending: false }),
      supabase.from('message_groups').select('id, name, color').eq('box_id', box.id),
      supabase.from('message_group_members').select('member_id, group_id'),
      supabase.from('membership_plans').select('id, name, max_sessions_per_week, color').eq('box_id', box.id).order('max_sessions_per_week', { ascending: true, nullsFirst: false }),
    ]);

    setPlans((plansData ?? []) as MembershipPlan[]);

    setAllGroups(groups ?? []);

    const membershipMap: Record<string, string[]> = {};
    for (const gm of groupMemberships ?? []) {
      if (!membershipMap[gm.member_id]) membershipMap[gm.member_id] = [];
      membershipMap[gm.member_id].push(gm.group_id);
    }
    const groupMap: Record<string, { id: string; name: string; color: string }> = {};
    for (const g of groups ?? []) groupMap[g.id] = g;

    const parsed: Member[] = (membersRaw ?? []).map((m: any) => {
      const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
      if (!p) return null;
      return {
        id: p.id, username: p.username ?? '?', level: p.level ?? 'rx',
        elo: p.eo ?? 1000, email: p.email ?? '', joined_at: m.joined_at,
        is_banned: m.status === 'banned',
        plan_id: m.plan_id ?? null,
        role: m.role ?? 'member',
        groups: (membershipMap[p.id] ?? []).map((gid: string) => groupMap[gid]).filter(Boolean),
      };
    }).filter(Boolean) as Member[];

    setMembers(parsed);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function changeRole(member: Member, newRole: 'member' | 'coach' | 'owner') {
    if (!boxId || member.role === newRole) return;
    const labels: Record<string, string> = { member: 'Membre', coach: 'Coach', owner: 'Owner' };
    if (!confirm(`Changer le rôle de ${member.username} → ${labels[newRole]} ?`)) return;

    // If promoting to owner, demote the current owner first (prevent double ownership)
    if (newRole === 'owner') {
      const currentOwner = members.find(m => m.role === 'owner' && m.id !== member.id);
      if (currentOwner) {
        await supabase.from('box_members').update({ role: 'member' }).eq('member_id', currentOwner.id).eq('box_id', boxId);
      }
    }

    await supabase.from('box_members').update({ role: newRole }).eq('member_id', member.id).eq('box_id', boxId);
    setMembers(prev => prev.map(m => {
      if (m.id === member.id) return { ...m, role: newRole };
      if (newRole === 'owner' && m.role === 'owner') return { ...m, role: 'member' };
      return m;
    }));
  }

  async function toggleBan(member: Member) {
    if (!boxId) return;
    setBanning(member.id);
    const newStatus = member.is_banned ? 'active' : 'banned';
    await supabase.from('box_members').update({ status: newStatus }).eq('member_id', member.id).eq('box_id', boxId);
    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, is_banned: !m.is_banned } : m));
    setBanning(null);
  }

  async function assignPlan(memberId: string, planId: string | null) {
    if (!boxId) return;
    setPlanSaving(memberId);
    await supabase.from('box_members').update({ plan_id: planId }).eq('member_id', memberId).eq('box_id', boxId);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, plan_id: planId } : m));
    setPlanSaving(null);
  }

  async function createPlan() {
    if (!boxId || !newPlanName.trim()) return;
    setCreatingPlan(true);
    const maxVal = newPlanMax.trim() === '' ? null : parseInt(newPlanMax);
    const { data, error } = await supabase.from('membership_plans').insert({
      box_id: boxId, name: newPlanName.trim(), max_sessions_per_week: maxVal, color: newPlanColor,
    }).select().single();
    if (!error && data) {
      setPlans(prev => [...prev, data as MembershipPlan]);
      setNewPlanName('');
      setNewPlanMax('');
    }
    setCreatingPlan(false);
  }

  async function deletePlan(planId: string) {
    if (!confirm('Supprimer ce contrat ? Les membres associés passeront en illimité.')) return;
    await supabase.from('membership_plans').delete().eq('id', planId);
    setPlans(prev => prev.filter(p => p.id !== planId));
    setMembers(prev => prev.map(m => m.plan_id === planId ? { ...m, plan_id: null } : m));
  }

  async function toggleGroup(memberId: string, groupId: string, inGroup: boolean) {
    setToggling(`${memberId}-${groupId}`);
    if (inGroup) {
      await supabase.from('message_group_members').delete().eq('member_id', memberId).eq('group_id', groupId);
    } else {
      await supabase.from('message_group_members').insert({ member_id: memberId, group_id: groupId });
    }
    const group = allGroups.find(g => g.id === groupId)!;
    setMembers(prev => prev.map(m => {
      if (m.id !== memberId) return m;
      return {
        ...m,
        groups: inGroup ? m.groups.filter(g => g.id !== groupId) : [...m.groups, group],
      };
    }));
    setToggling(null);
  }

  const filtered = useMemo(() => {
    let list = [...members];
    if (search)      list = list.filter(m => m.username.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()));
    if (filterLevel) list = list.filter(m => m.level === filterLevel);
    if (filterGroup) list = list.filter(m => m.groups.some(g => g.id === filterGroup));
    if (eloSort === 'asc')  list = [...list].sort((a, b) => a.elo - b.elo);
    if (eloSort === 'desc') list = [...list].sort((a, b) => b.elo - a.elo);

    // Column sort (overrides eloSort if sortCol is set)
    if (sortCol) {
      const dir = sortDir === 'asc' ? 1 : -1;
      const LEVEL_ORDER: Record<string, number> = { 'rx+': 4, rx: 3, scaled: 2, foundations: 1 };
      const ROLE_ORDER: Record<string, number> = { owner: 3, coach: 2, member: 1 };
      list = [...list].sort((a, b) => {
        switch (sortCol) {
          case 'username': return dir * a.username.localeCompare(b.username);
          case 'level':    return dir * ((LEVEL_ORDER[a.level] ?? 0) - (LEVEL_ORDER[b.level] ?? 0));
          case 'elo':      return dir * (a.elo - b.elo);
          case 'plan': {
            const pa = plans.find(p => p.id === a.plan_id)?.name ?? '';
            const pb = plans.find(p => p.id === b.plan_id)?.name ?? '';
            return dir * pa.localeCompare(pb);
          }
          case 'role':     return dir * ((ROLE_ORDER[a.role] ?? 0) - (ROLE_ORDER[b.role] ?? 0));
          case 'status':   return dir * (Number(a.is_banned) - Number(b.is_banned));
          default: return 0;
        }
      });
    }
    return list;
  }, [members, search, filterLevel, filterGroup, eloSort, sortCol, sortDir, plans]);

  const activeFilters = [filterLevel, filterGroup, eloSort].filter(Boolean).length;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Loader2 size={28} className="animate-spin text-[#C9A227]" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Membres</h1>
          <p className="text-sm text-gray-400 mt-1">{filtered.length} / {members.length} membre(s)</p>
        </div>
        <button onClick={() => setShowPlans(v => !v)}
          className={`flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl border transition-colors ${showPlans ? 'border-[#C9A227]/50 text-[#C9A227] bg-[#C9A227]/10' : 'border-white/10 text-gray-300 hover:text-white hover:bg-white/5'}`}>
          <CreditCard size={16} />
          Contrats
        </button>
      </div>

      {/* Plans management panel */}
      {showPlans && (
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white">Contrats / Abonnements</h3>
          <p className="text-xs text-gray-500">Définissez les types de contrats pour limiter le nombre de réservations par semaine.</p>

          {/* Existing plans */}
          <div className="space-y-2">
            {plans.map(p => (
              <div key={p.id} className="flex items-center gap-3 bg-[#0A0A0A] rounded-xl px-4 py-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <span className="text-sm font-semibold text-white flex-1">{p.name}</span>
                <span className="text-xs text-gray-400">
                  {p.max_sessions_per_week ? `${p.max_sessions_per_week}x / semaine` : 'Illimité'}
                </span>
                <span className="text-[10px] text-gray-600">
                  {members.filter(m => m.plan_id === p.id).length} membre(s)
                </span>
                <button onClick={() => deletePlan(p.id)} className="p-1 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {plans.length === 0 && (
              <p className="text-xs text-gray-600 italic">Aucun contrat créé. Tous les membres sont en accès illimité.</p>
            )}
          </div>

          {/* Create new plan */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Nom</label>
              <input value={newPlanName} onChange={e => setNewPlanName(e.target.value)}
                placeholder="Ex: Essentiel, Premium…"
                className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A227]/50" />
            </div>
            <div className="w-28">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Séances/sem</label>
              <input type="number" min={1} value={newPlanMax} onChange={e => setNewPlanMax(e.target.value)}
                placeholder="∞"
                className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A227]/50" />
            </div>
            <div className="w-16">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Couleur</label>
              <input type="color" value={newPlanColor} onChange={e => setNewPlanColor(e.target.value)}
                className="w-full h-[34px] bg-[#0A0A0A] border border-white/10 rounded-lg cursor-pointer" />
            </div>
            <button onClick={createPlan} disabled={creatingPlan || !newPlanName.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#C9A227] hover:bg-[#B8911F] text-white text-xs font-bold transition-colors disabled:opacity-50">
              {creatingPlan ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Créer
            </button>
          </div>
        </div>
      )}

      {/* Search + filters */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par nom ou email…"
              className="w-full bg-[#111111] border border-white/8 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#C9A227] transition-colors" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X size={13} /></button>}
          </div>
          <button onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-bold border transition-colors ${showFilters || activeFilters > 0 ? 'border-[#C9A227]/50 text-[#C9A227] bg-[#C9A227]/10' : 'bg-[#111111] border-white/8 text-gray-400 hover:text-white'}`}>
            <SlidersHorizontal size={14} />
            Filtres{activeFilters > 0 ? ` (${activeFilters})` : ''}
          </button>
        </div>

        {showFilters && (
          <div className="bg-[#111111] border border-white/8 rounded-xl px-4 py-3 flex flex-wrap gap-3 items-center">
            {/* Level */}
            <div className="flex items-center gap-1">
              {['', ...LEVELS].map(l => (
                <button key={l} onClick={() => setFilterLevel(l)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${filterLevel === l ? '' : 'text-gray-500 hover:text-gray-300 bg-white/5'}`}
                  style={filterLevel === l ? (l ? { backgroundColor: `${LEVEL_COLOR[l]}25`, color: LEVEL_COLOR[l] } : { backgroundColor: 'rgba(255,255,255,0.12)', color: 'white' }) : {}}>
                  {l ? LEVEL_LABEL[l] : 'Tous'}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-white/10" />

            {/* ELO sort */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-600 font-semibold">ELO :</span>
              {([['', 'Défaut'], ['desc', '↓ Haut'], ['asc', '↑ Bas']] as [string, string][]).map(([val, label]) => (
                <button key={val} onClick={() => setEloSort(val as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${eloSort === val ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300 bg-white/5'}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-white/10" />

            {/* Group filter */}
            <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#C9A227] transition-colors">
              <option value="" className="text-black">Tous les groupes</option>
              {allGroups.map(g => <option key={g.id} value={g.id} className="text-black">{g.name}</option>)}
            </select>

            {activeFilters > 0 && (
              <button onClick={() => { setFilterLevel(''); setFilterGroup(''); setEloSort(''); }}
                className="ml-auto text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                <X size={11} /> Réinitialiser
              </button>
            )}
          </div>
        )}
      </div>

      {!members.length ? (
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-12 text-center">
          <Users size={40} className="text-gray-600 mx-auto mb-4" />
          <p className="text-white font-bold mb-1">Aucun membre</p>
          <p className="text-sm text-gray-500">Les membres rejoignent votre box via le code invitation.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-10 text-center text-sm text-gray-500">
          Aucun résultat pour ces filtres.
        </div>
      ) : (
        <div className="bg-[#111111] border border-white/8 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/8">
                {[
                  { key: 'username' as SortCol, label: 'Membre' },
                  { key: 'level' as SortCol, label: 'Niveau' },
                  { key: 'elo' as SortCol, label: 'ELO' },
                  { key: 'plan' as SortCol, label: 'Contrat' },
                  { key: '' as SortCol, label: 'Groupes' },
                  { key: 'role' as SortCol, label: 'Rôle' },
                  { key: 'status' as SortCol, label: 'Statut' },
                ].map(col => (
                  <th key={col.label}
                    onClick={col.key ? () => toggleSort(col.key) : undefined}
                    className={`text-left px-5 py-3.5 text-xs font-bold uppercase tracking-wider select-none ${
                      col.key ? 'cursor-pointer hover:text-white transition-colors' : ''
                    } ${sortCol === col.key && col.key ? 'text-[#C9A227]' : 'text-gray-500'}`}>
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.key && sortCol === col.key && (
                        sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                      )}
                    </span>
                  </th>
                ))}
                <th className="text-right px-5 py-3.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => {
                const lvlColor = LEVEL_COLOR[m.level] ?? '#6B7280';
                return (
                  <tr key={m.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#C9A227]/20 flex items-center justify-center text-[#C9A227] text-xs font-black shrink-0">
                          {m.username[0].toUpperCase()}
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${m.is_banned ? 'line-through text-gray-500' : 'text-white'}`}>{m.username}</p>
                          <p className="text-xs text-gray-500">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ color: lvlColor, backgroundColor: `${lvlColor}20` }}>
                        {LEVEL_LABEL[m.level] ?? m.level.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-300 font-mono">⭐ {m.elo}</td>
                    <td className="px-5 py-4">
                      <PlanPopover member={m} plans={plans} onAssign={assignPlan} saving={planSaving === m.id} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 flex-wrap">
                        {m.groups.map(g => (
                          <span key={g.id} className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ color: g.color, backgroundColor: `${g.color}20` }}>{g.name}</span>
                        ))}
                        <GroupsPopover member={m} allGroups={allGroups} onToggle={toggleGroup} toggling={toggling} />
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <RolePopover member={m} onChange={changeRole} />
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${m.is_banned ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                        {m.is_banned ? 'Banni' : 'Actif'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button onClick={() => toggleBan(m)} disabled={banning === m.id}
                        className={`text-xs font-semibold transition-colors ${m.is_banned ? 'text-green-400 hover:text-green-300' : 'text-red-400 hover:text-red-300'}`}>
                        {banning === m.id ? <Loader2 size={12} className="animate-spin inline" /> : m.is_banned ? 'Débannir' : 'Bannir'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
