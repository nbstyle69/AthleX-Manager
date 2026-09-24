'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Plus, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ArrowLeft, ArrowRight, Pencil, Trash2,
  Eye, EyeOff, X, Loader2, Dumbbell, Upload, Download, FileText, Calendar, LayoutGrid, List, Video,
  CalendarPlus, BookmarkPlus, CheckSquare, Square, Copy, Lock,
} from 'lucide-react';
import { getMyBox } from '@/lib/getMyBox';
import WodEditor from '@/components/wods/WodEditor';
import HelpButton from '@/components/help/HelpButton';
import ApplyProgramWeekModal from '@/components/wods/ApplyProgramWeekModal';
import { RestrictionBadges, programColor } from '@/components/wods/RestrictionBadges';
import AssignRestrictionsModal from '@/components/wods/AssignRestrictionsModal';
import { assignRestrictions, libelleAssignation } from '@/lib/wodAssignment';
import SaveWeekAsTemplateModal from '@/components/wods/SaveWeekAsTemplateModal';
import CopyWeekToOfferModal, { CopySource } from '@/components/wods/CopyWeekToOfferModal';
import SubscriptionBanner, { BannerSubscription } from '@/components/wods/SubscriptionBanner';
import AutoProgrammingBanner, { AutoBadge } from '@/components/wods/AutoProgrammingBanner';
import TrackTabs, { TrackBadge, trackAccent } from '@/components/wods/TrackTabs';
import {
  DEFAULT_REVEAL, DEFAULT_TAB, filterByTab, resolveTab, trackTabStorageKey, visibleTabs,
  type AutoRun, type RevealSettings, type Track, type TrackTab,
} from '@/lib/autoProgramming';
import { WodEditorOffer } from '@/components/wods/WodEditor';
import { Audience, isAudience, subscriptionColorVar } from '@/lib/audience';
import PdfImportModal from '@/components/wods/PdfImportModal';
import { applyWeekNotes } from '@/lib/programWeek';
import {
  BLOCK_COLOR, BLOCK_LABEL, DAY_LABELS, EMPTY_WOD_FORM, TYPE_COLOR,
  WodFormState, WodType, formatCap, movementLines, parseCap, sharedWodColumns,
} from '@/lib/wodFields';
import { downloadWodCsvTemplate, parseWodImportFile, VALID_WOD_TYPES } from '@/lib/wodImport';
import { stripWodJson, withWodJson, writeWithWodJsonFallback } from '@/lib/wodJson';
import { softVar, subColorVar, textTint } from '@/lib/colorVars';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface BoxWOD {
  id: string; box_id: string; created_by: string;
  title: string; description: string | null;
  wod_type: WodType | null; scheduled_date: string;
  time_cap_seconds: number | null; rounds: number | null;
  block_name: string | null;
  video_url: string | null;
  notes: string | null; is_published: boolean;
  publish_at: string | null;
  sort_order: number;
  emom_interval_minutes: number | null;
  tabata_work_seconds: number | null;
  tabata_rest_seconds: number | null;
  audience: Audience;
  source_programming_id: string | null;
  /** `auto` = posée par `generate-box-week` ; `manual` = saisie par un humain. */
  source: string | null;
  /** Première modification humaine d'une ligne auto (trigger `box_wods_mark_edited`). */
  edited_at: string | null;
  /** Piste de programmation, `null` pour une carte saisie à la main. */
  track: string | null;
}

/** Provenance d'une carte reçue d'une offre Marketplace (autre box). */
interface ReceivedInfo { title: string; color: string; textColor: string }

const TOOLBAR_BTN = 'h-auto min-h-[32px] gap-1.5 text-xs text-ax-text-secondary hover:text-ax-text hover:border-ax-input-border';
const TOOLBAR_BTN_ON = 'border-ax-input-border bg-ax-hover text-ax-text';
const DANGER_OUTLINE = 'border-ax-danger text-ax-danger hover:text-ax-danger hover:bg-ax-danger-soft';
const ICON_BTN = 'p-1 rounded-ax-control hover:bg-ax-hover transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface';

function getWeekDates(offset = 0): Date[] {
  const today = new Date();
  const monday = new Date(today);
  const day = today.getDay();
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function WODsPage() {
  const supabase = createClient();

  const [wods,       setWods]      = useState<BoxWOD[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [weekOffset, setWeek]      = useState(0);
  const [boxId,      setBoxId]     = useState<string | null>(null);
  const [userId,     setUserId]    = useState<string | null>(null);

  const [modal,       setModal]       = useState(false);
  const [editWOD,     setEditWOD]     = useState<BoxWOD | null>(null);
  const [form,        setForm]        = useState<WodFormState>(EMPTY_WOD_FORM);
  const [movements,   setMovements]   = useState<string[]>([]);
  const [saving,      setSaving]      = useState(false);
  const [formError,   setFormError]   = useState<string | null>(null);
  const [importing,   setImporting]   = useState(false);
  const [importResult, setImportResult] = useState<{ ok: number; errors: string[]; notes?: string[] } | null>(null);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [layout, setLayoutRaw] = useState<'rows' | 'columns'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('bo_wods_layout') as 'rows' | 'columns') || 'rows';
    }
    return 'rows';
  });
  const setLayout = (v: 'rows' | 'columns' | ((prev: 'rows' | 'columns') => 'rows' | 'columns')) => {
    setLayoutRaw(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      localStorage.setItem('bo_wods_layout', next);
      return next;
    });
  };
  const [showDateNav, setShowDateNav] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  const [groups, setGroups] = useState<{ id: string; name: string; color: string }[]>([]);
  const [wodGroupMap, setWodGroupMap] = useState<Record<string, string[]>>({});
  const [applyModal, setApplyModal] = useState<{ subscriptionId?: string; week?: number } | null>(null);
  const [templateModal, setTemplateModal] = useState(false);
  const [copySource, setCopySource] = useState<CopySource | null>(null);
  const [subscriptions, setSubscriptions] = useState<BannerSubscription[]>([]);
  /** Onglet de piste, mémorisé par box. Lu au chargement de la box. */
  const [tab, setTabRaw] = useState<TrackTab>(DEFAULT_TAB);
  const setTab = (next: TrackTab) => {
    setTabRaw(next);
    if (boxId && typeof window !== 'undefined') {
      try { localStorage.setItem(trackTabStorageKey(boxId), next); } catch { /* stockage refusé */ }
    }
  };
  /** Programmation automatique de la box (lot J2), lue côté serveur. */
  const [auto, setAuto] = useState<{ enabled: boolean; tracks: Track[]; reveal: RevealSettings; runs: AutoRun[] }>(
    { enabled: false, tracks: [], reveal: DEFAULT_REVEAL, runs: [] });
  const [offers, setOffers] = useState<WodEditorOffer[]>([]);
  /** programming_id → provenance, pour les cartes reçues d'une autre box. */
  const [receivedMap, setReceivedMap] = useState<Record<string, ReceivedInfo>>({});
  /** Copies d'offre liées au WOD en édition (programming_id → semaine), état initial. */
  const [editOfferWeeks, setEditOfferWeeks] = useState<Record<string, number>>({});
  const [boxPrograms, setBoxPrograms] = useState<{ id: string; title: string; type: string }[]>([]);
  const [wodProgramMap, setWodProgramMap] = useState<Record<string, string[]>>({});
  const [dragOver, setDragOver] = useState(false);
  const importRef = useRef<(f: File) => Promise<void>>(async () => {});
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assignModal, setAssignModal] = useState(false);

  const weekDates = getWeekDates(weekOffset);

  // Onglets de piste : dérivés de la semaine chargée, pas d'un réglage. Une
  // semaine sans aucune carte de piste ne montre pas de barre du tout.
  const tabs = useMemo(() => visibleTabs(wods), [wods]);
  const activeTab = resolveTab(tab, tabs);
  const tabCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const t of tabs) out[t] = filterByTab(wods, t).length;
    return out;
  }, [wods, tabs]);
  /** Ce que les deux vues affichent : la semaine vue par l'onglet actif. */
  const shownWods = useMemo(() => filterByTab(wods, activeTab), [wods, activeTab]);
  const todayISO  = toISO(new Date());

  const refGroups = useMemo(
    () => groups.map(g => ({ id: g.id, name: g.name, color: g.color })),
    [groups],
  );
  const refPrograms = useMemo(
    () => boxPrograms.map(p => ({ id: p.id, name: p.title, color: programColor(p.type) })),
    [boxPrograms],
  );

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const box = await getMyBox(supabase);
      if (box) {
        setBoxId(box.id);
        const { data: g } = await supabase.from('message_groups').select('id, name, color').eq('box_id', box.id).order('name');
        setGroups(g ?? []);
        const { data: progs } = await supabase.from('programs').select('id, title, type').eq('box_id', box.id).eq('is_active', true).order('title');
        setBoxPrograms((progs ?? []) as any[]);
        await loadMarketplace(box.id);
        await loadAuto(box.id);
        // Choix d'onglet mémorisé pour CETTE box : deux box n'ont pas les
        // mêmes pistes, une clé globale aurait proposé un onglet absent.
        try {
          const memo = localStorage.getItem(trackTabStorageKey(box.id));
          if (memo) setTabRaw(memo as TrackTab);
        } catch { /* stockage refusé */ }
      }
    })();
  }, []);

  interface RawApplicable {
    subscription_id: string; programming_id: string; title: string | null; publisher_box_name: string | null;
    weeks_count: number | null; auto_apply_weekly: boolean | null; color: string | null;
    week_anchor: string | null; wod_counts: number[] | null;
  }

  /** Abonnements actifs (bannière, provenance, couleur) et offres publiées par la box (copie depuis le formulaire). */
  async function loadMarketplace(bid: string) {
    const [subs, offs] = await Promise.all([
      supabase.rpc('list_applicable_programmings', { p_box_id: bid }),
      supabase.from('box_programming').select('id, title, weeks_count').eq('publisher_box_id', bid).eq('is_template', false).order('created_at', { ascending: false }),
    ]);
    const rows = ((subs.data ?? []) as RawApplicable[]).map(r => {
      const n = Math.max(r.weeks_count ?? 1, 1);
      return {
        subscriptionId: r.subscription_id,
        programmingId: r.programming_id,
        title: r.title ?? 'Programmation',
        publisherBoxName: r.publisher_box_name,
        weeksCount: n,
        autoApplyWeekly: !!r.auto_apply_weekly,
        color: r.color,
        weekAnchor: r.week_anchor,
        wodCounts: Array.from({ length: n }, (_, i) => r.wod_counts?.[i] ?? 0),
      };
    });
    setSubscriptions(rows);
    setOffers(((offs.data ?? []) as { id: string; title: string; weeks_count: number | null }[])
      .map(o => ({ id: o.id, title: o.title, weeksCount: Math.max(o.weeks_count ?? 1, 1) })));
  }

  /**
   * Programmation automatique : lue par la route serveur et pas en direct.
   * La policy de `box_auto_programming_runs` passe par `is_box_owner_admin()`,
   * qui exclut le coach — un coach ne verrait aucune run depuis le client.
   */
  async function loadAuto(bid: string) {
    const res = await fetch(`/api/box/${bid}/auto-programming`, { cache: 'no-store' });
    if (!res.ok) return;
    setAuto(await res.json());
  }

  const load = useCallback(async () => {
    if (!boxId) return;
    setLoading(true);
    const { data } = await supabase
      .from('box_wods').select('*')
      .eq('box_id', boxId)
      .gte('scheduled_date', toISO(weekDates[0]))
      .lte('scheduled_date', toISO(weekDates[6]))
      .order('scheduled_date')
      .order('sort_order');
    const wodsArr = ((data ?? []) as BoxWOD[]).map(w => ({ ...w, audience: isAudience(w.audience) ? w.audience : 'all' }));
    setWods(wodsArr);

    // Provenance des cartes reçues : une carte dont l'offre source n'est pas
    // éditée par cette box vient d'un abonnement (actif ou passé) — le serveur
    // la verrouille, l'UI le montre.
    const srcIds = [...new Set(wodsArr.map(w => w.source_programming_id).filter((x): x is string => !!x))];
    if (srcIds.length > 0) {
      const [{ data: progs }, { data: subRows }] = await Promise.all([
        supabase.from('box_programming').select('id, title, publisher_box_id').in('id', srcIds),
        supabase.from('box_programming_subscriptions').select('programming_id, color').eq('subscriber_box_id', boxId).in('programming_id', srcIds),
      ]);
      const colorBy: Record<string, string | null> = {};
      ((subRows ?? []) as { programming_id: string; color: string | null }[]).forEach(s => { colorBy[s.programming_id] = s.color; });
      const progRows = (progs ?? []) as { id: string; title: string; publisher_box_id: string }[];
      const mine = new Set(progRows.filter(p => p.publisher_box_id === boxId).map(p => p.id));
      const titleBy: Record<string, string> = {};
      progRows.forEach(p => { titleBy[p.id] = p.title; });
      // Une offre source illisible (dépubliée depuis) reste une carte reçue :
      // le verrou serveur s'applique, le titre seul manque.
      const map: Record<string, ReceivedInfo> = {};
      srcIds.filter(id => !mine.has(id)).forEach(id => {
        map[id] = { title: titleBy[id] ?? 'programmation Marketplace', color: subscriptionColorVar(colorBy[id]), textColor: subColorVar(colorBy[id], 'text') };
      });
      setReceivedMap(map);
    } else {
      setReceivedMap({});
    }
    // Load group access for all WODs
    const ids = wodsArr.map(w => w.id);
    if (ids.length > 0) {
      const { data: accessRows } = await supabase
        .from('wod_group_access')
        .select('wod_id, group_id')
        .in('wod_id', ids);
      const map: Record<string, string[]> = {};
      (accessRows ?? []).forEach((r: any) => {
        if (!map[r.wod_id]) map[r.wod_id] = [];
        map[r.wod_id].push(r.group_id);
      });
      setWodGroupMap(map);
      // Load program access
      const { data: progAccessRows } = await supabase.from('wod_program_access').select('wod_id, program_id').in('wod_id', ids);
      const pMap: Record<string, string[]> = {};
      (progAccessRows ?? []).forEach((r: any) => {
        if (!pMap[r.wod_id]) pMap[r.wod_id] = [];
        pMap[r.wod_id].push(r.program_id);
      });
      setWodProgramMap(pMap);
    } else {
      setWodGroupMap({});
      setWodProgramMap({});
    }
    setLoading(false);
  }, [boxId, weekOffset]);

  useEffect(() => { load(); }, [load]);

  function toggleSelected(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function openCreate(date: string) {
    setEditWOD(null);
    setEditOfferWeeks({});
    setForm({ ...EMPTY_WOD_FORM, date });
    setMovements([]);
    setFormError(null);
    setModal(true);
  }

  async function loadWodGroups(wodId: string): Promise<string[]> {
    const { data } = await supabase.from('wod_group_access').select('group_id').eq('wod_id', wodId);
    return (data ?? []).map((r: any) => r.group_id);
  }

  const isReceived = (wod: BoxWOD) => !!wod.source_programming_id && !!receivedMap[wod.source_programming_id];

  async function openEdit(wod: BoxWOD) {
    if (isReceived(wod)) return;
    setEditWOD(wod);
    const gIds = await loadWodGroups(wod.id);
    const [{ data: pRows }, { data: copies }] = await Promise.all([
      supabase.from('wod_program_access').select('program_id').eq('wod_id', wod.id),
      supabase.from('box_programming_wods').select('programming_id, week_number').eq('origin_box_wod_id', wod.id),
    ]);
    const pIds = (pRows ?? []).map((r: any) => r.program_id);
    const offerWeeks: Record<string, number> = {};
    ((copies ?? []) as { programming_id: string; week_number: number }[]).forEach(c => { offerWeeks[c.programming_id] = c.week_number; });
    setEditOfferWeeks(offerWeeks);
    setForm({
      ...EMPTY_WOD_FORM,
      title: wod.title, description: wod.description ?? '',
      wod_type: wod.wod_type ?? '', block: wod.block_name ?? '',
      date: wod.scheduled_date,
      timeCap: formatCap(wod.time_cap_seconds),
      rounds: wod.rounds ? String(wod.rounds) : '',
      notes: wod.notes ?? '', videoUrl: wod.video_url ?? '', published: wod.is_published,
      leaderboard: (wod as any).leaderboard_enabled ?? true,
      audience: wod.audience,
      groupIds: wod.audience === 'groups' ? gIds : [],
      programIds: pIds,
      offerWeeks,
      publishMode: wod.publish_at ? 'scheduled' : 'now',
      publishHour: wod.publish_at ? new Date(wod.publish_at).getHours().toString().padStart(2, '0') : '06',
      publishMin: wod.publish_at ? new Date(wod.publish_at).getMinutes().toString().padStart(2, '0') : '00',
      emomInterval: wod.emom_interval_minutes ? String(wod.emom_interval_minutes) : '1',
      tabataWork: wod.tabata_work_seconds ? String(wod.tabata_work_seconds) : '20',
      tabataRest: wod.tabata_rest_seconds != null ? String(wod.tabata_rest_seconds) : '10',
    });
    setMovements(movementLines(wod.description));
    setFormError(null);
    setModal(true);
  }

  async function saveWOD() {
    if (!form.title.trim() || !form.date || !boxId || !userId || form.audience === '') return;
    if (form.audience === 'groups' && form.groupIds.length === 0) return;
    setSaving(true); setFormError(null);
    const payload = withWodJson({
      ...sharedWodColumns(form, movements),
      box_id: boxId, created_by: userId,
      scheduled_date: form.date,
      audience: form.audience,
      is_published: form.published,
      publish_at: form.published && form.publishMode === 'scheduled'
        ? `${form.date}T${form.publishHour.padStart(2,'0')}:${form.publishMin.padStart(2,'0')}:00`
        : null,
    });
    let wodId = editWOD?.id;
    if (editWOD) {
      const { error } = await writeWithWodJsonFallback(inc =>
        supabase.from('box_wods').update(inc ? payload : stripWodJson(payload)).eq('id', editWOD.id));
      if (error) { setSaving(false); setFormError(error.message); return; }
    } else {
      // Assign sort_order = next position for that date
      const dayCount = wods.filter(w => w.scheduled_date === form.date).length;
      const row = { ...payload, sort_order: dayCount };
      const { data: newWod, error } = await writeWithWodJsonFallback(inc =>
        supabase.from('box_wods').insert(inc ? row : stripWodJson(row)).select('id').single());
      if (error || !newWod) { setSaving(false); setFormError(error?.message ?? 'Erreur'); return; }
      wodId = newWod.id;
    }

    // Les restrictions de l'éditeur sont l'état complet du WOD : on repose
    // exactement ce qui est coché. Un refus d'écriture se dit — sinon la
    // fenêtre se ferme sur un enregistrement qui n'a pas eu lieu.
    if (wodId) {
      const echecs: string[] = [];
      // « Toute la box » / « Personne encore » purgent les groupes : une ligne
      // résiduelle ferait re-basculer le WOD en 'groups' (trigger) et le
      // cacherait côté athlète.
      const gDel = await supabase.from('wod_group_access').delete().eq('wod_id', wodId);
      if (gDel.error) echecs.push(`groupes (retrait) : ${gDel.error.message}`);
      if (form.audience === 'groups' && form.groupIds.length > 0) {
        const gIns = await supabase.from('wod_group_access').insert(
          form.groupIds.map(gid => ({ wod_id: wodId, group_id: gid }))
        );
        if (gIns.error) echecs.push(`groupes : ${gIns.error.message}`);
      }
      const pDel = await supabase.from('wod_program_access').delete().eq('wod_id', wodId);
      if (pDel.error) echecs.push(`programmes (retrait) : ${pDel.error.message}`);
      if (form.programIds.length > 0) {
        const pIns = await supabase.from('wod_program_access').insert(
          form.programIds.map(pid => ({ wod_id: wodId, program_id: pid }))
        );
        if (pIns.error) echecs.push(`programmes : ${pIns.error.message}`);
      }
      // Le trigger AFTER INSERT repasse un WOD 'all' en 'groups' ; on réaffirme
      // la colonne après les lignes pour que l'état final soit celui choisi.
      if (form.audience === 'groups') {
        const aUpd = await supabase.from('box_wods').update({ audience: 'groups' }).eq('id', wodId);
        if (aUpd.error) echecs.push(`visibilité : ${aUpd.error.message}`);
      }

      // Copies dans mes offres Marketplace : sync pour chaque offre cochée,
      // unsync pour celles décochées depuis l'ouverture.
      for (const [pid, week] of Object.entries(form.offerWeeks)) {
        const { error: sErr } = await supabase.rpc('sync_wod_to_offer', { p_box_wod_id: wodId, p_programming_id: pid, p_week: week });
        if (sErr) echecs.push(`offre ${offers.find(o => o.id === pid)?.title ?? pid} : ${sErr.message}`);
      }
      for (const pid of Object.keys(editOfferWeeks)) {
        if (form.offerWeeks[pid] !== undefined) continue;
        const { error: uErr } = await supabase.rpc('unsync_wod_from_offer', { p_box_wod_id: wodId, p_programming_id: pid });
        if (uErr) echecs.push(`retrait de l'offre ${offers.find(o => o.id === pid)?.title ?? pid} : ${uErr.message}`);
      }

      if (echecs.length > 0) {
        setSaving(false);
        setFormError(`WOD enregistré, mais tout n'a pas été posé — ${echecs.join(' ; ')}`);
        load();
        return;
      }
    }

    setSaving(false);
    setModal(false);
    load();
  }

  async function togglePublish(wod: BoxWOD) {
    await supabase.from('box_wods').update({ is_published: !wod.is_published }).eq('id', wod.id);
    load();
  }

  function deleteWOD(wod: BoxWOD) {
    setConfirmDialog({
      title: 'Supprimer ce WOD ?',
      message: `"${wod.title}" sera définitivement supprimé.`,
      confirmLabel: 'Supprimer',
      danger: true,
      onConfirm: async () => {
        await supabase.from('box_wods').delete().eq('id', wod.id);
        load();
      },
    });
  }

  function deleteAllWodsThisWeek() {
    if (!boxId || wods.length === 0) return;
    const startISO = toISO(weekDates[0]);
    const endISO   = toISO(weekDates[6]);
    const count    = wods.length;
    setConfirmDialog({
      title: `Supprimer ${count} WODs ?`,
      message: `Tous les WODs de la semaine du ${weekDates[0].toLocaleDateString('fr-FR')} au ${weekDates[6].toLocaleDateString('fr-FR')} seront supprimés. Cette action est irréversible.`,
      confirmLabel: 'Tout supprimer',
      danger: true,
      onConfirm: async () => {
        await supabase
          .from('box_wods')
          .delete()
          .eq('box_id', boxId)
          .gte('scheduled_date', startISO)
          .lte('scheduled_date', endISO);
        load();
      },
    });
  }

  async function moveWod(dayISO: string, index: number, direction: 'up' | 'down') {
    const dayWODs = wods.filter(w => w.scheduled_date === dayISO);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= dayWODs.length) return;
    [dayWODs[index], dayWODs[target]] = [dayWODs[target], dayWODs[index]];
    // Optimistic update
    setWods(prev => {
      const others = prev.filter(w => w.scheduled_date !== dayISO);
      return [...others, ...dayWODs.map((w, i) => ({ ...w, sort_order: i }))];
    });
    // Persist
    await Promise.all(dayWODs.map((w, i) =>
      supabase.from('box_wods').update({ sort_order: i }).eq('id', w.id)
    ));
  }

  async function moveWodToDay(wod: BoxWOD, direction: 'prev' | 'next') {
    const d = new Date(wod.scheduled_date + 'T00:00:00');
    d.setDate(d.getDate() + (direction === 'prev' ? -1 : 1));
    const targetDate = toISO(d);
    const targetDayCount = wods.filter(w => w.scheduled_date === targetDate).length;
    // Optimistic update
    setWods(prev => prev.map(w =>
      w.id === wod.id ? { ...w, scheduled_date: targetDate, sort_order: targetDayCount } : w
    ));
    await supabase.from('box_wods').update({ scheduled_date: targetDate, sort_order: targetDayCount }).eq('id', wod.id);
  }

  // ── CSV Export ────────────────────────────────────────────────────────────
  function exportCSV() {
    if (!wods.length) return;
    const headers = ['date','title','type','description','timecap','rounds','notes','published'];
    const rows = wods.map(w => [
      w.scheduled_date,
      `"${(w.title ?? '').replace(/"/g, '""')}"`,
      w.wod_type,
      `"${(w.description ?? '').replace(/"/g, '""')}"`,
      formatCap(w.time_cap_seconds),
      w.rounds ?? '',
      `"${(w.notes ?? '').replace(/"/g, '""')}"`,
      w.is_published ? 'true' : 'false',
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `wods_semaine_${toISO(weekDates[0])}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  // ── CSV Template ─────────────────────────────────────────────────────────
  // Colonnes : date,title,type,description,timecap,rounds,notes,block,published,rank,groups
  //   type      = for-time | amrap | emom | tabata | strength | custom
  //   timecap   = minutes (20) ou mm:ss (12:30)
  //   block     = skill-gym | skill-haltero | wod | pre-wod | post-wod  (optionnel)
  //   published = true/false  (défaut true)
  //   rank      = true/false  (défaut true) → leaderboard_enabled
  //   groups    = noms séparés par | (ex: Compétiteurs|Niveau Avancé) — vide = visible par tous
  function downloadTemplate() {
    downloadWodCsvTemplate('whiteboard');
  }

  // ── CSV / JSON / PDF Import ──────────────────────────────────────────────────────────────
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (file) await importFile(file);
  }

  /**
   * Un seul chemin d'import, deux portes : le bouton « Importer » et le
   * glisser-déposer. Même parseur, mêmes refus nommés, même preview PDF.
   */
  async function importFile(file: File) {
    if (!boxId || !userId) return;
    const nom = file.name.toLowerCase();

    if (file.type === 'application/pdf' || nom.endsWith('.pdf')) {
      setPdfFile(file);
      return;
    }
    if (!nom.endsWith('.csv') && !nom.endsWith('.json')) {
      setImportResult({
        ok: 0,
        errors: [`Type de fichier non supporté : « ${file.name} ». L'import accepte PDF, CSV et JSON.`],
      });
      return;
    }

    setImporting(true);
    setImportResult(null);
    const text = await file.text();

    const { rows, errors: parseErrors } = parseWodImportFile(text, file.name, 'whiteboard');

    if (rows.length === 0) {
      setImportResult({ ok: 0, errors: parseErrors.length ? parseErrors : ['Aucun WOD trouvé dans le fichier'] });
      setImporting(false);
      return;
    }

    // --- Resolve group names → IDs ---
    const allGroupNames = [...new Set(rows.flatMap(r => r.groupNames))];
    const groupMap: Record<string, string> = {};
    if (allGroupNames.length > 0) {
      const { data: grps } = await supabase
        .from('message_groups').select('id, name')
        .eq('box_id', boxId).in('name', allGroupNames);
      if (grps) grps.forEach((g: any) => { groupMap[g.name] = g.id; });
      const missing = allGroupNames.filter(n => !groupMap[n]);
      if (missing.length > 0) parseErrors.push(`Groupes inconnus (ignorés) : ${missing.join(', ')}`);
    }

    // --- Insert WODs ---
    let ok = 0;
    const errors = [...parseErrors];
    const importedIds: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const wodType = (VALID_WOD_TYPES as string[]).includes(r.type) ? r.type : 'custom';
      const row = withWodJson({
        box_id: boxId, created_by: userId,
        title: r.title, description: r.description || null,
        wod_type: wodType, scheduled_date: r.date,
        time_cap_seconds: parseCap(r.timeCap),
        rounds: r.rounds ? parseInt(r.rounds) : null,
        notes: r.notes || null, block_name: r.block || null,
        is_published: r.published, leaderboard_enabled: r.rank,
      });
      const { data: inserted, error } = await writeWithWodJsonFallback(inc =>
        supabase.from('box_wods').insert(inc ? row : stripWodJson(row)).select('id').single());
      if (error) { errors.push(`Ligne ${i + 2} : ${error.message}`); continue; }
      ok++;
      if (inserted) importedIds.push(inserted.id);
      // Insert group access
      if (inserted && r.groupNames.length > 0) {
        const accessRows = r.groupNames
          .filter(gn => groupMap[gn])
          .map(gn => ({ wod_id: inserted.id, group_id: groupMap[gn] }));
        if (accessRows.length > 0) {
          const { error: gErr } = await supabase.from('wod_group_access').insert(accessRows);
          if (gErr) errors.push(`WOD "${r.title}" : erreur groupes — ${gErr.message}`);
        }
      }
    }

    const notes: string[] = [];
    if (importedIds.length > 0) {
      notes.push(
        'Choisis qui voit ces WOD : ils sont déjà sélectionnés, clique « Assigner à… ». '
        + 'Le CSV ne pose que les groupes de sa colonne groups ; les programmes se posent ici.',
      );
      setSelectMode(true);
      setSelectedIds(importedIds);
    }
    setImportResult({ ok, errors, notes });
    setImporting(false);
    if (ok > 0) load();
  }

  importRef.current = importFile;

  /* Le dépôt s'écoute sur la fenêtre : sans un preventDefault au niveau du
     document, Chrome traite le lâcher comme une navigation et télécharge le
     fichier au lieu de le donner à la page. Le compteur et le dragleave hors
     fenêtre évitent qu'un survol annulé laisse l'overlay collé. */
  useEffect(() => {
    let profondeur = 0;
    const porteUnFichier = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes('Files');

    const onEnter = (e: DragEvent) => {
      if (!porteUnFichier(e)) return;
      profondeur += 1;
      setDragOver(true);
    };
    const onOver = (e: DragEvent) => {
      if (!porteUnFichier(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const onLeave = (e: DragEvent) => {
      profondeur = Math.max(0, profondeur - 1);
      if (profondeur === 0 || e.relatedTarget === null) setDragOver(false);
    };
    const relacher = () => { profondeur = 0; setDragOver(false); };
    const onDrop = (e: DragEvent) => {
      if (!porteUnFichier(e)) return;
      e.preventDefault();
      relacher();
      const file = e.dataTransfer?.files?.[0];
      if (file) void importRef.current(file);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') relacher(); };

    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragend', relacher);
    window.addEventListener('drop', onDrop);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragend', relacher);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('keydown', onEsc);
    };
  }, []);

  function jumpToDate(dateStr: string) {
    const target = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDay = today.getDay();
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() - (todayDay === 0 ? 6 : todayDay - 1));
    const targetDay = target.getDay();
    const targetMonday = new Date(target);
    targetMonday.setDate(target.getDate() - (targetDay === 0 ? 6 : targetDay - 1));
    const diffMs = targetMonday.getTime() - currentMonday.getTime();
    const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
    setWeek(diffWeeks);
    setShowDateNav(false);
  }

  return (
    <div className="space-y-6 relative">
      {dragOver && (
        <div className="fixed inset-0 z-40 bg-ax-overlay backdrop-blur-ax-glass flex items-center justify-center pointer-events-none">
          <div className="border-2 border-dashed border-ax-input-border rounded-ax-panel px-10 py-8 text-center bg-ax-glass">
            <Upload size={28} className="text-ax-text mx-auto mb-2" />
            <p className="text-base font-bold text-ax-text">Lâche ton fichier pour l&apos;importer</p>
            <p className="text-xs text-ax-text-secondary mt-1">PDF, CSV ou JSON — même parseur que le bouton « Importer ».</p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-medium uppercase tracking-wide text-ax-text">Whiteboard</h1>
            <HelpButton />
          </div>
          <p className="text-sm text-ax-text-muted mt-0.5">Calendrier des WODs de la semaine</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ax-outline" size="ax-compact" onClick={downloadTemplate} className={TOOLBAR_BTN}>
            <FileText size={13} /> Template CSV
          </Button>
          <Button variant="ax-outline" size="ax-compact" onClick={exportCSV} disabled={!wods.length} className={TOOLBAR_BTN}>
            <Download size={13} /> Exporter
          </Button>
          <label className={cn(buttonVariants({ variant: 'ax-outline', size: 'ax-compact' }), TOOLBAR_BTN, 'cursor-pointer', importing && 'opacity-60 pointer-events-none')}>
            {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {importing ? 'Import…' : 'Importer'}
            <input ref={fileInputRef} type="file" accept=".csv,.json,.pdf" className="hidden" onChange={handleImport} />
          </label>
          <Button
            variant="ax-outline"
            size="ax-compact"
            onClick={() => { setSelectMode(m => !m); setSelectedIds([]); }}
            title="Sélectionner plusieurs WOD pour les assigner à un groupe ou un programme"
            className={cn(TOOLBAR_BTN, selectMode && TOOLBAR_BTN_ON)}
          >
            <CheckSquare size={13} /> {selectMode ? 'Quitter la sélection' : 'Sélectionner'}
          </Button>
          <Button
            variant="ax-outline"
            size="ax-compact"
            onClick={() => setLayout(l => l === 'rows' ? 'columns' : 'rows')}
            title={layout === 'rows' ? 'Vue colonnes' : 'Vue lignes'}
            className={TOOLBAR_BTN}
          >
            {layout === 'rows' ? <LayoutGrid size={13} /> : <List size={13} />}
            {layout === 'rows' ? 'Colonnes' : 'Lignes'}
          </Button>
          <Button
            variant="ax-outline"
            size="ax-compact"
            onClick={deleteAllWodsThisWeek}
            disabled={!wods.length}
            title="Supprimer tous les WODs de la semaine affichée"
            className={cn(TOOLBAR_BTN, DANGER_OUTLINE)}
          >
            <Trash2 size={13} /> Tout supprimer
          </Button>
          <Button
            variant="ax-outline"
            size="ax-compact"
            onClick={() => setApplyModal({})}
            title="Poser une semaine type ou une programmation Marketplace"
            className={TOOLBAR_BTN}
          >
            <CalendarPlus size={13} /> Programmation
          </Button>
          <Button
            variant="ax-outline"
            size="ax-compact"
            onClick={() => setTemplateModal(true)}
            disabled={!wods.length}
            title="Recopier la semaine affichée dans une semaine type réutilisable"
            className={TOOLBAR_BTN}
          >
            <BookmarkPlus size={13} /> Enregistrer comme semaine type
          </Button>
          <Button
            variant="ax-outline"
            size="ax-compact"
            onClick={() => boxId && setCopySource({ kind: 'whiteboard', boxId, monday: toISO(weekDates[0]) })}
            disabled={!wods.length || offers.length === 0}
            title={offers.length === 0 ? 'Crée d’abord une offre dans Marketplace → Mes offres' : 'Copier la semaine affichée dans une semaine d’une de tes offres Marketplace'}
            className={TOOLBAR_BTN}
          >
            <Copy size={13} /> Copier vers une offre
          </Button>
          <Button variant="ax-white" size="ax-compact" onClick={() => openCreate(todayISO)} className="h-auto px-4 py-2 text-sm">
            <Plus size={15} /> Nouveau WOD
          </Button>
        </div>
      </div>

      {/* Sélection multiple : le geste d'assignation et son compte-rendu */}
      {selectMode && (
        <Card className="flex flex-wrap items-center gap-2 px-4 py-3">
          <p className="text-sm font-bold text-ax-text">
            {selectedIds.length} WOD{selectedIds.length > 1 ? 's' : ''} sélectionné{selectedIds.length > 1 ? 's' : ''}
          </p>
          <Button
            variant="ax-outline"
            size="ax-compact"
            onClick={() => setSelectedIds(selectedIds.length === wods.length ? [] : wods.map(w => w.id))}
            className={TOOLBAR_BTN}
          >
            {selectedIds.length === wods.length && wods.length > 0 ? 'Tout désélectionner' : 'Toute la semaine'}
          </Button>
          <Button
            variant="ax-white"
            size="ax-compact"
            onClick={() => setAssignModal(true)}
            disabled={selectedIds.length === 0}
            className="px-4 text-xs"
          >
            Assigner à…
          </Button>
        </Card>
      )}

      {assignModal && (
        <AssignRestrictionsModal
          wodIds={selectedIds}
          groups={refGroups}
          programs={refPrograms}
          onClose={() => setAssignModal(false)}
          onDone={(message) => {
            setAssignModal(false);
            setImportResult({ ok: 0, errors: [], notes: [message] });
            setSelectedIds([]);
            void load();
          }}
        />
      )}

      {boxId && (
        <SubscriptionBanner
          subscriptions={subscriptions}
          displayedMonday={toISO(weekDates[0])}
          onApplyNow={(subscriptionId, week) => setApplyModal({ subscriptionId, week })}
        />
      )}

      {boxId && auto.enabled && (
        <AutoProgrammingBanner
          boxId={boxId}
          tracks={auto.tracks}
          reveal={auto.reveal}
          runs={auto.runs}
          displayedMonday={toISO(weekDates[0])}
          onRan={(message) => {
            setImportResult({ ok: 0, errors: [], notes: [message] });
            void load();
            void loadAuto(boxId);
          }}
        />
      )}

      {/* Poser une semaine type ou une programmation Marketplace sur la semaine affichée */}
      {applyModal && boxId && (
        <ApplyProgramWeekModal
          boxId={boxId}
          defaultMonday={toISO(weekDates[0])}
          groups={groups}
          initialSubscriptionId={applyModal.subscriptionId}
          initialWeek={applyModal.week}
          onClose={() => setApplyModal(null)}
          onApplied={(summary) => {
            setApplyModal(null);
            setImportResult({ ok: summary.inserted, errors: [], notes: applyWeekNotes(summary) });
            void load();
            void loadMarketplace(boxId);
          }}
          onTemplateDeleted={() => setImportResult({ ok: 0, errors: [], notes: ['Semaine type supprimée. Les semaines déjà posées sur le Whiteboard restent.'] })}
          onCopyTemplateToOffer={offers.length > 0 ? (t) => {
            setApplyModal(null);
            setCopySource({ kind: 'template', boxId, templateId: t.id, templateTitle: t.title });
          } : undefined}
        />
      )}

      {copySource && (
        <CopyWeekToOfferModal
          source={copySource}
          onClose={() => setCopySource(null)}
          onCopied={({ offerTitle, week, copied, replaced }) => {
            setCopySource(null);
            setImportResult({
              ok: 0,
              errors: [],
              notes: [`${copied} WOD copié${copied > 1 ? 's' : ''} dans « ${offerTitle} », semaine ${week}${replaced ? ` (${replaced} remplacé${replaced > 1 ? 's' : ''})` : ''}. Publie l’offre depuis Marketplace → Mes offres quand toutes ses semaines sont remplies.`],
            });
            if (boxId) void loadMarketplace(boxId);
          }}
        />
      )}

      {/* Recopier la semaine affichée dans une semaine type réutilisable */}
      {templateModal && boxId && (
        <SaveWeekAsTemplateModal
          boxId={boxId}
          monday={toISO(weekDates[0])}
          onClose={() => setTemplateModal(false)}
          onSaved={({ title, wods: n, days, updated }) => {
            setTemplateModal(false);
            setImportResult({
              ok: 0,
              errors: [],
              notes: [`Semaine type « ${title} » ${updated ? 'mise à jour' : 'enregistrée'} : ${n} WOD sur ${days} jour(s). Applique-la depuis « Programmation ».`],
            });
          }}
        />
      )}

      {/* Confirm dialog (custom — replaces native confirm() which can be blocked by browser) */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[60] bg-ax-overlay backdrop-blur-ax-glass flex items-center justify-center p-4">
          <Card className="rounded-ax-panel shadow-ax-panel w-full max-w-md p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-10 h-10 rounded-ax-card flex items-center justify-center shrink-0 ${confirmDialog.danger ? 'bg-ax-danger-soft' : 'bg-ax-accent-soft'}`}>
                <Trash2 size={18} className={confirmDialog.danger ? 'text-ax-danger' : 'text-ax-accent-text'} />
              </div>
              <div className="flex-1">
                <h3 className="font-display text-lg font-medium uppercase tracking-wide text-ax-text mb-1">{confirmDialog.title}</h3>
                <p className="text-sm text-ax-text-secondary leading-relaxed">{confirmDialog.message}</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ax-outline" onClick={() => setConfirmDialog(null)}>
                Annuler
              </Button>
              <Button
                variant={confirmDialog.danger ? 'ax-outline' : 'ax-white'}
                onClick={async () => {
                  const cb = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  await cb();
                }}
                className={confirmDialog.danger ? 'border-ax-danger bg-ax-danger text-ax-background hover:brightness-110 hover:bg-ax-danger' : undefined}
              >
                {confirmDialog.confirmLabel ?? 'Confirmer'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {pdfFile && boxId && userId && (
        <PdfImportModal
          file={pdfFile}
          boxId={boxId}
          userId={userId}
          target={{ kind: 'whiteboard', defaultWeekStart: toISO(weekDates[0]), groups: refGroups, programs: refPrograms }}
          onClose={() => setPdfFile(null)}
          onDone={r => { setPdfFile(null); setImportResult(r); void load(); }}
        />
      )}

      {/* Import result */}
      {importResult && (
        <Card className={`px-4 py-3 text-sm ${importResult.errors.length > 0 ? 'bg-ax-warning-soft border-ax-warning' : 'bg-ax-success-soft border-ax-success'}`}>
          <div className="flex items-center justify-between">
            <p className={`font-bold ${importResult.errors.length > 0 ? 'text-ax-warning' : 'text-ax-success'}`}>
              {/* Zéro WOD posé n'est pas un enregistrement : un refus annoncé
                  par « ✅ Enregistré » se lit comme un import réussi. */}
              {importResult.ok > 0
                ? `✅ ${importResult.ok} WOD${importResult.ok > 1 ? 's' : ''} posé${importResult.ok > 1 ? 's' : ''}`
                : importResult.errors.length > 0 ? '⚠️ Rien n\u2019a été posé' : '✅ Fait'}
              {importResult.errors.length > 0 && ` — ⚠️ ${importResult.errors.length} erreur(s)`}
            </p>
            <button onClick={() => setImportResult(null)} className={cn(ICON_BTN, 'text-ax-text-muted hover:text-ax-text')}><X size={13} /></button>
          </div>
          {importResult.errors.map((e, i) => (
            <p key={i} className="text-xs text-ax-warning mt-1">{e}</p>
          ))}
          {(importResult.notes ?? []).map((n, i) => (
            <p key={`n${i}`} className="text-xs text-ax-success mt-1">{n}</p>
          ))}
        </Card>
      )}

      {/* Week nav */}
      <div className="relative">
        <Card className="flex items-center justify-between px-5 py-3">
          <button onClick={() => setWeek(w => w - 1)} className={cn(ICON_BTN, 'p-2 text-ax-text-secondary hover:text-ax-text')}>
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => setShowDateNav(v => !v)} className={cn(ICON_BTN, 'text-center hover:opacity-80 hover:bg-transparent transition-opacity group')}>
            <div className="flex items-center gap-2 justify-center">
              <Calendar size={14} className="text-ax-text-muted group-hover:text-ax-text transition-colors" />
              <p className="text-sm font-bold text-ax-text">
                {weekDates[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                {' — '}
                {weekDates[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            {weekOffset === 0 && <p className="text-xs text-ax-text font-semibold mt-0.5">Semaine actuelle</p>}
          </button>
          <button onClick={() => setWeek(w => w + 1)} className={cn(ICON_BTN, 'p-2 text-ax-text-secondary hover:text-ax-text')}>
            <ChevronRight size={18} />
          </button>
        </Card>
        {showDateNav && (
          <Card className="absolute top-full left-1/2 -translate-x-1/2 mt-2 rounded-ax-panel p-4 shadow-ax-panel z-30 min-w-[280px]">
            <p className="text-xs font-semibold text-ax-text-secondary mb-2 uppercase tracking-wider">Aller à une date</p>
            <Input
              type="date"
              onChange={(e) => { if (e.target.value) jumpToDate(e.target.value); }}
            />
            <div className="flex gap-2 mt-3">
              <Button variant="ax-outline" size="ax-compact" onClick={() => { setWeek(0); setShowDateNav(false); }} className="flex-1 text-xs">
                Aujourd&#39;hui
              </Button>
              <Button variant="ax-outline" size="ax-compact" onClick={() => setShowDateNav(false)} className="flex-1 text-xs text-ax-text-secondary hover:text-ax-text">
                Fermer
              </Button>
            </div>
          </Card>
        )}
        {weekOffset !== 0 && !showDateNav && (
          <div className="text-center mt-1">
            <button onClick={() => setWeek(0)} className={cn(ICON_BTN, 'px-2 text-xs text-ax-text-muted hover:text-ax-text font-semibold')}>
              ← Revenir à la semaine actuelle
            </button>
          </div>
        )}
      </div>

      {/* Calendar */}
      <TrackTabs tabs={tabs} active={activeTab} counts={tabCounts} onSelect={setTab} />

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-ax-text" size={28} /></div>
      ) : layout === 'columns' ? (
        <div className="overflow-x-auto pb-2" data-testid="grille-whiteboard">
        <div className="grid grid-cols-7 gap-2 min-h-[400px] min-w-[56rem]">
          {weekDates.map((d, i) => {
            const iso     = toISO(d);
            const isToday = iso === todayISO;
            const dayWODs = shownWods.filter(w => w.scheduled_date === iso);
            return (
              <div key={iso} className={`bg-ax-surface border rounded-ax-card overflow-hidden flex flex-col ${isToday ? 'border-ax-accent-text' : 'border-ax-border'}`}>
                <div className={`text-center px-2 py-3 ${isToday ? 'bg-ax-accent-soft' : ''}`}>
                  <p className={`text-xs font-black ${isToday ? 'text-ax-text' : 'text-ax-text-secondary'}`}>{DAY_LABELS[i]}</p>
                  <p className={`text-sm font-bold mt-0.5 ${isToday ? 'text-ax-text' : 'text-ax-text-secondary'}`}>
                    {d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </p>
                  {isToday && <span className="text-[9px] font-black text-ax-accent-text mt-0.5 block">Aujourd&#39;hui</span>}
                </div>
                <div className="flex-1 border-t border-ax-border p-2 space-y-2 min-h-[120px]">
                  {dayWODs.length === 0 ? (
                    <button onClick={() => openCreate(iso)} className={cn(ICON_BTN, 'w-full h-full min-h-[100px] flex flex-col items-center justify-center text-xs text-ax-text-muted hover:text-ax-text-secondary')}>
                      <Dumbbell size={16} className="mb-1.5 opacity-40" />
                      Ajouter
                    </button>
                  ) : (
                    <>
                      {dayWODs.map((wod, wi) => {
                        const wt = wod.wod_type ?? '';
                        const color = TYPE_COLOR[wt] ?? 'var(--ax-neutral)';
                        const received = wod.source_programming_id ? receivedMap[wod.source_programming_id] : undefined;
                        return (
                          <div
                            key={wod.id}
                            data-received={received ? 'true' : undefined}
                            className={`rounded-ax-card p-2.5 border bg-ax-surface-secondary hover:border-ax-input-border transition-colors motion-reduce:transition-none ${received ? 'border-2' : 'border-ax-border'} ${!wod.is_published ? 'border-dashed' : ''}`}
                            style={{
                              ...(received ? { borderColor: received.color } : {}),
                              // Liseré de piste : lisible en vue « Tout », où
                              // les trois pistes se côtoient.
                              ...(trackAccent(wod) ? { borderLeftColor: trackAccent(wod), borderLeftWidth: 3 } : {}),
                            }}
                          >
                            {received && (
                              <p className="text-[9px] font-bold break-words mb-1 flex items-start gap-1" style={{ color: received.textColor }} title={`Reçu de la programmation « ${received.title} »`}>
                                <Lock size={8} className="shrink-0 mt-px" /> <span className="min-w-0">Prog : {received.title}</span>
                              </p>
                            )}
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <TrackBadge wod={wod} />
                              <AutoBadge wod={wod} />
                              {wod.block_name && <span className="text-[8px] font-black tracking-wider px-1 py-0.5 rounded-ax-badge" style={{ backgroundColor: softVar(BLOCK_COLOR[wod.block_name], 0.125), color: textTint(BLOCK_COLOR[wod.block_name]) }}>{BLOCK_LABEL[wod.block_name]}</span>}
                              {wt && <><div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} /><span className="text-[9px] font-black tracking-wider" style={{ color: textTint(color) }}>{wt.toUpperCase()}</span></>}
                              {wod.video_url && <Video size={9} className="text-ax-danger shrink-0" />}
                              {!wod.is_published && <EyeOff size={9} className="text-ax-warning shrink-0" />}
                              {wod.publish_at && new Date(wod.publish_at) > new Date() && <span className="text-[8px] font-bold text-ax-info">⏰ {new Date(wod.publish_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>}
                            </div>
                            <div className="flex items-start gap-1.5">
                              {selectMode && (
                                <button onClick={() => toggleSelected(wod.id)} className="mt-0.5 shrink-0" title="Sélectionner ce WOD">
                                  {selectedIds.includes(wod.id)
                                    ? <CheckSquare size={13} className="text-ax-text" />
                                    : <Square size={13} className="text-ax-text-muted" />}
                                </button>
                              )}
                              <p className="text-xs font-bold text-ax-text break-words min-w-0">{wod.title}</p>
                            </div>
                            {wod.description && <p className="text-[10px] text-ax-text-muted whitespace-pre-line break-words mt-0.5">{wod.description}</p>}
                            <div className="mt-1">
                              <RestrictionBadges
                                compact
                                audience={wod.audience}
                                groupIds={wodGroupMap[wod.id] ?? []}
                                programIds={wodProgramMap[wod.id] ?? []}
                                groups={refGroups}
                                programs={refPrograms}
                              />
                            </div>
                            <div className="flex items-center gap-0.5 mt-2 pt-1.5 border-t border-ax-border">
                              <button onClick={() => moveWodToDay(wod, 'prev')} className={ICON_BTN} title="Jour précédent">
                                <ArrowLeft size={11} className="text-ax-text-secondary" />
                              </button>
                              <button onClick={() => moveWodToDay(wod, 'next')} className={ICON_BTN} title="Jour suivant">
                                <ArrowRight size={11} className="text-ax-text-secondary" />
                              </button>
                              {dayWODs.length > 1 && (
                                <>
                                  <button onClick={() => moveWod(iso, wi, 'up')} disabled={wi === 0} className={cn(ICON_BTN, 'disabled:opacity-25')} title="Monter">
                                    <ChevronUp size={11} className="text-ax-text-secondary" />
                                  </button>
                                  <button onClick={() => moveWod(iso, wi, 'down')} disabled={wi === dayWODs.length - 1} className={cn(ICON_BTN, 'disabled:opacity-25')} title="Descendre">
                                    <ChevronDown size={11} className="text-ax-text-secondary" />
                                  </button>
                                </>
                              )}
                              <button onClick={() => togglePublish(wod)} className={ICON_BTN} title={wod.is_published ? 'Dépublier' : 'Publier'}>
                                {wod.is_published ? <Eye size={11} className="text-ax-success" /> : <EyeOff size={11} className="text-ax-text-muted" />}
                              </button>
                              <button
                                onClick={() => openEdit(wod)}
                                disabled={!!received}
                                title={received ? 'Programmation Marketplace, non modifiable' : 'Modifier'}
                                className={cn(ICON_BTN, 'disabled:opacity-30 disabled:cursor-not-allowed')}
                              >
                                <Pencil size={11} className="text-ax-text" />
                              </button>
                              <button onClick={() => deleteWOD(wod)} className={cn(ICON_BTN, 'hover:bg-ax-danger-soft')}>
                                <Trash2 size={11} className="text-ax-danger" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      <button onClick={() => openCreate(iso)} className={cn(ICON_BTN, 'w-full py-1.5 text-center text-[10px] text-ax-text font-semibold')}>
                        <Plus size={10} className="inline mr-0.5 -mt-px" /> Ajouter
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </div>
      ) : (
        <div className="space-y-3">
          {weekDates.map((d, i) => {
            const iso     = toISO(d);
            const isToday = iso === todayISO;
            const dayWODs = shownWods.filter(w => w.scheduled_date === iso);
            return (
              <div key={iso} className={`bg-ax-surface border rounded-ax-card overflow-hidden ${isToday ? 'border-ax-accent-text' : 'border-ax-border'}`}>
                {/* Day header */}
                <div className={`flex items-center justify-between px-5 py-3 ${isToday ? 'bg-ax-accent-soft' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-black ${isToday ? 'text-ax-text' : 'text-ax-text-secondary'}`}>
                      {DAY_LABELS[i]}
                    </span>
                    <span className={`text-sm font-bold ${isToday ? 'text-ax-text' : 'text-ax-text-secondary'}`}>
                      {d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                    {isToday && (
                      <span className="text-[10px] font-black text-ax-accent-text bg-ax-accent-soft border border-current px-2 py-0.5 rounded-ax-badge uppercase tracking-wider">
                        Aujourd'hui
                      </span>
                    )}
                    <span className="text-xs text-ax-text-muted">{dayWODs.length > 0 ? `${dayWODs.length} WOD${dayWODs.length > 1 ? 's' : ''}` : ''}</span>
                  </div>
                  <button
                    onClick={() => openCreate(iso)}
                    className={cn(ICON_BTN, 'flex items-center gap-1.5 px-2 text-xs text-ax-text font-semibold')}
                  >
                    <Plus size={14} /> Ajouter
                  </button>
                </div>

                {/* WODs list */}
                {dayWODs.length === 0 ? (
                  <button
                    onClick={() => openCreate(iso)}
                    className={cn(ICON_BTN, 'w-full flex items-center justify-center gap-2 py-5 text-sm text-ax-text-muted hover:text-ax-text-secondary border-t border-ax-border rounded-none')}
                  >
                    <Dumbbell size={14} /> Aucun WOD — cliquez pour en ajouter
                  </button>
                ) : (
                  <div className="border-t border-ax-border divide-y divide-ax-border">
                    {dayWODs.map((wod, wi) => {
                      const wt = wod.wod_type ?? '';
                      const color = TYPE_COLOR[wt] ?? 'var(--ax-neutral)';
                      const received = wod.source_programming_id ? receivedMap[wod.source_programming_id] : undefined;
                      return (
                        <div
                          key={wod.id}
                          data-received={received ? 'true' : undefined}
                          className={`flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-2 px-4 sm:px-5 py-3.5 ${received ? 'border-2 rounded-ax-card my-1 mx-1' : ''} ${!wod.is_published ? 'bg-ax-surface-secondary' : ''}`}
                          style={received ? { borderColor: received.color } : undefined}
                        >
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button onClick={() => moveWod(iso, wi, 'up')} disabled={wi === 0 || dayWODs.length < 2} className={cn(ICON_BTN, 'disabled:opacity-25')} title="Monter">
                              <ChevronUp size={14} className="text-ax-text-secondary" />
                            </button>
                            <button onClick={() => moveWod(iso, wi, 'down')} disabled={wi === dayWODs.length - 1 || dayWODs.length < 2} className={cn(ICON_BTN, 'disabled:opacity-25')} title="Descendre">
                              <ChevronDown size={14} className="text-ax-text-secondary" />
                            </button>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => moveWodToDay(wod, 'prev')} className={ICON_BTN} title="Jour précédent">
                              <ArrowLeft size={14} className="text-ax-text-secondary" />
                            </button>
                            <button onClick={() => moveWodToDay(wod, 'next')} className={ICON_BTN} title="Jour suivant">
                              <ArrowRight size={14} className="text-ax-text-secondary" />
                            </button>
                          </div>
                          {/* Le liseré de cette vue portait la couleur du bloc ;
                              la piste prime quand il y en a une. */}
                          <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: trackAccent(wod) ?? (wod.block_name ? (BLOCK_COLOR[wod.block_name] ?? color) : color) }} />
                          {selectMode && (
                            <button onClick={() => toggleSelected(wod.id)} className="shrink-0 mr-1" title="Sélectionner ce WOD">
                              {selectedIds.includes(wod.id)
                                ? <CheckSquare size={16} className="text-ax-text" />
                                : <Square size={16} className="text-ax-text-muted" />}
                            </button>
                          )}
                          <div className="flex-1 min-w-0 basis-full sm:basis-auto">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <TrackBadge wod={wod} />
                              <AutoBadge wod={wod} />
                              {wod.block_name && (
                                <span className="text-[10px] font-black tracking-wider px-1.5 py-0.5 rounded-ax-badge" style={{ backgroundColor: softVar(BLOCK_COLOR[wod.block_name], 0.125), color: textTint(BLOCK_COLOR[wod.block_name]) }}>
                                  {BLOCK_LABEL[wod.block_name]}
                                </span>
                              )}
                              {wt && (
                                <span className="text-[10px] font-black tracking-wider" style={{ color: textTint(color) }}>
                                  {wt.toUpperCase()}
                                </span>
                              )}
                              {wod.video_url && (
                                <span className="text-[9px] font-black text-ax-danger bg-ax-danger-soft border border-current px-1.5 py-0.5 rounded-ax-badge uppercase tracking-wider flex items-center gap-0.5">
                                  <Video size={9} /> Vidéo
                                </span>
                              )}
                              {!wod.is_published && (
                                <span className="text-[9px] font-black text-ax-warning bg-ax-warning-soft border border-current px-1.5 py-0.5 rounded-ax-badge uppercase tracking-wider">
                                  Brouillon
                                </span>
                              )}
                              {received && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-ax-badge flex items-center gap-1" style={{ color: received.textColor, backgroundColor: softVar(received.color, 0.125) }} title={`Reçu de la programmation « ${received.title} »`}>
                                  <Lock size={9} /> Prog : {received.title}
                                </span>
                              )}
                              <RestrictionBadges
                                audience={wod.audience}
                                groupIds={wodGroupMap[wod.id] ?? []}
                                programIds={wodProgramMap[wod.id] ?? []}
                                groups={refGroups}
                                programs={refPrograms}
                              />
                            </div>
                            <p className="text-sm font-bold text-ax-text break-words">{wod.title}</p>
                            {wod.description && (
                              <p className="text-xs text-ax-text-muted whitespace-pre-line break-words mt-0.5">{wod.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-auto sm:ml-0">
                            {wod.time_cap_seconds && (
                              <span className="text-xs text-ax-text-muted mr-2">{formatCap(wod.time_cap_seconds)}</span>
                            )}
                            <button
                              onClick={() => togglePublish(wod)}
                              title={wod.is_published ? 'Dépublier' : 'Publier'}
                              className={cn(ICON_BTN, 'p-2')}
                            >
                              {wod.is_published
                                ? <Eye size={15} className="text-ax-success" />
                                : <EyeOff size={15} className="text-ax-text-muted" />}
                            </button>
                            <button
                              onClick={() => openEdit(wod)}
                              disabled={!!received}
                              title={received ? 'Programmation Marketplace, non modifiable' : 'Modifier'}
                              className={cn(ICON_BTN, 'p-2 disabled:opacity-30 disabled:cursor-not-allowed')}
                            >
                              <Pencil size={14} className="text-ax-text" />
                            </button>
                            <button onClick={() => deleteWOD(wod)} className={cn(ICON_BTN, 'p-2 hover:bg-ax-danger-soft')}>
                              <Trash2 size={14} className="text-ax-danger" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <WodEditor
          mode="whiteboard"
          heading={editWOD ? 'Modifier le WOD' : 'Créer un WOD'}
          submitLabel={editWOD ? 'Enregistrer' : 'Créer le WOD'}
          form={form}
          setForm={setForm}
          movements={movements}
          setMovements={setMovements}
          saving={saving}
          error={formError}
          onClose={() => setModal(false)}
          onSubmit={saveWOD}
          groups={groups}
          programs={boxPrograms}
          offers={offers}
        />
      )}
    </div>
  );
}
