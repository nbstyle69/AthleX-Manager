'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, Search, SlidersHorizontal, X, Loader2, ChevronDown, ChevronUp, Check, Trash2, CreditCard, ShieldCheck, Crown } from 'lucide-react';
import { getMyBox } from '@/lib/getMyBox';
import { softVar, textTint } from '@/lib/colorVars';
import HelpButton from '@/components/help/HelpButton';
import { getMemberEmails } from '@/lib/memberEmails';
import AthleteSheet from '@/components/dashboard/AthleteSheet';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { ERROR_TITLE } from '@/lib/confirmDialog';
import { askDeleteWithSubscriptions, countOf } from '@/lib/deleteWithSubscriptions';
import {
  eloChoiceOf,
  sortMembers,
  sortStateForEloChoice,
  type EloChoice,
  type MemberSortCol,
  type SortDir,
} from '@/lib/memberSort';

const LEVELS = ['rx+', 'rx', 'scaled', 'foundations'];
const LEVEL_LABEL: Record<string, string> = { 'rx+': 'RX+', rx: 'RX', scaled: 'SCALED', foundations: 'FOUNDATIONS' };
// Même code couleur qu'avant (rx+ blanc, rx bleu, scaled vert, foundations violet), en jetons lisibles dans les deux thèmes.
const LEVEL_COLOR: Record<string, string> = { 'rx+': 'var(--ax-text)', rx: 'var(--ax-info)', scaled: 'var(--ax-success)', foundations: 'var(--ax-purple)' };

interface MembershipPlan {
  id: string;
  name: string;
  max_sessions_per_week: number | null;
  color: string;
  price_cents: number;
}

interface Member {
  id: string; username: string; level: string; elo: number;
  email: string; joined_at: string; is_banned: boolean;
  plan_id: string | null;
  role: 'member' | 'coach' | 'owner';
  groups: { id: string; name: string; color: string }[];
}

// Menu d'une cellule du tableau, ouvert au-dessus de la page (portail) et non
// plus dans le conteneur défilant du tableau, qui le coupait. Le voile
// transparent garde le comportement d'avant : un clic à côté ferme le menu
// sans rien activer dessous. Échap ferme aussi ; le focus revient au bouton.
function TableMenu({ open, onOpenChange, trigger, align, className, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  align: 'start' | 'end';
  className: string;
  children: React.ReactNode;
}) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <div>
          <div className="fixed inset-0 z-40" onClick={() => onOpenChange(false)} />
          <Popover.Content side="bottom" align={align} sideOffset={4} collisionPadding={8}
            onPointerDownOutside={e => e.preventDefault()}
            className={`z-50 bg-ax-surface border border-ax-border rounded-ax-control shadow-ax-panel py-1 overflow-hidden ${className}`}>
            {children}
          </Popover.Content>
        </div>
      </Popover.Portal>
    </Popover.Root>
  );
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
    <div>
      <TableMenu open={open} onOpenChange={setOpen} align="end" className="min-w-[180px]" trigger={
        <button
          className="flex items-center gap-1 text-xs font-semibold text-ax-text-secondary hover:text-ax-text border border-ax-border hover:border-ax-input-border px-2.5 py-1.5 rounded-ax-control transition-colors">
          Groupes <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      }>
            {allGroups.length === 0 && <p className="px-3 py-2 text-xs text-ax-text-muted">Aucun groupe</p>}
            {allGroups.map(g => {
              const inGroup = memberGroupIds.has(g.id);
              const isLoading = toggling === `${member.id}-${g.id}`;
              return (
                <button key={g.id} onClick={() => onToggle(member.id, g.id, inGroup)}
                  disabled={isLoading}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-ax-hover transition-colors text-left">
                  {isLoading ? <Loader2 size={12} className="animate-spin text-ax-text-secondary" /> : (
                    <div className={`w-4 h-4 rounded flex items-center justify-center border ${inGroup ? 'border-transparent' : 'border-ax-input-border'}`}
                      style={inGroup ? { backgroundColor: g.color } : {}}>
                      {inGroup && <Check size={10} color="var(--ax-accent-foreground)" strokeWidth={3} />}
                    </div>
                  )}
                  <span className="flex-1 font-semibold" style={{ color: inGroup ? textTint(g.color) : 'var(--ax-text-secondary)' }}>{g.name}</span>
                </button>
              );
            })}
      </TableMenu>
    </div>
  );
}

function PlanGroupsPopover({ groupIds, allGroups, onToggle, saving }: {
  groupIds: string[];
  allGroups: { id: string; name: string; color: string }[];
  onToggle: (groupId: string, inGroup: boolean) => void;
  saving: string | null;
}) {
  const [open, setOpen] = useState(false);
  const set = new Set(groupIds);
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-[11px] font-semibold text-ax-text-secondary hover:text-ax-text border border-ax-border hover:border-ax-input-border px-2 py-1 rounded-ax-control transition-colors">
        Cours inclus{groupIds.length > 0 ? ` (${groupIds.length})` : ''}
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-ax-surface border border-ax-border rounded-ax-control shadow-ax-panel min-w-[190px] py-1 overflow-hidden">
            {allGroups.length === 0 && <p className="px-3 py-2 text-xs text-ax-text-muted">Aucun groupe. Crée des groupes de cours d'abord.</p>}
            {allGroups.map(g => {
              const inGroup = set.has(g.id);
              const isLoading = saving === g.id;
              return (
                <button key={g.id} onClick={() => onToggle(g.id, inGroup)} disabled={isLoading}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-ax-hover transition-colors text-left">
                  {isLoading ? <Loader2 size={12} className="animate-spin text-ax-text-secondary" /> : (
                    <div className={`w-4 h-4 rounded flex items-center justify-center border ${inGroup ? 'border-transparent' : 'border-ax-input-border'}`}
                      style={inGroup ? { backgroundColor: g.color } : {}}>
                      {inGroup && <Check size={10} color="var(--ax-accent-foreground)" strokeWidth={3} />}
                    </div>
                  )}
                  <span className="flex-1 font-semibold" style={{ color: inGroup ? textTint(g.color) : 'var(--ax-text-secondary)' }}>{g.name}</span>
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
    <div>
      <TableMenu open={open} onOpenChange={setOpen} align="start" className="min-w-[180px]" trigger={
        <button
          disabled={saving}
          className="flex items-center gap-2 min-w-[8rem] max-w-[13rem] text-left text-xs font-semibold border border-ax-border hover:border-ax-input-border px-2.5 py-1.5 rounded-ax-control transition-colors disabled:opacity-50"
          style={currentPlan ? { color: textTint(currentPlan.color), borderColor: softVar(currentPlan.color, 0.25), backgroundColor: softVar(currentPlan.color, 0.063) } : { color: 'var(--ax-text-secondary)' }}
        >
          {currentPlan && <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: currentPlan.color }} />}
          {currentPlan ? currentPlan.name : 'Illimité'}
          <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      }>
            <button
              onClick={() => { onAssign(member.id, null); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-ax-hover transition-colors text-left ${!member.plan_id ? 'text-ax-text' : 'text-ax-text-secondary'}`}
            >
              <div className={`w-4 h-4 rounded flex items-center justify-center border ${!member.plan_id ? 'border-transparent bg-ax-surface-secondary' : 'border-ax-input-border'}`}>
                {!member.plan_id && <Check size={10} className="text-ax-text" strokeWidth={3} />}
              </div>
              <span className="flex-1 font-semibold">Illimité</span>
            </button>
            {plans.map(p => {
              const selected = member.plan_id === p.id;
              return (
                <button key={p.id}
                  onClick={() => { onAssign(member.id, p.id); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-ax-hover transition-colors text-left"
                >
                  <div className={`w-4 h-4 rounded flex items-center justify-center border ${selected ? 'border-transparent' : 'border-ax-input-border'}`}
                    style={selected ? { backgroundColor: p.color } : {}}>
                    {selected && <Check size={10} color="var(--ax-accent-foreground)" strokeWidth={3} />}
                  </div>
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="flex-1 font-semibold" style={{ color: selected ? textTint(p.color) : 'var(--ax-text-secondary)' }}>
                    {p.name}
                  </span>
                  {p.max_sessions_per_week && (
                    <span className="text-[10px] text-ax-text-muted">{p.max_sessions_per_week}x/sem</span>
                  )}
                </button>
              );
            })}
      </TableMenu>
    </div>
  );
}

const ROLES: { key: 'member' | 'coach' | 'owner'; label: string; icon: any; color: string }[] = [
  { key: 'member', label: 'Membre', icon: Users, color: 'var(--ax-neutral)' },
  { key: 'coach',  label: 'Coach',  icon: ShieldCheck, color: 'var(--ax-info)' },
  { key: 'owner',  label: 'Owner',  icon: Crown, color: 'var(--ax-text)' },
];

function RolePopover({ member, onChange }: {
  member: Member;
  onChange: (member: Member, role: 'member' | 'coach' | 'owner') => void;
}) {
  const [open, setOpen] = useState(false);
  const current = ROLES.find(r => r.key === member.role) ?? ROLES[0];
  const Icon = current.icon;
  return (
    <div>
      <TableMenu open={open} onOpenChange={setOpen} align="start" className="min-w-[150px]" trigger={
        <button disabled={member.is_banned}
          className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-ax-control border transition-colors ${member.is_banned ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:border-ax-input-border'}`}
          style={{ color: current.color, borderColor: softVar(current.color, 0.25), backgroundColor: softVar(current.color, 0.063) }}>
          <Icon size={12} />
          {current.label}
          <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      }>
            {ROLES.map(r => {
              const selected = member.role === r.key;
              const RIcon = r.icon;
              return (
                <button key={r.key}
                  onClick={() => { onChange(member, r.key); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-ax-hover transition-colors text-left">
                  <div className={`w-4 h-4 rounded flex items-center justify-center border ${selected ? 'border-transparent' : 'border-ax-input-border'}`}
                    style={selected ? { backgroundColor: r.color } : {}}>
                    {selected && <Check size={10} color="var(--ax-accent-foreground)" strokeWidth={3} />}
                  </div>
                  <RIcon size={12} style={{ color: selected ? r.color : 'var(--ax-text-muted)' }} />
                  <span className="flex-1 font-semibold" style={{ color: selected ? r.color : 'var(--ax-text-secondary)' }}>{r.label}</span>
                </button>
              );
            })}
      </TableMenu>
    </div>
  );
}

export default function MembersPage() {
  const router = useRouter();
  const supabase = createClient();
  const { dialog, ask, inform } = useConfirmDialog();

  const [members,    setMembers]    = useState<Member[]>([]);
  const [allGroups,  setAllGroups]  = useState<{ id: string; name: string; color: string }[]>([]);
  const [boxId,      setBoxId]      = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [toggling,   setToggling]   = useState<string | null>(null);
  const [banning,    setBanning]    = useState<string | null>(null);
  const [plans,      setPlans]      = useState<MembershipPlan[]>([]);
  const [planGroups, setPlanGroups]  = useState<Record<string, string[]>>({});
  const [planGroupSaving, setPlanGroupSaving] = useState<string | null>(null);
  const [planSaving, setPlanSaving]  = useState<string | null>(null);
  const [showPlans,  setShowPlans]   = useState(false);
  const [sheetMemberId, setSheetMemberId] = useState<string | null>(null);

  // Les listes nominatives des Statistiques pointent ici avec `?q=<pseudo>` :
  // sans pré-remplissage, un « voir la fiche » retomberait sur la liste entière.
  const [search,      setSearch]      = useState(
    () => (typeof window === 'undefined'
      ? ''
      : new URLSearchParams(window.location.search).get('q') ?? ''),
  );
  const [filterLevel, setFilterLevel] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  type SortCol = MemberSortCol;
  const [sortCol, setSortCol] = useState<SortCol>('');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const eloSort = eloChoiceOf({ sortCol, sortDir });

  function chooseEloSort(choice: EloChoice) {
    const next = sortStateForEloChoice(choice);
    setSortCol(next.sortCol);
    setSortDir(next.sortDir);
  }

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
    const box = await getMyBox(supabase);
    if (!box) { router.push('/login'); return; }
    setBoxId(box.id);

    const [{ data: membersRaw }, { data: groups }, { data: groupMemberships }, { data: plansData }, { data: planGroupData }] = await Promise.all([
      supabase.from('box_members')
        .select('member_id, status, joined_at, role, profile:profiles(id, username, level, elo)')
        .eq('box_id', box.id).in('status', ['active', 'banned'])
        .order('joined_at', { ascending: false }),
      supabase.from('message_groups').select('id, name, color').eq('box_id', box.id),
      supabase.from('message_group_members').select('member_id, group_id'),
      supabase.from('membership_plans').select('id, name, max_sessions_per_week, color, price_cents').eq('box_id', box.id).order('sort_order', { ascending: true }).order('max_sessions_per_week', { ascending: true, nullsFirst: false }),
      supabase.from('membership_plan_groups').select('plan_id, group_id'),
    ]);

    setPlans((plansData ?? []) as MembershipPlan[]);

    const pgMap: Record<string, string[]> = {};
    for (const pg of (planGroupData ?? []) as { plan_id: string; group_id: string }[]) {
      if (!pgMap[pg.plan_id]) pgMap[pg.plan_id] = [];
      pgMap[pg.plan_id].push(pg.group_id);
    }
    setPlanGroups(pgMap);

    setAllGroups(groups ?? []);

    const membershipMap: Record<string, string[]> = {};
    for (const gm of groupMemberships ?? []) {
      if (!membershipMap[gm.member_id]) membershipMap[gm.member_id] = [];
      membershipMap[gm.member_id].push(gm.group_id);
    }
    const groupMap: Record<string, { id: string; name: string; color: string }> = {};
    for (const g of groups ?? []) groupMap[g.id] = g;

    const emails = await getMemberEmails(supabase, box.id);

    // `plan_id` est nominatif : il ne se lit plus sur la table (lot 6), mais par
    // la RPC réservée au gérant et au co-gérant.
    const { data: billingRows } = await supabase.rpc('get_box_billing', { p_box_id: box.id });
    const planIdByMember: Record<string, string | null> = {};
    for (const b of (billingRows ?? []) as { member_id: string | null; plan_id: string | null }[]) {
      if (b.member_id) planIdByMember[b.member_id] = b.plan_id;
    }

    const parsed: Member[] = (membersRaw ?? []).map((m: any) => {
      const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
      if (!p) return null;
      return {
        id: p.id, username: p.username ?? '?', level: p.level ?? 'rx',
        // Pas de repli `?? 1000` : `profiles.elo` est NOT NULL DEFAULT 1000, donc
        // un repli ne pouvait masquer qu'une faute de lecture — et c'est ce qu'il
        // a fait pendant des mois (`p.eo`), en affichant 1000 à tout le monde.
        elo: p.elo, email: emails.get(p.id) ?? '', joined_at: m.joined_at,
        is_banned: m.status === 'banned',
        plan_id: planIdByMember[p.id] ?? null,
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
    const coOwner = members.find(m => m.role === 'owner' && m.id !== member.id);
    ask(newRole === 'owner'
      ? {
          title: `Nommer ${member.username} co-gérant ?`,
          element: `${labels[member.role]} → Owner`,
          body: 'Il aura les mêmes accès que toi, facturation comprise.'
            + (coOwner ? ` ${coOwner.username} redeviendra simple membre.` : ''),
          confirmLabel: 'Nommer co-gérant',
          run: () => applyRole(member, newRole),
        }
      : {
          title: `Changer le rôle de ${member.username} ?`,
          element: `${labels[member.role]} → ${labels[newRole]}`,
          body: newRole === 'coach'
            ? 'Il pourra gérer le planning et les WOD, mais pas l’argent.'
            : 'Il perd les accès de gestion.',
          confirmLabel: 'Changer le rôle',
          run: () => applyRole(member, newRole),
        });
  }

  async function applyRole(member: Member, newRole: 'member' | 'coach' | 'owner') {
    if (!boxId) return;
    const errors: string[] = [];

    // If promoting to owner, demote the current owner first (prevent double ownership)
    if (newRole === 'owner') {
      const currentOwner = members.find(m => m.role === 'owner' && m.id !== member.id);
      if (currentOwner) {
        const { error } = await supabase.from('box_members').update({ role: 'member' }).eq('member_id', currentOwner.id).eq('box_id', boxId);
        if (error) errors.push(error.message);
      }
    }

    const { error } = await supabase.from('box_members').update({ role: newRole }).eq('member_id', member.id).eq('box_id', boxId);
    if (error) errors.push(error.message);
    // Jusqu'ici, un refus affichait quand même le nouveau rôle.
    if (errors.length) { inform({ kind: 'error', title: ERROR_TITLE, body: errors.join('\n') }); return; }
    setMembers(prev => prev.map(m => {
      if (m.id === member.id) return { ...m, role: newRole };
      if (newRole === 'owner' && m.role === 'owner') return { ...m, role: 'member' };
      return m;
    }));
  }

  async function toggleBan(member: Member) {
    if (!boxId) return;
    if (!member.is_banned) { askBan(member); return; }
    setBanning(member.id);
    await supabase.from('box_members').update({ status: 'active' }).eq('member_id', member.id).eq('box_id', boxId);
    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, is_banned: false } : m));
    setBanning(null);
  }

  // Bannir arrête aussi l'abonnement en cours (S4) : la route le fait avant de
  // bannir ; si Stripe refuse, rien n'est écrit.
  function askBan(member: Member) {
    ask({
      title: `Bannir ${member.username} ?`,
      element: member.email || undefined,
      body: 'Si ce membre a un abonnement en cours (Stripe ou au comptoir), l’abonnement est arrêté aujourd’hui, sans remboursement, et le membre reçoit un e-mail. Ses réservations à venir sont annulées. Débannir ne relancera pas l’abonnement.',
      confirmLabel: 'Bannir le membre',
      danger: true,
      run: () => banMember(member),
    });
  }

  async function banMember(member: Member) {
    let data: { error?: string; warning?: string } = {};
    let ok = false;
    try {
      const res = await fetch('/api/members/ban', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ box_id: boxId, member_id: member.id }),
      });
      ok = res.ok;
      data = await res.json().catch(() => ({}));
    } catch (e: any) {
      data = { error: e?.message };
    }
    if (!ok) { inform({ kind: 'error', title: ERROR_TITLE, body: data.error ?? 'Le bannissement n’a pas été enregistré.' }); return; }
    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, is_banned: true } : m));
    if (data.warning) inform({ kind: 'info', title: 'Membre banni', body: data.warning });
  }

  async function assignPlan(memberId: string, planId: string | null) {
    if (!boxId) return;
    setPlanSaving(memberId);
    // `plan_id` est une colonne de facturation : écrite par la route serveur.
    let data: { error?: string } = {};
    let ok = false;
    try {
      const res = await fetch('/api/members/assign-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ box_id: boxId, member_id: memberId, plan_id: planId }),
      });
      ok = res.ok;
      data = await res.json().catch(() => ({}));
    } catch (e: any) {
      data = { error: e?.message };
    }
    setPlanSaving(null);
    // Jusqu'ici, un refus affichait quand même la nouvelle formule.
    if (!ok) { inform({ kind: 'error', title: ERROR_TITLE, body: data.error ?? 'La formule n’a pas été modifiée.' }); return; }
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, plan_id: planId } : m));
  }

  async function togglePlanGroup(planId: string, groupId: string, inGroup: boolean) {
    setPlanGroupSaving(`${planId}-${groupId}`);
    if (inGroup) {
      await supabase.from('membership_plan_groups').delete().eq('plan_id', planId).eq('group_id', groupId);
      setPlanGroups(prev => ({ ...prev, [planId]: (prev[planId] ?? []).filter(g => g !== groupId) }));
    } else {
      await supabase.from('membership_plan_groups').insert({ plan_id: planId, group_id: groupId });
      setPlanGroups(prev => ({ ...prev, [planId]: [...(prev[planId] ?? []), groupId] }));
    }
    setPlanGroupSaving(null);
  }

  // La route compte d'abord les abonnements Stripe actifs (S4, B5).
  function askDeletePlan(plan: MembershipPlan) {
    const count = members.filter(m => m.plan_id === plan.id).length;
    return askDeleteWithSubscriptions({
      ask, inform, kind: 'plan',
      url: '/api/membership-plans/delete', payload: { plan_id: plan.id },
      title: `Supprimer la formule « ${plan.name} » (${plan.price_cents > 0 ? `${(plan.price_cents / 100).toFixed(2)} €/mois` : 'Gratuit'}) ?`,
      element: count <= 1 ? `${count} membre y est rattaché.` : `${count} membres y sont rattachés.`,
      body: 'Ils n’auront plus de limite de séances. Les invitations en attente avec cette formule n’en auront plus. Pour la retirer de la vente sans toucher aux membres, désactive-la plutôt dans Formules.',
      confirmLabel: 'Supprimer la formule',
      deactivate: () => deactivatePlan(plan.id),
      onDone: () => {
        setPlans(prev => prev.filter(p => p.id !== plan.id));
        setMembers(prev => prev.map(m => m.plan_id === plan.id ? { ...m, plan_id: null } : m));
      },
    });
  }

  // « Désactiver » (sans appel Stripe) : comme la bascule de Formules.
  async function deactivatePlan(planId: string) {
    const { data, error } = await supabase
      .from('membership_plans').update({ is_active: false }).eq('id', planId).select('id');
    if (error || !data?.length) {
      inform({ kind: 'error', title: ERROR_TITLE, body: error?.message ?? 'La formule n’a pas été modifiée.' });
    }
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
    return sortMembers(
      list,
      { sortCol, sortDir },
      planId => plans.find(p => p.id === planId)?.name ?? '',
    );
  }, [members, search, filterLevel, filterGroup, sortCol, sortDir, plans]);

  const activeFilters = [filterLevel, filterGroup, eloSort].filter(Boolean).length;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Loader2 size={28} className="animate-spin text-ax-text" />
    </div>
  );

  return (
    <div className="space-y-6">
      {dialog}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-medium uppercase tracking-wide text-ax-text">Membres</h1>
            <HelpButton />
          </div>
          <p className="text-sm text-ax-text-secondary mt-1">{filtered.length} / {countOf(members.length, 'membre', 'membres')}</p>
        </div>
        <button onClick={() => setShowPlans(v => !v)} aria-pressed={showPlans}
          className={`flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-ax-control border transition-colors ${showPlans ? 'border-ax-input-border text-ax-text bg-ax-surface-secondary' : 'border-ax-border text-ax-text-secondary hover:text-ax-text hover:bg-ax-hover'}`}>
          <CreditCard size={16} />
          Contrats
        </button>
      </div>

      {/* Plans management panel */}
      {showPlans && (
        <div className="bg-ax-surface border border-ax-border rounded-ax-card p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 basis-[16rem]">
              <h3 className="text-sm font-bold text-ax-text">Contrats / Abonnements</h3>
              <p className="text-xs text-ax-text-muted mt-1">Assignez une formule à un membre et gérez les groupes associés. La <strong className="text-ax-text-secondary">création et l'édition des formules</strong> se font désormais dans <strong className="text-ax-text-secondary">Offres &amp; Programmes</strong>.</p>
            </div>
            <Link href="/plans" className="flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-ax-control bg-ax-surface-secondary hover:bg-ax-hover text-ax-text text-xs font-bold transition-colors whitespace-nowrap">
              <CreditCard size={13} /> Gérer les formules
            </Link>
          </div>

          {/* Existing plans */}
          <div className="space-y-2">
            {plans.map(p => (
              <div key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-ax-surface-secondary rounded-ax-control px-4 py-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <span className="text-sm font-semibold text-ax-text flex-1 min-w-[8rem] break-words">{p.name}</span>
                <span className={`text-xs font-bold ${p.price_cents > 0 ? 'text-ax-text' : 'text-ax-text-muted'}`}>
                  {p.price_cents > 0 ? `${(p.price_cents / 100).toFixed(2)} €/mois` : 'Gratuit'}
                </span>
                <span className="text-xs text-ax-text-secondary">
                  {p.max_sessions_per_week ? `${p.max_sessions_per_week}x / semaine` : 'Illimité'}
                </span>
                <span className="text-[10px] text-ax-text-muted">
                  {members.filter(m => m.plan_id === p.id).length} membre(s)
                </span>
                <PlanGroupsPopover
                  groupIds={planGroups[p.id] ?? []}
                  allGroups={allGroups}
                  onToggle={(gid, inGroup) => togglePlanGroup(p.id, gid, inGroup)}
                  saving={planGroupSaving?.startsWith(`${p.id}-`) ? planGroupSaving.slice(p.id.length + 1) : null}
                />
                <button onClick={() => askDeletePlan(p)} aria-label="Supprimer ce contrat" className="inline-flex items-center justify-center w-8 h-8 rounded-ax-control hover:bg-ax-danger-soft text-ax-text-muted hover:text-ax-danger transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {plans.length === 0 && (
              <p className="text-xs text-ax-text-muted italic">Aucun contrat créé. Tous les membres sont en accès illimité. Crée une formule dans « Offres &amp; Programmes ».</p>
            )}
          </div>
        </div>
      )}

      {/* Search + filters */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ax-text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par nom ou email…"
              className="w-full bg-ax-surface border border-ax-border rounded-ax-control pl-9 pr-3 py-2.5 text-sm text-ax-text placeholder:text-ax-text-muted focus:outline-none focus:border-ax-focus transition-colors" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ax-text-muted hover:text-ax-text"><X size={13} /></button>}
          </div>
          <button onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-ax-control text-sm font-bold border transition-colors ${showFilters || activeFilters > 0 ? 'border-ax-input-border text-ax-text bg-ax-surface-secondary' : 'bg-ax-surface border-ax-border text-ax-text-secondary hover:text-ax-text'}`}>
            <SlidersHorizontal size={14} />
            Filtres{activeFilters > 0 ? ` (${activeFilters})` : ''}
          </button>
        </div>

        {showFilters && (
          <div className="bg-ax-surface border border-ax-border rounded-ax-control px-4 py-3 flex flex-wrap gap-3 items-center">
            {/* Level */}
            <div className="flex flex-wrap items-center gap-1">
              {['', ...LEVELS].map(l => (
                <button key={l} onClick={() => setFilterLevel(l)}
                  className={`px-2.5 py-1 rounded-ax-control text-xs font-bold transition-colors ${filterLevel === l ? '' : 'text-ax-text-muted hover:text-ax-text-secondary bg-ax-surface-secondary'}`}
                  aria-pressed={filterLevel === l}
                  style={filterLevel === l ? (l ? { backgroundColor: softVar(LEVEL_COLOR[l], 0.145), color: LEVEL_COLOR[l] } : { backgroundColor: 'var(--ax-hover)', color: 'var(--ax-text)' }) : {}}>
                  {l ? LEVEL_LABEL[l] : 'Tous'}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-ax-surface-secondary" />

            {/* ELO sort */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-ax-text-muted font-semibold">ELO :</span>
              {([['', 'Défaut'], ['desc', '↓ Haut'], ['asc', '↑ Bas']] as [EloChoice, string][]).map(([val, label]) => (
                <button key={val} onClick={() => chooseEloSort(val)}
                  className={`px-2.5 py-1 rounded-ax-control text-xs font-bold transition-colors ${eloSort === val ? 'bg-ax-surface-secondary text-ax-text' : 'text-ax-text-muted hover:text-ax-text-secondary bg-ax-surface-secondary'}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-ax-surface-secondary" />

            {/* Group filter */}
            <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
              className="bg-ax-surface-secondary border border-ax-border rounded-ax-control px-2.5 py-1 text-xs text-ax-text focus:outline-none focus:border-ax-focus transition-colors">
              <option value="" className="bg-ax-surface text-ax-text">Tous les groupes</option>
              {allGroups.map(g => <option key={g.id} value={g.id} className="bg-ax-surface text-ax-text">{g.name}</option>)}
            </select>

            {activeFilters > 0 && (
              <button onClick={() => { setFilterLevel(''); setFilterGroup(''); chooseEloSort(''); }}
                className="ml-auto text-xs text-ax-danger hover:underline flex items-center gap-1">
                <X size={11} /> Réinitialiser
              </button>
            )}
          </div>
        )}
      </div>

      {!members.length ? (
        <div className="bg-ax-surface border border-ax-border rounded-ax-card p-12 text-center">
          <Users size={40} className="text-ax-text-muted mx-auto mb-4" />
          <p className="text-ax-text font-bold mb-1">Aucun membre</p>
          <p className="text-sm text-ax-text-muted">Les membres rejoignent votre box via le code invitation.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-ax-surface border border-ax-border rounded-ax-card p-10 text-center text-sm text-ax-text-muted">
          Aucun résultat pour ces filtres.
        </div>
      ) : (
        <div className="bg-ax-surface border border-ax-border rounded-ax-card overflow-x-auto" data-testid="tableau-membres">
          <table className="w-full min-w-[60rem]">
            <thead>
              <tr className="border-b border-ax-border">
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
                    className={`text-left px-4 py-3.5 text-xs font-bold uppercase tracking-wider select-none ${
                      col.key ? 'cursor-pointer hover:text-ax-text transition-colors' : ''
                    } ${sortCol === col.key && col.key ? 'text-ax-text' : 'text-ax-text-muted'}`}>
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.key && sortCol === col.key && (
                        sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                      )}
                    </span>
                  </th>
                ))}
                <th className="text-right px-4 py-3.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => {
                const lvlColor = LEVEL_COLOR[m.level] ?? 'var(--ax-neutral)';
                return (
                  <tr key={m.id} className="border-b border-ax-border last:border-0 hover:bg-ax-hover transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-ax-surface-secondary flex items-center justify-center text-ax-text text-xs font-black shrink-0">
                          {m.username[0].toUpperCase()}
                        </div>
                        <div className="min-w-[10rem]">
                          <p className={`text-sm font-semibold break-words ${m.is_banned ? 'line-through text-ax-text-muted' : 'text-ax-text'}`}>{m.username}</p>
                          <p className="text-xs text-ax-text-muted [overflow-wrap:anywhere]">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-ax-badge" style={{ color: lvlColor, backgroundColor: softVar(lvlColor, 0.125) }}>
                        {LEVEL_LABEL[m.level] ?? m.level.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-ax-text-secondary font-mono">⭐ {m.elo}</td>
                    <td className="px-4 py-4">
                      <PlanPopover member={m} plans={plans} onAssign={assignPlan} saving={planSaving === m.id} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1 flex-wrap min-w-[9rem]">
                        {m.groups.map(g => (
                          <span key={g.id} className="text-[10px] font-bold px-1.5 py-0.5 rounded-ax-badge break-words" style={{ color: textTint(g.color), backgroundColor: softVar(g.color, 0.125) }}>{g.name}</span>
                        ))}
                        <GroupsPopover member={m} allGroups={allGroups} onToggle={toggleGroup} toggling={toggling} />
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <RolePopover member={m} onChange={changeRole} />
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-ax-badge border border-current ${m.is_banned ? 'bg-ax-danger-soft text-ax-danger' : 'bg-ax-success-soft text-ax-success'}`}>
                        {m.is_banned ? 'Banni' : 'Actif'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right whitespace-nowrap">
                      <button onClick={() => setSheetMemberId(m.id)}
                        className="text-xs font-semibold text-ax-text-secondary hover:text-ax-text transition-colors mr-3">
                        Fiche
                      </button>
                      <button onClick={() => toggleBan(m)} disabled={banning === m.id}
                        className={`text-xs font-semibold transition-colors ${m.is_banned ? 'text-ax-success hover:underline' : 'text-ax-danger hover:underline'}`}>
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

      {sheetMemberId && (
        <AthleteSheet memberId={sheetMemberId} onClose={() => setSheetMemberId(null)} />
      )}
    </div>
  );
}
