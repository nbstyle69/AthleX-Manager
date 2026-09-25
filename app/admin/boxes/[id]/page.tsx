'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Building2, ArrowLeft, Users, Dumbbell, Trophy, Crown,
  CheckCircle, XCircle, Calendar, Clock, Shield, Hash,
  Pencil, Save, X as XIcon, Image as ImageIcon, RefreshCw, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import AutoProgrammingBlock from '@/components/admin/AutoProgrammingBlock';
import BoxArchiveBlock from '@/components/admin/BoxArchiveBlock';
import { isTrack, revealFromRow, type Track } from '@/lib/autoProgramming';
import { formatCap } from '@/lib/wodFields';
import { FREE_TIER, formatExpiredSince, planTierClasses } from '@/lib/boxPlanTier';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { ADMIN_LEVEL_COLOR, PURPLE_SOFT, SUB_ORANGE_SOFT, SUB_ORANGE_TEXT } from '@/components/admin/adminTokens';

const TABS = ['Infos', 'Membres', 'Whiteboard', 'Tournois'];

const FIELD_LABEL = 'block text-xs font-bold text-ax-text-secondary mb-1';
const TEXTAREA = 'w-full min-w-0 rounded-ax-control border border-ax-input-border bg-ax-surface px-3 py-2.5 text-base text-ax-text placeholder:text-ax-text-muted sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface';
const CARD_TITLE = 'text-sm font-bold text-ax-text-secondary uppercase tracking-wider';
const levelStyle = (l: string) => ({ color: ADMIN_LEVEL_COLOR[l] ?? 'var(--ax-level-scaled)' });

interface BoxData {
  box: any;
  members: any[];
  wods: any[];
  wod_count?: number;
  scores: any[];
  competitions: any[];
}

export default function BoxDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<BoxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [resyncing, setResyncing] = useState(false);
  const [resyncResult, setResyncResult] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const res = await fetch(`/api/admin/boxes/${id}`);
    if (!res.ok) { setLoading(false); return; }
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [id]);

  function startEdit() {
    if (!data?.box) return;
    setEditName(data.box.name ?? '');
    setEditDesc(data.box.description ?? '');
    setEditCity(data.box.city ?? '');
    setEditActive(data.box.is_active ?? true);
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/admin/boxes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editName.trim(),
        description: editDesc.trim() || null,
        city: editCity.trim() || null,
        is_active: editActive,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      loadData();
    }
  }

  async function handleResync() {
    setResyncing(true);
    setResyncResult(null);
    try {
      const res = await fetch('/api/verify-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ box_id: id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setResyncResult(`Erreur : ${json.error ?? res.status}`);
      } else if (json.status === 'none') {
        setResyncResult('Aucune ligne box_subscriptions');
      } else if (json.source === 'manual') {
        setResyncResult(`${json.status} · offert (aucun abonnement Stripe)`);
      } else {
        const period = json.current_period_end
          ? ` · période jusqu'au ${new Date(json.current_period_end).toLocaleDateString('fr-FR')}`
          : '';
        setResyncResult(`${json.status}${period}${json.updated ? '' : ' · inchangé'}`);
        if (json.updated) loadData();
      }
    } catch {
      setResyncResult('Erreur réseau');
    } finally {
      setResyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-ax-border border-t-ax-accent-text rounded-full animate-spin" />
      </div>
    );
  }

  if (!data?.box) {
    return (
      <div className="text-center py-32">
        <Building2 size={48} className="text-ax-text-muted mx-auto mb-4" />
        <p className="text-ax-text-secondary">Box introuvable.</p>
      </div>
    );
  }

  const { box, members, wods, scores, competitions } = data;
  const wodCount = data.wod_count ?? wods.length;
  const owner = Array.isArray(box.owner) ? box.owner[0] : box.owner;

  const planTier: string = box.plan_tier ?? FREE_TIER;
  const planExpiredAt: string | null = box.expired_at ?? null;
  const planOffered: boolean = box.offered === true;

  function getWodScores(wodId: string) {
    return scores.filter((s: any) => s.wod_id === wodId);
  }

  function formatScore(value: number, type: string) {
    if (type === 'time') {
      const m = Math.floor(value / 60);
      const s = Math.round(value % 60);
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${value}`;
  }

  return (
    <div className="space-y-6">
      {/* Une box archivée le dit en tête de fiche : tout le reste de l'écran
          continue de fonctionner, et rien n'indiquerait sinon que ses membres
          n'y ont plus accès. */}
      {box.archived_at && (
        <div
          data-testid="bandeau-archivee"
          className="flex items-start gap-3 rounded-ax-card border border-ax-warning bg-ax-warning-soft px-5 py-4"
        >
          <Archive size={18} className="shrink-0 mt-0.5 text-ax-warning" />
          <div>
            <p className="text-sm font-bold text-ax-warning">
              Box archivée le {new Date(box.archived_at).toLocaleDateString('fr-FR')}
            </p>
            <p className="text-xs text-ax-text mt-0.5">
              Ses membres n&apos;y ont plus accès, elle est retirée des annuaires et n&apos;est plus
              générée. Aucune donnée n&apos;a été supprimée : « Réactiver » remet tout en place.
            </p>
          </div>
        </div>
      )}

      {/* Back + Header */}
      <div>
        <button onClick={() => router.push('/admin/boxes')} className="flex items-center gap-1.5 rounded-ax-control text-sm text-ax-text-secondary hover:text-ax-text transition-colors mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus">
          <ArrowLeft size={14} /> Retour aux boxs
        </button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {box.logo_url ? (
              <img src={box.logo_url} alt={box.name} className="w-14 h-14 shrink-0 rounded-ax-card object-cover" />
            ) : (
              <div className={`w-14 h-14 shrink-0 rounded-ax-card ${SUB_ORANGE_SOFT} ${SUB_ORANGE_TEXT} flex items-center justify-center font-black text-xl`}>
                {box.name?.[0]?.toUpperCase() ?? 'B'}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-medium uppercase tracking-wide text-ax-text break-words">{box.name}</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1">
                {box.city && <span className="text-sm text-ax-text-secondary">{box.city}</span>}
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-ax-badge border ${planTierClasses(planTier)}`}>
                  {planTier}
                </span>
                {planOffered && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-ax-badge text-ax-success bg-ax-success-soft">offert</span>
                )}
                {planExpiredAt && (
                  <span className={`text-[10px] ${SUB_ORANGE_TEXT}`}>{formatExpiredSince(planExpiredAt)}</span>
                )}
                {box.is_active ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-ax-success bg-ax-success-soft px-2 py-0.5 rounded-ax-badge">
                    <CheckCircle size={10} /> Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-ax-danger bg-ax-danger-soft px-2 py-0.5 rounded-ax-badge">
                    <XCircle size={10} /> Inactive
                  </span>
                )}
              </div>
            </div>
          </div>
          {!editing && (
            <div className="flex flex-col items-start sm:items-end gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ax-outline" onClick={handleResync} disabled={resyncing}>
                  <RefreshCw size={14} className={resyncing ? 'animate-spin' : ''} /> {resyncing ? 'Synchronisation...' : 'Resynchroniser avec Stripe'}
                </Button>
                <Button variant="ax-outline" onClick={startEdit}>
                  <Pencil size={14} /> Modifier
                </Button>
              </div>
              {resyncResult && (
                <p className="text-xs text-ax-text-secondary break-words">{resyncResult}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabs — à 390 px, deux par ligne plutôt que des libellés écrasés. */}
      <div className="grid grid-cols-2 sm:flex gap-1 bg-ax-surface border border-ax-border rounded-ax-control p-1">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            aria-pressed={tab === i}
            className={cn(
              'flex-1 py-2.5 rounded-ax-control text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus motion-reduce:transition-none',
              tab === i ? 'bg-ax-accent-soft text-ax-accent-text' : 'text-ax-text-secondary hover:text-ax-text hover:bg-ax-hover'
            )}
          >
            {t}
            {i === 1 && <span className="ml-1.5 text-[10px] font-semibold">({members.length})</span>}
            {i === 2 && <span className="ml-1.5 text-[10px] font-semibold">({wodCount})</span>}
            {i === 3 && <span className="ml-1.5 text-[10px] font-semibold">({competitions.length})</span>}
          </button>
        ))}
      </div>

      {/* TAB: Infos */}
      {tab === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-6 space-y-4 md:self-start">
            <h3 className={CARD_TITLE}>Informations</h3>
            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className={FIELD_LABEL}>Nom</label>
                  <Input value={editName} onChange={e => setEditName(e.target.value)} />
                </div>
                <div>
                  <label className={FIELD_LABEL}>Ville</label>
                  <Input value={editCity} onChange={e => setEditCity(e.target.value)} />
                </div>
                <div>
                  <label className={FIELD_LABEL}>Description</label>
                  <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)}
                    className={`${TEXTAREA} h-20 resize-y`} />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-ax-text-secondary">Active</label>
                  <button onClick={() => setEditActive(!editActive)} role="switch" aria-checked={editActive} aria-label="Active"
                    className={cn('w-10 h-5 rounded-full transition-colors relative border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface', editActive ? 'bg-ax-accent border-ax-accent' : 'bg-ax-surface-secondary border-ax-input-border')}>
                    <div className={cn('w-4 h-4 rounded-full absolute top-0.5 transition-all', editActive ? 'left-5 bg-ax-accent-foreground' : 'left-0.5 bg-ax-text-secondary')} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button variant="ax-mint" onClick={handleSave} disabled={saving}>
                    <Save size={14} /> {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                  </Button>
                  <Button variant="ax-outline" onClick={() => setEditing(false)}>
                    <XIcon size={14} /> Annuler
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <InfoRow label="Nom" value={box.name} />
                <InfoRow label="Slug" value={box.slug ?? '—'} />
                <InfoRow label="Ville" value={box.city ?? '—'} />
                <InfoRow label="Description" value={box.description ?? 'Aucune description'} />
                <InfoRow label="Code invitation" value={box.invite_code} mono />
                <InfoRow label="Créée le" value={new Date(box.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} />
              </div>
            )}
          </Card>

          {/* Logo card */}
          {box.logo_url && (
            <Card className="p-6 md:col-span-2 lg:col-span-1">
              <h3 className={`${CARD_TITLE} mb-4 flex items-center gap-2`}>
                <ImageIcon size={14} /> Logo
              </h3>
              <div className="flex items-center justify-center">
                <img src={box.logo_url} alt={`Logo ${box.name}`} className="max-h-48 rounded-ax-card object-contain" />
              </div>
            </Card>
          )}

          <div className="space-y-4 min-w-0">
            {/* Owner card */}
            <Card className="p-6">
              <h3 className={`${CARD_TITLE} mb-4`}>Propriétaire</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 shrink-0 rounded-full bg-ax-warning-soft flex items-center justify-center">
                  <Crown size={18} className="text-ax-warning" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ax-text break-words">{owner?.username ?? 'Inconnu'}</p>
                  {/* L'e-mail n'est lisible que par le service client : la
                      colonne `profiles.email` est fermée à anon et
                      authenticated, et cette route revérifie le rôle admin. */}
                  {owner?.email ? (
                    <a
                      href={`mailto:${owner.email}`}
                      data-testid="owner-email"
                      className="text-xs text-ax-accent-text hover:underline break-all rounded-ax-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus"
                    >
                      {owner.email}
                    </a>
                  ) : (
                    <p className="text-xs text-ax-text-muted">E-mail indisponible</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-black uppercase text-ax-warning bg-ax-warning-soft px-2 py-0.5 rounded-ax-badge">{owner?.role}</span>
                    <span className="text-[10px] font-black uppercase" style={levelStyle(owner?.level)}>{owner?.level}</span>
                    <span className="text-xs font-bold text-ax-warning">ELO {owner?.elo}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={Users} label="Membres" value={members.length} color="text-ax-info" bg="bg-ax-info-soft" />
              <StatCard icon={Dumbbell} label="WODs" value={wodCount} color="text-ax-success" bg="bg-ax-success-soft" />
              <StatCard icon={Trophy} label="Tournois" value={competitions.length} color="text-ax-purple" bg={PURPLE_SOFT} />
            </div>

            {/* Formats de tournoi autorisés */}
            <FormatPermissions
              boxId={box.id}
              current={Array.isArray(box.allowed_tournament_formats) && box.allowed_tournament_formats.length > 0
                ? box.allowed_tournament_formats : ['simple']}
              onSaved={loadData}
            />

            {/* Lot J2 : réservé à l'admin (trigger `boxes_auto_programming_guard`). */}
            <AutoProgrammingBlock
              boxId={box.id}
              enabled={box.auto_programming === true}
              tracks={((box.auto_programming_tracks ?? []) as string[]).filter(isTrack) as Track[]}
              reveal={revealFromRow(box)}
              onSaved={loadData}
            />

            <BoxArchiveBlock
              boxId={box.id}
              boxName={box.name}
              archivedAt={box.archived_at ?? null}
              onChanged={loadData}
            />
          </div>
        </div>
      )}

      {/* TAB: Membres */}
      {tab === 1 && (
        members.length === 0 ? (
          <Card className="text-center py-16">
            <Users size={40} className="text-ax-text-muted mx-auto mb-3" />
            <p className="text-sm text-ax-text-secondary">Aucun membre.</p>
          </Card>
        ) : (
          // À 390 px, le défilement horizontal est limité au tableau : mêmes
          // colonnes, même ordre, rien de masqué.
          <Table aria-label="Membres de la box">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {['Membre', 'Rôle', 'Niveau', 'ELO', 'Matchs', 'Wins', 'Statut', 'Rejoint le'].map(h => (
                  <TableHead key={h} className="px-5 whitespace-nowrap font-bold uppercase tracking-wider">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m: any) => {
                const p = Array.isArray(m.profile) ? m.profile[0] : m.profile;
                const isOwner = p?.id === owner?.id;
                return (
                  <TableRow key={m.id} className={cn(isOwner && 'bg-ax-warning-soft')}>
                    <TableCell className="px-5 py-4">
                      <div className="flex items-center gap-3 min-w-[11rem]">
                        <div className={cn(
                          'w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-black',
                          isOwner ? 'bg-ax-warning-soft text-ax-warning border border-ax-warning' : 'bg-ax-neutral-soft text-ax-text-secondary'
                        )}>
                          {isOwner ? <Crown size={14} /> : p?.username?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-ax-text break-words">{p?.username ?? 'Inconnu'}</span>
                          {isOwner && <span className="ml-2 text-[9px] font-black text-ax-warning border border-ax-warning px-1.5 py-0.5 rounded-ax-badge">OWNER</span>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-4">
                      <span className="whitespace-nowrap text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-ax-badge bg-ax-neutral-soft text-ax-text-secondary">
                        {p?.role}
                      </span>
                    </TableCell>
                    <TableCell className="px-5 py-4">
                      <span className="text-xs font-black uppercase" style={levelStyle(p?.level)}>{p?.level}</span>
                    </TableCell>
                    <TableCell className="px-5 py-4">
                      <span className="font-black text-ax-warning">{p?.elo ?? 0}</span>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-ax-text">{p?.total_matches ?? 0}</TableCell>
                    <TableCell className="px-5 py-4 text-ax-text">{p?.wins ?? 0}</TableCell>
                    <TableCell className="px-5 py-4">
                      {m.status === 'active' ? (
                        <span className="text-[10px] font-bold text-ax-success bg-ax-success-soft px-2 py-0.5 rounded-ax-badge">Actif</span>
                      ) : (
                        <span className="text-[10px] font-bold text-ax-danger bg-ax-danger-soft px-2 py-0.5 rounded-ax-badge">Banni</span>
                      )}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-xs text-ax-text-secondary whitespace-nowrap">
                      {new Date(m.joined_at).toLocaleDateString('fr-FR')}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )
      )}

      {/* TAB: Whiteboard */}
      {tab === 2 && (
        <div className="space-y-4">
          {wodCount > wods.length && (
            <p className="text-xs text-ax-text-secondary">{wods.length} derniers WODs affichés sur {wodCount}.</p>
          )}
          {wods.length === 0 ? (
            <div className="text-center py-16">
              <Dumbbell size={40} className="text-ax-text-muted mx-auto mb-3" />
              <p className="text-sm text-ax-text-secondary">Aucun WOD publié.</p>
            </div>
          ) : (
            wods.map((wod: any) => {
              const wodScores = getWodScores(wod.id);
              return (
                <Card key={wod.id} className="overflow-hidden">
                  {/* WOD header */}
                  <div className="p-5 border-b border-ax-border">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-ax-text break-words">{wod.title}</h3>
                        {wod.description && (
                          <p className="text-xs text-ax-text-secondary mt-1 whitespace-pre-wrap break-words">{wod.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-ax-badge bg-ax-success-soft text-ax-success">
                          {wod.wod_type ?? 'custom'}
                        </span>
                        {wod.is_published ? (
                          <span className="text-[10px] font-bold text-ax-success bg-ax-success-soft px-2 py-0.5 rounded-ax-badge">Publié</span>
                        ) : (
                          <span className="text-[10px] font-bold text-ax-text-secondary bg-ax-neutral-soft px-2 py-0.5 rounded-ax-badge">Brouillon</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ax-text-secondary">
                      <div className="flex items-center gap-1">
                        <Calendar size={11} />
                        {new Date(wod.scheduled_date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </div>
                      {wod.time_cap_seconds && (
                        <div className="flex items-center gap-1">
                          <Clock size={11} />
                          {formatCap(wod.time_cap_seconds)}
                        </div>
                      )}
                      {wod.rounds && (
                        <div className="flex items-center gap-1">
                          <Hash size={11} />
                          {wod.rounds} rounds
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Users size={11} />
                        {wodScores.length} score{wodScores.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  {/* Scores leaderboard */}
                  {wodScores.length > 0 && (
                    <div className="divide-y divide-ax-border">
                      {wodScores.map((s: any, idx: number) => {
                        const sp = Array.isArray(s.profile) ? s.profile[0] : s.profile;
                        return (
                          <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-ax-hover">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                              <span className={cn(
                                'w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[10px] font-black',
                                idx === 0 ? 'bg-ax-warning-soft text-ax-warning' :
                                idx === 1 ? 'bg-ax-neutral-soft text-ax-text' :
                                idx === 2 ? `${SUB_ORANGE_SOFT} ${SUB_ORANGE_TEXT}` :
                                'bg-ax-neutral-soft text-ax-text-secondary'
                              )}>
                                {idx + 1}
                              </span>
                              <span className="text-sm font-semibold text-ax-text break-words">{sp?.username ?? 'Inconnu'}</span>
                              <span className="text-[10px] font-black uppercase" style={levelStyle(sp?.level)}>{sp?.level}</span>
                              {s.rx && <span className="text-[9px] font-black text-ax-success bg-ax-success-soft px-1.5 py-0.5 rounded-ax-badge">RX</span>}
                            </div>
                            <span className="text-sm font-black text-ax-text shrink-0">{formatScore(s.score_value, s.score_type)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* TAB: Tournois */}
      {tab === 3 && (
        <div className="space-y-4">
          {competitions.length === 0 ? (
            <div className="text-center py-16">
              <Trophy size={40} className="text-ax-text-muted mx-auto mb-3" />
              <p className="text-sm text-ax-text-secondary">Aucun tournoi créé pour cette box.</p>
            </div>
          ) : (
            competitions.map((c: any) => (
              <Card key={c.id} className="p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-ax-text break-words">{c.name}</h3>
                    {c.description && <p className="text-xs text-ax-text-secondary mt-1 break-words">{c.description}</p>}
                  </div>
                  <span className={cn(
                    'text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-ax-badge',
                    c.status === 'open' ? 'text-ax-success bg-ax-success-soft' :
                    c.status === 'active' ? `${SUB_ORANGE_TEXT} ${SUB_ORANGE_SOFT}` :
                    c.status === 'completed' ? 'text-ax-info bg-ax-info-soft' :
                    'text-ax-text-secondary bg-ax-neutral-soft'
                  )}>
                    {c.status === 'open' ? 'Inscriptions ouvertes' : c.status === 'active' ? 'En cours' : c.status === 'completed' ? 'Terminé' : c.status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ax-text-secondary">
                  <div className="flex items-center gap-1">
                    <Calendar size={11} />
                    {new Date(c.created_at).toLocaleDateString('fr-FR')}
                  </div>
                  {c.max_participants && (
                    <div className="flex items-center gap-1">
                      <Users size={11} />
                      Max {c.max_participants}
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-ax-text-secondary font-semibold shrink-0">{label}</span>
      <span className={cn('min-w-0 text-sm text-ax-text text-right break-words', mono && 'font-mono bg-ax-neutral-soft px-2 py-0.5 rounded-ax-badge')}>{value}</span>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }: { icon: any; label: string; value: number; color: string; bg: string }) {
  return (
    <Card className="p-4 text-center min-w-0">
      <div className={cn('w-8 h-8 rounded-ax-control mx-auto mb-2 flex items-center justify-center', bg)}>
        <Icon size={16} className={color} />
      </div>
      <p className="text-xl font-black text-ax-text">{value}</p>
      <p className="text-[10px] text-ax-text-secondary font-bold uppercase tracking-wider break-words">{label}</p>
    </Card>
  );
}

const TOURNAMENT_FORMATS: Array<{ key: string; label: string; desc: string }> = [
  { key: 'simple',     label: 'Classique',                   desc: 'Classement points cumulés' },
  { key: 'bracket',    label: 'Bracket (élimination simple)', desc: 'Tableau à élimination directe' },
  { key: 'swiss',      label: 'Swiss (double élimination)',   desc: 'Winner + Loser brackets, grande finale' },
  { key: 'league_div', label: 'Ligue avec divisions',         desc: 'Promotion/relégation entre divisions' },
];

function FormatPermissions({ boxId, current, onSaved }: { boxId: string; current: string[]; onSaved: () => void }) {
  const [selected, setSelected] = useState<string[]>(current);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const dirty = selected.length !== current.length || selected.some(f => !current.includes(f));

  function toggle(fmt: string) {
    setSelected(prev => prev.includes(fmt) ? prev.filter(f => f !== fmt) : [...prev, fmt]);
  }

  async function save() {
    setSaving(true); setMsg(null);
    const res = await fetch(`/api/admin/boxes/${boxId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowed_tournament_formats: selected.length > 0 ? selected : ['simple'] }),
    });
    setSaving(false);
    if (res.ok) { setMsg('Sauvegardé'); onSaved(); }
    else { const j = await res.json().catch(() => ({})); setMsg(j.error ?? 'Erreur'); }
  }

  return (
    <Card className="p-6 space-y-3">
      <h3 className={`${CARD_TITLE} flex items-center gap-2`}>
        <Trophy size={14} /> Formats de tournoi autorisés
      </h3>
      <p className="text-xs text-ax-text-secondary">L'owner ne peut créer que les formats que tu coches ici.</p>
      <div className="space-y-2">
        {TOURNAMENT_FORMATS.map(f => {
          const on = selected.includes(f.key);
          const isSimple = f.key === 'simple';
          return (
            <label key={f.key}
              className={cn(
                'flex items-start gap-3 p-3 rounded-ax-control border cursor-pointer transition-colors',
                on ? 'border-ax-accent-text bg-ax-accent-soft' : 'border-ax-border hover:border-ax-input-border',
              )}
            >
              <input type="checkbox" checked={on} disabled={isSimple}
                onChange={() => !isSimple && toggle(f.key)}
                className="mt-0.5 w-4 h-4 accent-[var(--ax-accent-text)]" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-ax-text flex flex-wrap items-center gap-2">
                  {f.label}
                  {isSimple && <span className="text-[9px] font-black text-ax-text-secondary uppercase">par défaut</span>}
                </div>
                <div className="text-xs text-ax-text-secondary">{f.desc}</div>
              </div>
            </label>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        {msg && <span className="text-xs text-ax-text-secondary">{msg}</span>}
        <Button variant="ax-mint" onClick={save} disabled={!dirty || saving} className="ml-auto">
          <Save size={14} /> {saving ? 'Sauvegarde...' : 'Enregistrer'}
        </Button>
      </div>
    </Card>
  );
}
