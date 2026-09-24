'use client';

import { useState, useEffect, useCallback, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Loader2, UserPlus, UserMinus, Users2, MessageSquare, Search, SlidersHorizontal, X, Pencil, Check } from 'lucide-react';
import { getMyBox } from '@/lib/getMyBox';
import { getMemberEmails } from '@/lib/memberEmails';
import { softVar, textTint } from '@/lib/colorVars';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { ERROR_TITLE } from '@/lib/confirmDialog';

const INPUT_CLS = 'w-full min-h-11 px-3 py-2.5 rounded-ax-control bg-ax-surface border border-ax-input-border text-base sm:text-sm text-ax-text placeholder:text-ax-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface transition-colors';

const COLORS = [
  '#FFFFFF', '#8B5CF6', '#EC4899', '#EF4444',
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
// Puces de groupe en 10 px : teinte plus proche du texte que `textTint`, pour
// rester AA en thème clair même avec la couleur blanche par défaut (4,42:1 sinon).
const chipTint = (color: string) => `color-mix(in srgb, ${color} 30%, var(--ax-text))`;

const LEVEL_LABEL: Record<string, string> = { 'rx+': 'RX+', rx: 'RX', scaled: 'SCALED', foundations: 'FOUNDATIONS' };
// Même code couleur qu'avant (rx+ blanc, rx bleu, scaled vert, foundations violet), en jetons lisibles dans les deux thèmes (cf. Membres).
const LEVEL_COLOR: Record<string, string> = { 'rx+': 'var(--ax-text)', rx: 'var(--ax-info)', scaled: 'var(--ax-success)', foundations: 'var(--ax-purple)' };

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const { dialog, ask, inform } = useConfirmDialog();

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
    const box = await getMyBox(supabase);
    if (!box) { router.push('/login'); return; }

    const [{ data: grp }, { data: boxMembers }, { data: groups }] = await Promise.all([
      supabase.from('message_groups').select('id, name, color, wod_visibility_mode, members').eq('id', groupId).single(),
      supabase.from('box_members')
        .select('member_id, profiles(id, username, level, elo)')
        .eq('box_id', box.id).eq('status', 'active'),
      supabase.from('message_groups').select('id, name, color, members').eq('box_id', box.id),
    ]);

    if (!grp) { router.push('/groups'); return; }
    setGroup({ ...grp, wod_visibility_mode: grp.wod_visibility_mode ?? 'weekly' });
    setAllGroups(groups ?? []);

    const grpMemberIds = new Set<string>(grp.members ?? []);

    const membershipMap: Record<string, string[]> = {};
    for (const g of (groups ?? []) as any[]) {
      for (const mid of (g.members ?? [])) {
        if (!membershipMap[mid]) membershipMap[mid] = [];
        membershipMap[mid].push(g.id);
      }
    }
    const groupMap: Record<string, { id: string; name: string; color: string }> = {};
    for (const g of groups ?? []) groupMap[g.id] = g;

    const emails = await getMemberEmails(supabase, box.id);

    const toMember = (m: any): Member | null => {
      const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      if (!p) return null;
      const memberGroups = (membershipMap[p.id] ?? [])
        .map((gid: string) => groupMap[gid]).filter(Boolean);
      return { id: p.id, username: p.username ?? '?', level: p.level ?? 'rx', email: emails.get(p.id) ?? '', elo: p.elo ?? 1000, groups: memberGroups };
    };

    const allMapped = (boxMembers ?? []).map(toMember).filter(Boolean) as Member[];
    setAllMembers(allMapped);
    setMembers(allMapped.filter(m => grpMemberIds.has(m.id)));
    setLoading(false);
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  const inGroupIds = useMemo(() => new Set(members.map(m => m.id)), [members]);

  async function toggleMember(memberId: string) {
    setToggling(memberId);
    setError(null);
    const currentIds = members.map(m => m.id);
    const newIds = inGroupIds.has(memberId)
      ? currentIds.filter(id => id !== memberId)
      : [...currentIds, memberId];
    const { error: e } = await supabase
      .from('message_groups')
      .update({ members: newIds })
      .eq('id', groupId);
    if (e) { setError(e.message); } else {
      if (inGroupIds.has(memberId)) {
        setMembers(prev => prev.filter(m => m.id !== memberId));
      } else {
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

  function askDeleteGroup() {
    if (!group) return;
    ask({
      title: `Supprimer le groupe « ${group.name} » ?`,
      element: `${members.length} membre(s) en font partie.`,
      body: 'Les messages échangés dans ce groupe seront supprimés. Les formules qui y inscrivaient leurs membres ne le feront plus. Les WOD réservés à ce seul groupe deviendront visibles par tous les membres de la box.',
      confirmLabel: 'Supprimer le groupe',
      danger: true,
      run: deleteGroup,
    });
  }

  async function deleteGroup() {
    setDeleting(true);
    const { error: e } = await supabase.from('message_groups').delete().eq('id', groupId);
    // Jusqu'ici, un refus redirigeait quand même vers la liste, comme un succès.
    if (e) { setDeleting(false); inform({ kind: 'error', title: ERROR_TITLE, body: e.message }); return; }
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
      <Loader2 size={24} className="animate-spin text-ax-text" />
    </div>
  );
  if (!group) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      {dialog}
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/groups" aria-label="Retour aux groupes" className="text-ax-text-secondary hover:text-ax-text transition-colors"><ArrowLeft size={18} /></Link>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-ax-control flex items-center justify-center shrink-0" style={{ backgroundColor: softVar(group.color, 0.145) }}>
              <Users2 size={18} style={{ color: textTint(group.color) }} />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-xl font-medium uppercase tracking-wide text-ax-text break-words">{group.name}</h1>
              <div className="flex items-center gap-2">
                <p className="text-xs text-ax-text-muted">{members.length} membre(s)</p>
                <Badge variant={group.wod_visibility_mode === 'daily' ? 'warning' : 'success'} className="text-[10px] font-bold px-1.5 py-0.5">
                  {group.wod_visibility_mode === 'daily' ? 'Jour par jour' : 'Semaine'}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={startEditing}
            className="flex items-center gap-1.5 text-sm font-bold px-3 py-2 rounded-ax-control border border-ax-border text-ax-text-secondary hover:text-ax-text hover:border-ax-input-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface">
            <Pencil size={13} /> Modifier
          </button>
          <Link href={`/messages/new?group=${groupId}`}
            className="flex items-center gap-1.5 text-sm font-bold px-3 py-2 rounded-ax-control border border-ax-border text-ax-text-secondary hover:text-ax-text hover:border-ax-input-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface">
            <MessageSquare size={13} /> Message
          </Link>
          <button onClick={askDeleteGroup} disabled={deleting}
            className="text-xs font-bold px-3 py-2 rounded-ax-control border border-ax-danger text-ax-danger hover:bg-ax-danger-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface">
            {deleting ? <Loader2 size={12} className="animate-spin" /> : 'Supprimer'}
          </button>
        </div>
      </div>

      {/* Edit panel */}
      {editing && (
        <div className="bg-ax-surface border border-ax-input-border rounded-ax-card p-5 space-y-4">
          <p className="text-xs font-bold text-ax-text-muted uppercase tracking-wider">Modifier le groupe</p>
          <div>
            <label className="block text-xs font-semibold text-ax-text-secondary mb-1.5">Nom</label>
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className={INPUT_CLS}
              placeholder="Nom du groupe"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ax-text-secondary mb-2">Couleur</label>
            <div className="flex flex-wrap gap-2.5">
              {COLORS.map(c => (
                <button
                  key={c} type="button"
                  onClick={() => setEditColor(c)}
                  aria-pressed={editColor === c} aria-label={c}
                  className={`w-8 h-8 rounded-ax-control border border-ax-border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface ${editColor === c ? 'ring-2 ring-ax-text ring-offset-2 ring-offset-ax-surface scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ax-text-secondary mb-2">Diffusion des WODs</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditVisibility('daily')} aria-pressed={editVisibility === 'daily'}
                className={`flex-1 text-center text-xs font-bold px-3 py-2.5 rounded-ax-control border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface ${
                  editVisibility === 'daily'
                    ? 'border-ax-text bg-ax-surface-secondary text-ax-text'
                    : 'border-ax-border text-ax-text-muted hover:text-ax-text hover:border-ax-input-border'
                }`}>
                Jour par jour
              </button>
              <button type="button" onClick={() => setEditVisibility('weekly')} aria-pressed={editVisibility === 'weekly'}
                className={`flex-1 text-center text-xs font-bold px-3 py-2.5 rounded-ax-control border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface ${
                  editVisibility === 'weekly'
                    ? 'border-ax-text bg-ax-surface-secondary text-ax-text'
                    : 'border-ax-border text-ax-text-muted hover:text-ax-text hover:border-ax-input-border'
                }`}>
                Semaine entière
              </button>
            </div>
            <p className="text-[10px] text-ax-text-muted mt-1.5">
              {editVisibility === 'daily'
                ? 'Les membres ne voient que les WODs du jour (pas les jours futurs)'
                : 'Les membres voient tous les WODs de la semaine'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button variant="ax-white" size="ax-compact" className="h-10 min-h-10 px-4" onClick={saveGroup} disabled={saving || !editName.trim()}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Enregistrer
            </Button>
            <Button variant="ax-outline" size="ax-compact" className="h-10 min-h-10 px-4" onClick={() => setEditing(false)}>
              Annuler
            </Button>
          </div>
        </div>
      )}

      {error && <div className="bg-ax-danger-soft border border-ax-danger rounded-ax-control px-4 py-3 text-sm text-ax-danger">{error}</div>}

      {/* Members in group */}
      <div className="bg-ax-surface border border-ax-border rounded-ax-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-ax-border flex items-center justify-between">
          <p className="text-xs font-bold text-ax-text-muted uppercase tracking-wider">Membres du groupe</p>
          <span className="text-xs text-ax-text-muted">{members.length}</span>
        </div>
        {members.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-ax-text-muted">Aucun membre dans ce groupe.</div>
        ) : members.map(m => {
          const lvlColor = LEVEL_COLOR[m.level] ?? 'var(--ax-neutral)';
          return (
            <div key={m.id} className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-ax-border last:border-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0" style={{ color: textTint(group.color), backgroundColor: softVar(group.color, 0.08) }}>
                  {m.username[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ax-text break-words min-w-0">{m.username}</p>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-ax-badge" style={{ color: lvlColor, backgroundColor: softVar(lvlColor, 0.125) }}>{LEVEL_LABEL[m.level] ?? m.level.toUpperCase()}</span>
                  </div>
                  <p className="text-xs text-ax-text-muted">⭐ ELO {m.elo}</p>
                </div>
              </div>
              <button onClick={() => toggleMember(m.id)} disabled={toggling === m.id}
                className="flex items-center gap-1.5 text-xs font-bold text-ax-danger hover:underline transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface">
                {toggling === m.id ? <Loader2 size={12} className="animate-spin" /> : <UserMinus size={13} />}
                Retirer
              </button>
            </div>
          );
        })}
      </div>

      {/* Add members section */}
      <div className="bg-ax-surface border border-ax-border rounded-ax-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-ax-border">
          <p className="text-xs font-bold text-ax-text-muted uppercase tracking-wider">Ajouter des membres</p>
        </div>

        {/* Search + filter bar */}
        <div className="px-5 py-3 border-b border-ax-border space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ax-text-muted" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un membre…"
                className={`${INPUT_CLS} pl-8`}
              />
              {search && <button onClick={() => setSearch('')} aria-label="Effacer la recherche" className="absolute right-3 top-1/2 -translate-y-1/2 text-ax-text-muted hover:text-ax-text"><X size={12} /></button>}
            </div>
            <button onClick={() => setShowFilters(v => !v)} aria-expanded={showFilters}
              className={`flex items-center gap-1.5 px-3 min-h-11 rounded-ax-control text-xs font-bold border transition-colors ${showFilters || activeFilters > 0 ? 'border-ax-input-border text-ax-text bg-ax-surface-secondary' : 'border-ax-border text-ax-text-secondary hover:text-ax-text'}`}>
              <SlidersHorizontal size={13} />
              Filtres{activeFilters > 0 ? ` (${activeFilters})` : ''}
            </button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-2 pt-1">
              {/* Level filter */}
              <div className="flex flex-wrap items-center gap-1">
                {['', ...LEVELS].map(l => (
                  <button key={l} onClick={() => setFilterLevel(l)} aria-pressed={filterLevel === l}
                    className={`px-2.5 py-1 rounded-ax-control text-xs font-bold transition-colors ${filterLevel === l ? 'text-ax-text' : 'text-ax-text-muted hover:text-ax-text-secondary bg-ax-surface-secondary'}`}
                    style={filterLevel === l && l ? { backgroundColor: softVar(LEVEL_COLOR[l], 0.145), color: LEVEL_COLOR[l] } : filterLevel === l ? { backgroundColor: 'var(--ax-hover)', color: 'var(--ax-text)' } : {}}>
                    {l ? LEVEL_LABEL[l] : 'Tous niveaux'}
                  </button>
                ))}
              </div>

              {/* ELO sort */}
              <div className="flex flex-wrap items-center gap-1 ml-auto">
                <span className="text-xs text-ax-text-muted">ELO :</span>
                {[['', 'Défaut'], ['desc', '↓ Haut'], ['asc', '↑ Bas']].map(([val, label]) => (
                  <button key={val} onClick={() => setEloSort(val as any)} aria-pressed={eloSort === val}
                    className={`px-2.5 py-1 rounded-ax-control text-xs font-bold transition-colors ${eloSort === val ? 'bg-ax-surface-secondary text-ax-text' : 'text-ax-text-muted hover:text-ax-text-secondary bg-ax-surface-secondary'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Group filter */}
              {allGroups.filter(g => g.id !== groupId).length > 0 && (
                <div className="w-full">
                  <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
                    className={INPUT_CLS}>
                    <option value="" className="bg-ax-surface text-ax-text">Tous les groupes</option>
                    {allGroups.filter(g => g.id !== groupId).map(g => (
                      <option key={g.id} value={g.id} className="bg-ax-surface text-ax-text">{g.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {activeFilters > 0 && (
                <button onClick={() => { setFilterLevel(''); setFilterGroup(''); setEloSort(''); }}
                  className="text-xs text-ax-danger hover:underline flex items-center gap-1">
                  <X size={11} /> Réinitialiser
                </button>
              )}
            </div>
          )}
        </div>

        {filteredNotInGroup.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-ax-text-muted">
            {allMembers.filter(m => !inGroupIds.has(m.id)).length === 0 ? 'Tous les membres sont déjà dans ce groupe.' : 'Aucun résultat pour ces filtres.'}
          </div>
        ) : filteredNotInGroup.map(m => {
          const lvlColor = LEVEL_COLOR[m.level] ?? 'var(--ax-neutral)';
          return (
            <div key={m.id} className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-ax-border last:border-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full shrink-0 bg-ax-surface-secondary flex items-center justify-center text-xs font-black text-ax-text-secondary">
                  {m.username[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-ax-text break-words min-w-0">{m.username}</p>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-ax-badge" style={{ color: lvlColor, backgroundColor: softVar(lvlColor, 0.125) }}>{LEVEL_LABEL[m.level] ?? m.level.toUpperCase()}</span>
                    {m.groups.map(g => (
                      <span key={g.id} className="text-[10px] font-bold px-1.5 py-0.5 rounded-ax-badge break-words" style={{ color: chipTint(g.color), backgroundColor: softVar(g.color, 0.125) }}>{g.name}</span>
                    ))}
                  </div>
                  <p className="text-xs text-ax-text-muted">⭐ ELO {m.elo}</p>
                </div>
              </div>
              <button onClick={() => toggleMember(m.id)} disabled={toggling === m.id}
                className="flex items-center gap-1.5 text-xs font-bold text-ax-text hover:text-ax-text-secondary transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface">
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
