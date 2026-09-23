'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getMemberEmails } from '@/lib/memberEmails';
import TemplatesDrawer from '@/components/TemplatesDrawer';
import HelpButton from '@/components/help/HelpButton';
import {
  Plus, ChevronLeft, ChevronRight, Pencil, Trash2,
  Users, X, Loader2, Clock, Timer, CalendarCheck, LayoutTemplate, UserMinus,
  Check, Download, UserPlus, Search, AlertTriangle, AlertCircle, ClipboardCheck, CalendarDays,
} from 'lucide-react';
import { getMyBox } from '@/lib/getMyBox';
import { writeFailure } from '@/lib/writeGuard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const FOCUS_CLS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface';
const ICON_BTN = `rounded-ax-control text-ax-text-secondary hover:text-ax-text hover:bg-ax-hover transition-colors motion-reduce:transition-none ${FOCUS_CLS}`;
const LABEL_CLS = 'text-xs font-bold text-ax-text-secondary uppercase tracking-wider mb-2 block';
const CHIP_CLS = `px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors break-words text-left ${FOCUS_CLS}`;
const CHIP_ON = 'bg-ax-text border-ax-text text-ax-background';
const CHIP_OFF = 'bg-transparent border-ax-input-border text-ax-text-secondary hover:bg-ax-hover hover:text-ax-text';
const OVERLAY_CLS = 'fixed inset-0 bg-ax-overlay backdrop-blur-ax-glass flex items-center justify-center z-50 p-4';
const PANEL_CLS = 'w-full rounded-ax-panel shadow-ax-panel';
const TEXTAREA_CLS = `w-full min-h-[5.5rem] [field-sizing:content] rounded-ax-control border border-ax-input-border bg-ax-surface px-3 py-2.5 text-base sm:text-sm text-ax-text placeholder:text-ax-text-muted resize-none transition-colors ${FOCUS_CLS}`;
const KICK_CLS = `opacity-0 group-hover:opacity-100 p-1.5 rounded-ax-control hover:bg-ax-danger-soft text-ax-text-secondary hover:text-ax-danger transition-all ${FOCUS_CLS}`;
// Présent / absent / non marqué : la case porte aussi une icône (✓ / ✕ / vide) et un title.
const ATT_CLS = (attended: boolean | null) =>
  attended === true
    ? 'bg-ax-success border-ax-success'
    : attended === false
    ? 'bg-ax-danger-soft border-ax-danger'
    : 'bg-transparent border-ax-input-border hover:border-ax-text-secondary';

interface Participant {
  reservation_id: string;
  /** Null pour un essai : la ligne porte un prospect, pas un adhérent. */
  member_id: string | null;
  prospect_id: string | null;
  is_trial: boolean;
  username: string;
  avatar_url: string | null;
  email: string;
  status: 'confirmed' | 'waiting';
  attended: boolean | null;
  created_at: string;
}

interface ClassSchedule {
  id: string;
  box_id: string;
  title: string;
  description: string | null;
  coach: string | null;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
  created_at: string;
  confirmed_count: number;
  waiting_count: number;
  pointed_count: number;
}

const CLASS_TYPES = [
  'WOD', 'Haltérophilie', 'Cardio', 'Open Gym',
  'Strength', 'Mobility', 'Kids', 'Teens', 'Autre',
];

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

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

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toISO(d);
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="w-8 h-8 rounded-full object-cover shrink-0" />;
  }
  return (
    <div className="w-8 h-8 rounded-full bg-ax-surface-secondary flex items-center justify-center text-[11px] font-black text-ax-text shrink-0">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const EMPTY_FORM = {
  title: 'WOD',
  customTitle: '',
  description: '',
  coach: '',
  date: '',
  startTime: '09:00',
  endTime: '10:00',
  maxCapacity: '15',
};

export default function SchedulesPage() {
  const supabase = createClient();

  const [schedules,  setSchedules]  = useState<ClassSchedule[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [weekOffset, setWeek]       = useState(0);
  const [boxId,      setBoxId]      = useState<string | null>(null);

  // Feuille de présence : sa propre vue, sur un jour, indépendante de la grille.
  const [tab,        setTab]        = useState<'presences' | 'grille'>('presences');
  const [dayISO,     setDayISO]     = useState<string>(() => toISO(new Date()));
  const [dayItems,   setDayItems]   = useState<ClassSchedule[]>([]);
  const [dayLoading, setDayLoading] = useState(true);
  const [nextSlotId, setNextSlotId] = useState<string | null>(null);

  const [modal,     setModal]     = useState(false);
  const [editItem,  setEditItem]  = useState<ClassSchedule | null>(null);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,      setSaving]      = useState(false);
  const [formError,   setFormError]   = useState<string | null>(null);
  const [generating,      setGenerating]      = useState(false);
  const [showTemplates,   setShowTemplates]   = useState(false);

  // Detail modal state
  const [detailItem,    setDetailItem]    = useState<ClassSchedule | null>(null);
  const [participants,  setParticipants]  = useState<Participant[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [kicking,       setKicking]       = useState<string | null>(null);
  const [togglingAtt,   setTogglingAtt]   = useState<string | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberSearch,  setMemberSearch]  = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; username: string; email: string }[]>([]);
  const [searching,     setSearching]     = useState(false);

  const [coaches, setCoaches] = useState<{ id: string; username: string }[]>([]);

  // Coverage: how many days until the last generated slot?
  const [lastDateISO, setLastDateISO] = useState<string | null>(null);

  const weekDates = getWeekDates(weekOffset);
  const todayISO  = toISO(new Date());

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const box = await getMyBox(supabase);
      if (box?.id) setBoxId(box.id);
    })();
  }, []);

  // Fetch coaches for the current box
  useEffect(() => {
    if (!boxId) return;
    (async () => {
      const { data } = await supabase
        .from('box_members')
        .select('member_id, profiles:member_id(username)')
        .eq('box_id', boxId)
        .eq('role', 'coach');
      setCoaches(
        (data ?? []).map((c: any) => ({
          id: c.member_id,
          username: (Array.isArray(c.profiles) ? c.profiles[0] : c.profiles)?.username ?? 'Coach',
        }))
      );
    })();
  }, [boxId]);

  // Fetch the furthest generated scheduled_date (coverage horizon)
  const loadCoverage = useCallback(async () => {
    if (!boxId) return;
    const { data } = await supabase
      .from('class_schedules')
      .select('scheduled_date')
      .eq('box_id', boxId)
      .gte('scheduled_date', todayISO)
      .order('scheduled_date', { ascending: false })
      .limit(1);
    setLastDateISO(data?.[0]?.scheduled_date ?? null);
  }, [boxId, todayISO]);

  useEffect(() => { loadCoverage(); }, [loadCoverage]);

  // Créneaux d'une période + compteurs (inscrits, attente, déjà pointés).
  const fetchRange = useCallback(async (startISO: string, endISO: string): Promise<ClassSchedule[]> => {
    if (!boxId) return [];
    const { data } = await supabase
      .from('class_schedules')
      .select('*')
      .eq('box_id', boxId)
      .gte('scheduled_date', startISO)
      .lte('scheduled_date', endISO)
      .order('scheduled_date')
      .order('start_time');

    const rawItems = (data ?? []) as Omit<ClassSchedule, 'confirmed_count' | 'waiting_count' | 'pointed_count'>[];
    let items: ClassSchedule[] = rawItems.map(s => ({ ...s, confirmed_count: 0, waiting_count: 0, pointed_count: 0 }));
    if (rawItems.length === 0) return items;

    const ids = rawItems.map(s => s.id);
    const { data: resCounts } = await supabase
      .from('class_reservations')
      .select('schedule_id, status, attended')
      .in('schedule_id', ids);
    const confirmedMap: Record<string, number> = {};
    const waitingMap:   Record<string, number> = {};
    const pointedMap:   Record<string, number> = {};
    ids.forEach(id => { confirmedMap[id] = 0; waitingMap[id] = 0; pointedMap[id] = 0; });
    (resCounts ?? []).forEach((r: { schedule_id: string; status: string; attended: boolean | null }) => {
      if (confirmedMap[r.schedule_id] === undefined) return;
      if (r.status === 'waiting') waitingMap[r.schedule_id]++;
      else                        confirmedMap[r.schedule_id]++;
      if (r.attended !== null) pointedMap[r.schedule_id]++;
    });
    return items.map(s => ({
      ...s,
      confirmed_count: confirmedMap[s.id] ?? 0,
      waiting_count:   waitingMap[s.id] ?? 0,
      pointed_count:   pointedMap[s.id] ?? 0,
    }));
  }, [boxId]);

  const load = useCallback(async () => {
    if (!boxId) return;
    setLoading(true);
    setSchedules(await fetchRange(toISO(weekDates[0]), toISO(weekDates[6])));
    setLoading(false);
  }, [boxId, weekOffset, fetchRange]);

  useEffect(() => { load(); }, [load]);

  const loadDay = useCallback(async () => {
    if (!boxId) return;
    setDayLoading(true);
    const items = await fetchRange(dayISO, dayISO);
    setDayItems(items);
    // « Prochain cours » n'a de sens qu'aujourd'hui : c'est le premier créneau
    // qui n'est pas encore terminé. L'heure est lue au chargement, côté client.
    const now = new Date().toTimeString().slice(0, 5);
    setNextSlotId(
      dayISO === toISO(new Date())
        ? items.find(s => s.end_time.slice(0, 5) >= now)?.id ?? null
        : null,
    );
    setDayLoading(false);
  }, [boxId, dayISO, fetchRange]);

  useEffect(() => { loadDay(); }, [loadDay]);

  function openCreate(selectedDate: string) {
    setEditItem(null);
    setForm({ ...EMPTY_FORM, date: selectedDate });
    setFormError(null);
    setModal(true);
  }

  function openEdit(item: ClassSchedule) {
    const isPreset = CLASS_TYPES.slice(0, -1).includes(item.title);
    setEditItem(item);
    setForm({
      title: isPreset ? item.title : 'Autre',
      customTitle: isPreset ? '' : item.title,
      description: item.description ?? '',
      coach: item.coach ?? '',
      date: item.scheduled_date,
      startTime: item.start_time,
      endTime: item.end_time,
      maxCapacity: String(item.max_capacity),
    });
    setFormError(null);
    setModal(true);
  }

  async function handleSave() {
    const finalTitle = form.title === 'Autre' ? form.customTitle.trim() : form.title;
    if (!finalTitle || !form.date || !form.startTime || !form.endTime || !boxId) {
      setFormError('Titre, date et horaires sont requis.');
      return;
    }
    const cap = parseInt(form.maxCapacity);
    if (isNaN(cap) || cap < 1) { setFormError('Capacité invalide.'); return; }

    setSaving(true);
    setFormError(null);

    const payload = {
      box_id: boxId,
      title: finalTitle,
      description: form.description.trim() || null,
      coach: form.coach.trim() || null,
      scheduled_date: form.date,
      start_time: form.startTime,
      end_time: form.endTime,
      max_capacity: cap,
    };

    const { error } = editItem
      ? await supabase.from('class_schedules').update(payload).eq('id', editItem.id)
      : await supabase.from('class_schedules').insert(payload);

    setSaving(false);
    if (error) { setFormError(error.message); return; }
    setModal(false);
    load();
  }

  async function generateFromTemplate() {
    if (!boxId) return;
    setGenerating(true);

    // Pre-check: at least one active template
    const { data: tpls } = await supabase
      .from('schedule_templates')
      .select('id')
      .eq('box_id', boxId)
      .eq('is_active', true)
      .limit(1);

    if (!tpls || tpls.length === 0) {
      alert('Aucun modèle actif. Crée des créneaux types dans "Modèle semaine" d\'abord.');
      setGenerating(false);
      return;
    }

    // Generate 8 weeks ahead via RPC (idempotent, server-side).
    // A daily cron then maintains the 8-week rolling window automatically.
    const { data, error } = await supabase.rpc('generate_class_schedules_from_templates', {
      p_box_id: boxId,
      p_weeks_ahead: 8,
    });

    setGenerating(false);
    if (error) { alert('Erreur : ' + error.message); return; }

    const inserted = (data as number) ?? 0;
    if (inserted === 0) {
      alert('Tous les créneaux des 8 prochaines semaines sont déjà générés.');
    } else {
      alert(`${inserted} créneaux générés sur 8 semaines.\nLa génération se prolongera automatiquement chaque jour.`);
    }
    load();
    loadCoverage();
  }

  async function openDetail(item: ClassSchedule) {
    setDetailItem(item);
    setParticipants([]);
    setDetailLoading(true);
    setAddMemberOpen(false);
    setMemberSearch('');
    const { data } = await supabase
      .from('class_reservations')
      .select('id, member_id, prospect_id, is_trial, status, attended, created_at, profile:profiles(username, avatar_url), prospect:box_prospects(first_name, last_name, email)')
      .eq('schedule_id', item.id)
      .order('created_at', { ascending: true });
    const emails = boxId ? await getMemberEmails(supabase, boxId) : new Map<string, string>();
    const list: Participant[] = (data ?? []).map((r: any) => {
      const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
      const pr = Array.isArray(r.prospect) ? r.prospect[0] : r.prospect;
      const trialName = pr ? [pr.first_name, pr.last_name].filter(Boolean).join(' ') : 'Essai';
      return {
        reservation_id: r.id,
        member_id: r.member_id ?? null,
        prospect_id: r.prospect_id ?? null,
        is_trial: Boolean(r.is_trial),
        username: r.is_trial ? trialName : (p?.username ?? '?'),
        avatar_url: p?.avatar_url ?? null,
        email: r.is_trial ? (pr?.email ?? '') : (r.member_id ? emails.get(r.member_id) ?? '' : ''),
        status: r.status,
        attended: r.attended ?? null,
        created_at: r.created_at,
      };
    });
    setParticipants(list);
    setDetailLoading(false);
  }

  async function toggleAttendance(reservationId: string, current: boolean | null) {
    const next = current === true ? false : true;
    setTogglingAtt(reservationId);
    setParticipants(prev => prev.map(p => p.reservation_id === reservationId ? { ...p, attended: next } : p));
    const { data, error } = await supabase
      .from('class_reservations')
      .update({ attended: next })
      .eq('id', reservationId)
      .select('id');
    const fail = writeFailure(error, data);
    if (fail) {
      alert('Erreur : ' + fail);
      setParticipants(prev => prev.map(p => p.reservation_id === reservationId ? { ...p, attended: current } : p));
    } else {
      await syncProspectStatus(reservationId, next);
      if (current === null) {
      // Le compteur « n pointés » de la vue du jour suit le pointage sans
      // relire tout le créneau.
        setDayItems(prev => prev.map(s => s.id === detailItem?.id ? { ...s, pointed_count: s.pointed_count + 1 } : s));
      }
    }
    setTogglingAtt(null);
  }

  /**
   * Le pointage du coach fait avancer le prospect : présent → « venu »,
   * absent → « pas venu ». Un prospect déjà converti ou perdu ne redescend
   * pas dans le tunnel : le filtre de statut le protège, et zéro ligne
   * touchée est alors le résultat attendu, pas un échec.
   */
  async function syncProspectStatus(reservationId: string, attended: boolean) {
    const p = participants.find(x => x.reservation_id === reservationId);
    if (!p?.is_trial || !p.prospect_id) return;
    const { error } = await supabase
      .from('box_prospects')
      .update({ status: attended ? 'venu' : 'pas_venu' })
      .eq('id', p.prospect_id)
      .in('status', ['essai_reserve', 'venu', 'pas_venu', 'relance']);
    if (error) alert('Statut du prospect non mis à jour : ' + error.message);
  }

  function exportAttendanceCSV() {
    if (!detailItem || participants.length === 0) return;
    const header = 'Nom,Email,Statut,Présent,Type';
    const rows = participants.map(p =>
      `"${p.username}","${p.email}","${p.status}","${p.attended === true ? 'Oui' : p.attended === false ? 'Non' : '-'}","${p.is_trial ? 'Essai' : 'Adhérent'}"`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `presence_${detailItem.title}_${detailItem.scheduled_date}_${detailItem.start_time}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function searchMembers(query: string) {
    setMemberSearch(query);
    if (query.length < 3 || !boxId) { setSearchResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from('box_members')
      .select('member_id, profiles:member_id(id, username)')
      .eq('box_id', boxId)
      .eq('status', 'active');
    const emails = await getMemberEmails(supabase, boxId);
    const existingIds = new Set(participants.map(p => p.member_id).filter((v): v is string => !!v));
    const results = (data ?? [])
      .map((m: any) => {
        const pr = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
        return { id: pr?.id ?? m.member_id, username: pr?.username ?? '?', email: emails.get(m.member_id) ?? '' };
      })
      .filter((m: any) => !existingIds.has(m.id) && m.username.toLowerCase().includes(query.toLowerCase()));
    setSearchResults(results);
    setSearching(false);
  }

  async function addMemberToSlot(memberId: string, username: string, email: string) {
    if (!detailItem || !boxId) return;
    // La capacité est arbitrée en base (trigger enforce_reservation_capacity),
    // qui bascule la ligne en 'waiting' quand le créneau est plein : on relit le
    // statut réellement enregistré plutôt que d'afficher un « confirmé » faux.
    const { data: inserted, error } = await supabase
      .from('class_reservations')
      .insert({
        schedule_id: detailItem.id,
        member_id: memberId,
        box_id: boxId,
        status: 'confirmed',
        attended: true,
      })
      .select('id, status')
      .single();
    if (error) {
      if (error.code === '23505') alert('Ce membre est déjà inscrit à ce créneau.');
      else alert('Erreur : ' + error.message);
      return;
    }
    const savedStatus = inserted?.status ?? 'confirmed';
    if (savedStatus !== 'confirmed') {
      alert(`Créneau complet (${detailItem.max_capacity} places) : ${username} est placé en liste d'attente.`);
    }
    setParticipants(prev => [
      ...prev,
      { reservation_id: inserted?.id ?? `tmp-${memberId}`, member_id: memberId, prospect_id: null, is_trial: false, username, avatar_url: null, email, status: savedStatus, attended: savedStatus === 'confirmed', created_at: new Date().toISOString() },
    ]);
    setAddMemberOpen(false);
    setMemberSearch('');
    load();
    loadDay();
  }

  async function kickMember(reservationId: string) {
    if (!confirm('Retirer ce membre du créneau ?')) return;
    setKicking(reservationId);
    const { data, error } = await supabase
      .from('class_reservations').delete().eq('id', reservationId).select('id');
    const fail = writeFailure(error, data);
    if (fail) {
      alert(`Impossible de retirer ce membre : ${fail}`);
      setKicking(null);
      return;
    }
    setParticipants(prev => prev.filter(p => p.reservation_id !== reservationId));
    // Update counts in schedule list
    if (detailItem) {
      const kicked = participants.find(p => p.reservation_id === reservationId);
      if (kicked) {
        setDetailItem(prev => prev ? {
          ...prev,
          confirmed_count: prev.confirmed_count - (kicked.status === 'confirmed' ? 1 : 0),
          waiting_count: prev.waiting_count - (kicked.status === 'waiting' ? 1 : 0),
        } : prev);
        setSchedules(prev => prev.map(s => s.id === detailItem.id ? {
          ...s,
          confirmed_count: s.confirmed_count - (kicked.status === 'confirmed' ? 1 : 0),
          waiting_count: s.waiting_count - (kicked.status === 'waiting' ? 1 : 0),
        } : s));
      }
    }
    setKicking(null);
    // Re-fetch to get updated promotion status
    if (detailItem) openDetail(detailItem);
  }

  async function handleDelete(item: ClassSchedule) {
    if (!confirm(`Supprimer « ${item.title} — ${item.start_time} » ?`)) return;
    const { data, error } = await supabase
      .from('class_schedules').delete().eq('id', item.id).select('id');
    const fail = writeFailure(error, data);
    if (fail) { alert(`Suppression impossible : ${fail}`); return; }
    load();
  }

  const weekLabel = `${
    weekDates[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  } — ${
    weekDates[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  }`;

  return (
    <>
    <TemplatesDrawer open={showTemplates} onClose={() => setShowTemplates(false)} boxId={boxId} />
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-medium uppercase tracking-wide text-ax-text">Horaires & Créneaux</h1>
            <HelpButton />
          </div>
          <p className="text-sm text-ax-text-secondary mt-1">Gérez les créneaux de cours de votre box</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ax-outline" onClick={() => setShowTemplates(true)}>
            <LayoutTemplate size={16} />
            Créneaux types
          </Button>
          <Button variant="ax-outline" onClick={generateFromTemplate} disabled={generating}>
            {generating ? <Loader2 size={16} className="animate-spin" /> : <CalendarCheck size={16} />}
            Générer 8 semaines
          </Button>
          <Button variant="ax-white" onClick={() => openCreate(todayISO)}>
            <Plus size={16} />
            Nouveau créneau
          </Button>
        </div>
      </div>

      {/* Coverage reminder banner */}
      {(() => {
        if (!lastDateISO) return null;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const last = new Date(lastDateISO + 'T00:00:00');
        const daysLeft = Math.round((last.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft >= 14) return null;

        const urgent = daysLeft < 7;
        const expired = daysLeft < 0;
        const Icon = urgent ? AlertCircle : AlertTriangle;
        const lastFr = last.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

        return (
          <div
            className={`flex flex-wrap sm:flex-nowrap items-start gap-3 rounded-ax-card px-4 sm:px-5 py-4 border ${
              urgent
                ? 'bg-ax-danger-soft border-ax-danger'
                : 'bg-ax-warning-soft border-ax-warning'
            }`}
          >
            <Icon size={20} className={urgent ? 'text-ax-danger mt-0.5 shrink-0' : 'text-ax-warning mt-0.5 shrink-0'} />
            <div className="flex-1 min-w-0 basis-[12rem]">
              <p className={`text-sm font-bold ${urgent ? 'text-ax-danger' : 'text-ax-warning'}`}>
                {expired
                  ? 'Plus aucun créneau futur !'
                  : urgent
                    ? `Plus que ${daysLeft} jour${daysLeft > 1 ? 's' : ''} de créneaux générés`
                    : `${daysLeft} jours de créneaux restants`}
              </p>
              <p className="text-xs text-ax-text-secondary mt-1">
                {expired
                  ? `Le dernier créneau était le ${lastFr}. Génère 8 nouvelles semaines pour permettre aux membres de réserver.`
                  : `Dernier créneau planifié : ${lastFr}. Pense à relancer la génération pour étendre la fenêtre de réservation.`}
              </p>
            </div>
            <button
              onClick={generateFromTemplate}
              disabled={generating}
              className={`flex items-center gap-2 text-xs font-bold px-3 py-2 min-h-8 rounded-ax-control transition hover:brightness-110 shrink-0 text-ax-background ${FOCUS_CLS} ${
                urgent
                  ? 'bg-ax-danger'
                  : 'bg-ax-warning'
              } disabled:opacity-50`}
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <CalendarCheck size={14} />}
              Générer 8 semaines
            </button>
          </div>
        );
      })()}

      {/* Onglets — la feuille de présence a sa propre vue, la grille ne bouge pas */}
      <div className="flex flex-wrap items-center gap-2">
        {([['presences', 'Présences', ClipboardCheck], ['grille', 'Grille hebdo', CalendarDays]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-ax-control text-sm font-bold border transition-colors ${FOCUS_CLS} ${
              tab === key
                ? 'bg-ax-text border-ax-text text-ax-background'
                : 'bg-transparent border-ax-border text-ax-text-secondary hover:text-ax-text hover:bg-ax-hover'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'presences' ? (
        <>
          {/* Day nav */}
          <Card className="flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-3">
            <button onClick={() => setDayISO(d => addDaysISO(d, -1))} className={`p-1.5 ${ICON_BTN}`} title="Hier">
              <ChevronLeft size={18} />
            </button>
            <span className="flex-1 min-w-0 text-center text-sm font-bold text-ax-text capitalize">
              {new Date(dayISO + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              {dayISO === todayISO && <span className="ml-2 text-[10px] font-black uppercase tracking-wider text-ax-success">aujourd&apos;hui</span>}
            </span>
            <button onClick={() => setDayISO(d => addDaysISO(d, 1))} className={`p-1.5 ${ICON_BTN}`} title="Demain">
              <ChevronRight size={18} />
            </button>
            <button onClick={() => setDayISO(todayISO)} className={`text-xs font-semibold text-ax-text hover:underline px-2 py-1.5 rounded-ax-control ${FOCUS_CLS}`}>
              Aujourd&apos;hui
            </button>
          </Card>

          {dayLoading ? (
            <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-ax-text-secondary" /></div>
          ) : dayItems.length === 0 ? (
            <Card className="text-center py-16">
              <ClipboardCheck size={32} className="text-ax-text-muted mx-auto mb-3" />
              <p className="text-sm text-ax-text-secondary">Aucun cours ce jour-là.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {dayItems.map(item => {
                const isNext = item.id === nextSlotId;
                return (
                  <button
                    key={item.id}
                    onClick={() => openDetail(item)}
                    className={`w-full text-left flex items-center gap-3 sm:gap-4 rounded-ax-card px-4 sm:px-5 py-4 border transition-colors ${FOCUS_CLS} ${
                      isNext
                        ? 'bg-ax-surface-secondary border-ax-text'
                        : 'bg-ax-surface border-ax-border hover:bg-ax-hover'
                    }`}
                  >
                    <div className="w-14 sm:w-20 shrink-0">
                      <p className="text-base font-black text-ax-text">{item.start_time.slice(0, 5)}</p>
                      <p className="text-[11px] text-ax-text-muted">{item.end_time.slice(0, 5)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-sm font-bold text-ax-text break-words min-w-0">{item.title}</p>
                        {isNext && (
                          <span className="text-[9px] font-black uppercase tracking-wider bg-ax-text text-ax-background rounded-full px-2 py-0.5">
                            Prochain cours
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ax-text-secondary mt-0.5 break-words">
                        {item.confirmed_count}/{item.max_capacity}
                        {item.waiting_count > 0 && ` · ${item.waiting_count} en attente`}
                        {item.coach && ` · ${item.coach}`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right max-w-[7rem] sm:max-w-none">
                      <p className={`text-xs font-bold ${
                        item.confirmed_count > 0 && item.pointed_count >= item.confirmed_count ? 'text-ax-success' : 'text-ax-text-secondary'
                      }`}>
                        {item.pointed_count > 0 ? `${item.pointed_count} pointé${item.pointed_count > 1 ? 's' : ''}` : 'Appel à faire'}
                      </p>
                      <p className="text-[11px] text-ax-text-muted">Faire l&apos;appel →</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
      <>
      {/* Week nav */}
      <Card className="flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-3">
        <button onClick={() => setWeek(w => w - 1)} className={`p-1.5 ${ICON_BTN}`}>
          <ChevronLeft size={18} />
        </button>
        <span className="flex-1 min-w-0 text-center text-sm font-bold text-ax-text">{weekLabel}</span>
        <button onClick={() => setWeek(w => w + 1)} className={`p-1.5 ${ICON_BTN}`}>
          <ChevronRight size={18} />
        </button>
        <button onClick={() => setWeek(0)} className={`text-xs font-semibold text-ax-text hover:underline px-2 py-1.5 rounded-ax-control ${FOCUS_CLS}`}>
          Aujourd'hui
        </button>
      </Card>

      {/* Calendar grid — défile dans son propre conteneur quand la largeur manque */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-ax-text-secondary" />
        </div>
      ) : (
        <div className="overflow-x-auto pb-2" data-testid="grille-hebdo">
        <div className="grid grid-cols-7 gap-3 min-w-[56rem]">
          {weekDates.map((d, i) => {
            const iso     = toISO(d);
            const isToday = iso === todayISO;
            const isPast  = iso < todayISO;
            const dayItems = schedules.filter(s => s.scheduled_date === iso);

            return (
              <div key={iso} className="space-y-2 min-w-0">
                {/* Day header */}
                <div aria-current={isToday ? 'date' : undefined} className={`rounded-ax-control px-3 py-2 text-center border ${
                  isToday ? 'bg-ax-text border-ax-text' : 'bg-ax-surface border-ax-border'
                }`}>
                  <p className={`text-xs font-bold ${
                    isToday ? 'text-ax-background' : isPast ? 'text-ax-text-muted' : 'text-ax-text-secondary'
                  }`}>{DAY_LABELS[i]}</p>
                  <p className={`text-lg font-black ${
                    isToday ? 'text-ax-background' : isPast ? 'text-ax-text-muted' : 'text-ax-text'
                  }`}>{d.getDate()}</p>
                </div>

                {/* Slots — grouped by start_time for simultaneous display */}
                <div className="space-y-1.5 min-h-[80px]">
                  {Array.from(new Set(dayItems.map(s => s.start_time))).sort().map(slotTime => {
                    const slotItems = dayItems.filter(s => s.start_time === slotTime);
                    return (
                      <div key={slotTime} className={`flex flex-wrap gap-1 ${slotItems.length > 1 ? 'flex-row' : ''}`}>
                        {slotItems.map(item => (
                          <div key={item.id} onClick={() => openDetail(item)} className={`flex-1 basis-[7rem] min-w-0 border rounded-ax-control p-2.5 group relative cursor-pointer ${
                            isPast ? 'bg-ax-surface-secondary border-ax-border' : 'bg-ax-surface border-ax-border hover:border-ax-input-border'
                          } transition-colors`}>
                            <div className="flex items-start gap-1 mb-1">
                              <Clock size={10} className={`${isPast ? 'text-ax-text-muted' : 'text-ax-text'} mt-0.5 shrink-0`} />
                              <span className={`text-[10px] font-bold break-words min-w-0 ${isPast ? 'text-ax-text-secondary' : 'text-ax-text'}`}>
                                {item.start_time}–{item.end_time}
                              </span>
                            </div>
                            <p className={`text-xs font-bold leading-tight break-words ${isPast ? 'text-ax-text-secondary' : 'text-ax-text'}`}>{item.title}</p>
                            {item.coach && (
                              <p className="text-[10px] text-ax-text-secondary mt-0.5 break-words">👤 {item.coach}</p>
                            )}
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <div className="flex items-center gap-1">
                                <Users size={9} className="text-ax-text-muted" />
                                <span className={`text-[10px] font-semibold ${
                                  item.confirmed_count >= item.max_capacity ? 'text-ax-danger' : 'text-ax-text-secondary'
                                }`}>
                                  {item.confirmed_count}/{item.max_capacity}
                                </span>
                              </div>
                              {item.waiting_count > 0 && (
                                <div className="flex items-center gap-1 bg-ax-warning-soft rounded-ax-badge px-1 py-0.5">
                                  <Timer size={8} className="text-ax-warning" />
                                  <span className="text-[9px] font-bold text-ax-warning">{item.waiting_count}</span>
                                </div>
                              )}
                            </div>
                            {/* Actions : toujours visibles sous 1024 px ; au-dessus, au survol ou au focus clavier */}
                            <div className="mt-1.5 flex justify-end gap-1 lg:mt-0 lg:absolute lg:top-1 lg:right-1 lg:opacity-0 lg:pointer-events-none lg:group-hover:opacity-100 lg:group-hover:pointer-events-auto lg:group-focus-within:opacity-100 lg:group-focus-within:pointer-events-auto transition-opacity motion-reduce:transition-none">
                              <button onClick={() => openEdit(item)} aria-label="Modifier" className={`inline-flex items-center justify-center w-8 h-8 bg-ax-surface-secondary ${ICON_BTN}`}>
                                <Pencil size={12} />
                              </button>
                              <button onClick={() => handleDelete(item)} aria-label="Supprimer" className={`inline-flex items-center justify-center w-8 h-8 rounded-ax-control bg-ax-surface-secondary text-ax-text-secondary hover:bg-ax-danger-soft hover:text-ax-danger transition-colors ${FOCUS_CLS}`}>
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}

                  <button
                    onClick={() => !isPast && openCreate(iso)}
                    disabled={isPast}
                    className={`w-full border border-dashed rounded-ax-control py-2 text-xs font-semibold transition-colors ${FOCUS_CLS} ${
                      isPast
                        ? 'border-ax-border text-ax-text-muted cursor-default'
                        : 'border-ax-input-border text-ax-text-secondary hover:bg-ax-hover hover:text-ax-text cursor-pointer'
                    }`}
                  >
                    {isPast ? '' : '+ Ajouter'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        </div>
      )}
      </>
      )}

      {/* Modal */}
      {modal && (
        <div className={OVERLAY_CLS}>
          <Card className={`${PANEL_CLS} max-w-lg`}>
            <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-5 border-b border-ax-border">
              <h2 className="text-lg font-black text-ax-text">
                {editItem ? 'Modifier le créneau' : 'Nouveau créneau'}
              </h2>
              <button onClick={() => setModal(false)} aria-label="Fermer" className={`p-1 ${ICON_BTN}`}>
                <X size={20} />
              </button>
            </div>

            <div className="px-5 sm:px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className={LABEL_CLS}>Type de cours</label>
                <div className="flex flex-wrap gap-2">
                  {CLASS_TYPES.map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, title: t }))} aria-pressed={form.title === t}
                      className={`${CHIP_CLS} ${form.title === t ? CHIP_ON : CHIP_OFF}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {form.title === 'Autre' && (
                <div>
                  <label className={LABEL_CLS}>Nom personnalisé</label>
                  <Input
                    value={form.customTitle} onChange={e => setForm(f => ({ ...f, customTitle: e.target.value }))}
                    placeholder="Ex : Yoga, Pilates…"
                  />
                </div>
              )}

              <div>
                <label className={LABEL_CLS}>Coach (optionnel)</label>
                {coaches.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {coaches.map(c => (
                      <button key={c.id} onClick={() => setForm(f => ({ ...f, coach: f.coach === c.username ? '' : c.username }))} aria-pressed={form.coach === c.username}
                        className={`${CHIP_CLS} ${form.coach === c.username ? CHIP_ON : CHIP_OFF}`}>
                        {c.username}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-ax-text-secondary">Aucun coach assigné à cette box</p>
                )}
              </div>

              <div>
                <label className={LABEL_CLS}>Date</label>
                <Input type="date"
                  value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className={LABEL_CLS}>Début</label>
                  <Input type="time"
                    value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>Fin</label>
                  <Input type="time"
                    value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>Capacité</label>
                  <Input type="number" min={1}
                    value={form.maxCapacity} onChange={e => setForm(f => ({ ...f, maxCapacity: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className={LABEL_CLS}>Description (optionnel)</label>
                <textarea rows={3}
                  className={TEXTAREA_CLS}
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Détails du cours…"
                />
              </div>

              {formError && (
                <p className="text-sm text-ax-danger bg-ax-danger-soft border border-ax-danger rounded-ax-control px-4 py-2.5 break-words">{formError}</p>
              )}
            </div>

            <div className="px-5 sm:px-6 py-4 border-t border-ax-border flex gap-3">
              <Button variant="ax-outline" onClick={() => setModal(false)} className="flex-1">
                Annuler
              </Button>
              <Button variant="ax-white" onClick={handleSave} disabled={saving} className="flex-1">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? 'Enregistrement…' : editItem ? 'Modifier' : 'Créer'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>

      {/* Detail modal — participants + attendance */}
      {detailItem && (
        <div className={OVERLAY_CLS}>
          <Card className={`${PANEL_CLS} max-w-lg`}>
            <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-5 border-b border-ax-border">
              <div className="min-w-0">
                <h2 className="text-lg font-black text-ax-text break-words">{detailItem.title}</h2>
                <p className="text-sm text-ax-text-secondary mt-0.5 break-words">
                  {new Date(detailItem.scheduled_date + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  {' · '}{detailItem.start_time} – {detailItem.end_time}
                  {detailItem.coach && ` · ${detailItem.coach}`}
                </p>
                {!detailLoading && (
                  <p className="text-sm font-bold text-ax-text mt-1">
                    {participants.filter(p => p.status === 'confirmed').length}/{detailItem.max_capacity}
                    {participants.filter(p => p.status === 'waiting').length > 0 &&
                      ` · ${participants.filter(p => p.status === 'waiting').length} en attente`}
                  </p>
                )}
              </div>
              <button onClick={() => { setDetailItem(null); setAddMemberOpen(false); }} aria-label="Fermer" className={`p-1 shrink-0 ${ICON_BTN}`}>
                <X size={20} />
              </button>
            </div>

            <div className="px-5 sm:px-6 py-5 max-h-[60vh] overflow-y-auto">
              {detailLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 size={24} className="animate-spin text-ax-text-secondary" />
                </div>
              ) : participants.length === 0 && !addMemberOpen ? (
                <div className="text-center py-10">
                  <Users size={32} className="text-ax-text-muted mx-auto mb-3" />
                  <p className="text-sm text-ax-text-secondary">Aucun inscrit pour ce créneau</p>
                </div>
              ) : !addMemberOpen ? (
                <div className="space-y-4">
                  {/* Confirmed */}
                  {(() => {
                    const confirmed = participants.filter(p => p.status === 'confirmed');
                    return confirmed.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 rounded-full bg-ax-success" />
                          <span className="text-xs font-bold text-ax-text-secondary uppercase tracking-wider">
                            Inscrits ({confirmed.length}/{detailItem.max_capacity})
                          </span>
                        </div>
                        <div className="space-y-1">
                          {confirmed.map((p, i) => (
                            <div key={p.reservation_id} className="flex items-center gap-3 px-2 sm:px-3 py-2.5 rounded-ax-control hover:bg-ax-hover transition-colors group">
                              {/* Attendance toggle */}
                              <button
                                onClick={() => toggleAttendance(p.reservation_id, p.attended)}
                                disabled={togglingAtt === p.reservation_id}
                                className={`w-7 h-7 rounded-ax-control border-2 flex items-center justify-center shrink-0 transition-all ${FOCUS_CLS} ${ATT_CLS(p.attended)}`}
                                title={p.attended === true ? 'Présent' : p.attended === false ? 'Absent' : 'Non marqué'}
                              >
                                {togglingAtt === p.reservation_id
                                  ? <Loader2 size={12} className="animate-spin text-ax-text" />
                                  : p.attended === true
                                  ? <Check size={14} className="text-ax-background" strokeWidth={3} />
                                  : p.attended === false
                                  ? <X size={14} className="text-ax-danger" strokeWidth={3} />
                                  : null}
                              </button>
                              <Avatar url={p.avatar_url} name={p.username} />
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <p className="text-sm font-semibold text-ax-text break-words min-w-0">{p.username}</p>
                                  {p.is_trial && (
                                    <Badge variant="warning" className="text-[9px] px-1.5 py-0.5 font-bold leading-3 shrink-0">ESSAI</Badge>
                                  )}
                                </div>
                                <p className="text-xs text-ax-text-secondary break-all">{p.email}</p>
                              </div>
                              <span className="text-[10px] text-ax-text-muted font-mono">#{i + 1}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); kickMember(p.reservation_id); }}
                                disabled={kicking === p.reservation_id}
                                className={KICK_CLS}
                                title="Retirer du créneau"
                              >
                                {kicking === p.reservation_id
                                  ? <Loader2 size={13} className="animate-spin" />
                                  : <UserMinus size={13} />}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Waiting */}
                  {(() => {
                    const waiting = participants.filter(p => p.status === 'waiting');
                    return waiting.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3 mt-2">
                          <div className="w-2 h-2 rounded-full bg-ax-warning" />
                          <span className="text-xs font-bold text-ax-text-secondary uppercase tracking-wider">
                            Liste d&apos;attente ({waiting.length})
                          </span>
                        </div>
                        <div className="space-y-1">
                          {waiting.map((p, i) => (
                            <div key={p.reservation_id} className="flex items-center gap-3 px-2 sm:px-3 py-2.5 rounded-ax-control hover:bg-ax-hover transition-colors group">
                              <button
                                onClick={() => toggleAttendance(p.reservation_id, p.attended)}
                                disabled={togglingAtt === p.reservation_id}
                                className={`w-7 h-7 rounded-ax-control border-2 flex items-center justify-center shrink-0 transition-all ${FOCUS_CLS} ${ATT_CLS(p.attended)}`}
                              >
                                {togglingAtt === p.reservation_id
                                  ? <Loader2 size={12} className="animate-spin text-ax-text" />
                                  : p.attended === true
                                  ? <Check size={14} className="text-ax-background" strokeWidth={3} />
                                  : p.attended === false
                                  ? <X size={14} className="text-ax-danger" strokeWidth={3} />
                                  : null}
                              </button>
                              <Avatar url={p.avatar_url} name={p.username} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-ax-text break-words">{p.username}</p>
                                <p className="text-xs text-ax-text-secondary break-all">{p.email}</p>
                              </div>
                              <span className="text-[10px] text-ax-warning font-bold">#{i + 1}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); kickMember(p.reservation_id); }}
                                disabled={kicking === p.reservation_id}
                                className={KICK_CLS}
                                title="Retirer de la liste d'attente"
                              >
                                {kicking === p.reservation_id
                                  ? <Loader2 size={13} className="animate-spin" />
                                  : <UserMinus size={13} />}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Attendance summary */}
                  {participants.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 border-t border-ax-border">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-ax-success" />
                        <span className="text-[11px] text-ax-text-secondary">{participants.filter(p => p.attended === true).length} présent{participants.filter(p => p.attended === true).length > 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-ax-danger" />
                        <span className="text-[11px] text-ax-text-secondary">{participants.filter(p => p.attended === false).length} absent{participants.filter(p => p.attended === false).length > 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-ax-neutral" />
                        <span className="text-[11px] text-ax-text-secondary">{participants.filter(p => p.attended === null).length} non marqué{participants.filter(p => p.attended === null).length > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : addMemberOpen ? (
                /* Add member search */
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <button onClick={() => { setAddMemberOpen(false); setMemberSearch(''); }} aria-label="Retour" className={`p-1 ${ICON_BTN}`}>
                      <ChevronLeft size={18} />
                    </button>
                    <h3 className="text-sm font-bold text-ax-text">Ajouter un membre</h3>
                  </div>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ax-text-muted pointer-events-none" />
                    <Input
                      className="pl-9"
                      placeholder="Rechercher par nom d'utilisateur..."
                      value={memberSearch}
                      onChange={e => searchMembers(e.target.value)}
                      autoFocus
                    />
                  </div>
                  {searching && (
                    <div className="flex justify-center py-4">
                      <Loader2 size={18} className="animate-spin text-ax-text-secondary" />
                    </div>
                  )}
                  {memberSearch.length >= 3 && !searching && searchResults.length === 0 && (
                    <p className="text-center text-sm text-ax-text-secondary py-4">Aucun résultat</p>
                  )}
                  {searchResults.map(m => (
                    <button
                      key={m.id}
                      onClick={() => addMemberToSlot(m.id, m.username, m.email)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-ax-control hover:bg-ax-hover transition-colors text-left ${FOCUS_CLS}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-ax-surface-secondary flex items-center justify-center text-ax-text text-xs font-black shrink-0">
                        {m.username[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ax-text break-words">{m.username}</p>
                        <p className="text-xs text-ax-text-secondary break-all">{m.email}</p>
                      </div>
                      <Plus size={16} className="text-ax-text shrink-0" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="px-5 sm:px-6 py-4 border-t border-ax-border flex flex-wrap gap-3">
              <Button variant="ax-outline" size="ax-compact" className="h-10 min-h-10"
                onClick={() => setAddMemberOpen(true)}
              >
                <UserPlus size={14} />
                Ajouter
              </Button>
              <Button variant="ax-outline" size="ax-compact" className="h-10 min-h-10"
                onClick={exportAttendanceCSV}
                disabled={participants.length === 0}
              >
                <Download size={14} />
                Exporter CSV
              </Button>
              <div className="flex-1" />
              <Button variant="ax-outline" size="ax-compact" className="h-10 min-h-10"
                onClick={() => { setDetailItem(null); setAddMemberOpen(false); }}>
                Fermer
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
