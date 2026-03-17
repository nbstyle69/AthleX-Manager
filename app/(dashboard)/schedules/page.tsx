'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import TemplatesDrawer from '@/components/TemplatesDrawer';
import {
  Plus, ChevronLeft, ChevronRight, Pencil, Trash2,
  Users, X, Loader2, Clock, Timer, CalendarCheck, LayoutTemplate, UserMinus,
} from 'lucide-react';

interface Participant {
  reservation_id: string;
  member_id: string;
  username: string;
  email: string;
  status: 'confirmed' | 'waiting';
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
}

const CLASS_TYPES = [
  'CrossFit', 'Haltérophilie', 'Cardio', 'Open Gym',
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

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const EMPTY_FORM = {
  title: 'CrossFit',
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

  const weekDates = getWeekDates(weekOffset);
  const todayISO  = toISO(new Date());

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: box } = await supabase
        .from('boxes').select('id').eq('owner_id', user.id).single();
      if (box?.id) setBoxId(box.id);
    })();
  }, []);

  const load = useCallback(async () => {
    if (!boxId) return;
    setLoading(true);
    const start = toISO(weekDates[0]);
    const end   = toISO(weekDates[6]);

    const { data } = await supabase
      .from('class_schedules')
      .select('*')
      .eq('box_id', boxId)
      .gte('scheduled_date', start)
      .lte('scheduled_date', end)
      .order('scheduled_date')
      .order('start_time');

    const rawItems = (data ?? []) as Omit<ClassSchedule, 'confirmed_count' | 'waiting_count'>[];
    let items: ClassSchedule[] = rawItems.map(s => ({ ...s, confirmed_count: 0, waiting_count: 0 }));

    if (rawItems.length > 0) {
      const ids = rawItems.map(s => s.id);
      const { data: resCounts } = await supabase
        .from('class_reservations')
        .select('schedule_id, status')
        .in('schedule_id', ids);
      const confirmedMap: Record<string, number> = {};
      const waitingMap:   Record<string, number> = {};
      ids.forEach(id => { confirmedMap[id] = 0; waitingMap[id] = 0; });
      (resCounts ?? []).forEach((r: any) => {
        if (r.status === 'waiting') { if (waitingMap[r.schedule_id]   !== undefined) waitingMap[r.schedule_id]++;   }
        else                        { if (confirmedMap[r.schedule_id] !== undefined) confirmedMap[r.schedule_id]++; }
      });
      items = items.map(s => ({ ...s, confirmed_count: confirmedMap[s.id] ?? 0, waiting_count: waitingMap[s.id] ?? 0 }));
    }

    setSchedules(items);
    setLoading(false);
  }, [boxId, weekOffset]);

  useEffect(() => { load(); }, [load]);

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
    const { data: tpls } = await supabase
      .from('schedule_templates')
      .select('*')
      .eq('box_id', boxId)
      .eq('is_active', true);

    if (!tpls || tpls.length === 0) {
      alert('Aucun modèle actif. Crée des créneaux types dans "Modèle semaine" d\'abord.');
      setGenerating(false);
      return;
    }

    // Fetch existing schedules for the week to avoid duplicates
    const start = toISO(weekDates[0]);
    const end   = toISO(weekDates[6]);
    const { data: existing } = await supabase
      .from('class_schedules')
      .select('scheduled_date, start_time, title')
      .eq('box_id', boxId)
      .gte('scheduled_date', start)
      .lte('scheduled_date', end);

    const existingSet = new Set(
      (existing ?? []).map((s: any) => `${s.scheduled_date}|${s.start_time}|${s.title}`)
    );

    // day_of_week: 1=Lundi ... 7=Dimanche. weekDates[0]=Lundi
    const toInsert = tpls
      .map((t: any) => ({
        box_id: boxId,
        title: t.title,
        description: t.description,
        coach: t.coach,
        scheduled_date: toISO(weekDates[t.day_of_week - 1]),
        start_time: t.start_time,
        end_time: t.end_time,
        max_capacity: t.max_capacity,
      }))
      .filter((s: any) => !existingSet.has(`${s.scheduled_date}|${s.start_time}|${s.title}`));

    if (toInsert.length === 0) {
      setGenerating(false);
      alert('Tous les créneaux du modèle existent déjà pour cette semaine.');
      return;
    }

    const { error } = await supabase.from('class_schedules').insert(toInsert);

    setGenerating(false);
    if (error) { alert('Erreur : ' + error.message); return; }
    load();
  }

  async function openDetail(item: ClassSchedule) {
    setDetailItem(item);
    setParticipants([]);
    setDetailLoading(true);
    const { data } = await supabase
      .from('class_reservations')
      .select('id, member_id, status, created_at, profile:profiles(username, email)')
      .eq('schedule_id', item.id)
      .order('created_at', { ascending: true });
    const list: Participant[] = (data ?? []).map((r: any) => {
      const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
      return {
        reservation_id: r.id,
        member_id: r.member_id,
        username: p?.username ?? '?',
        email: p?.email ?? '',
        status: r.status,
        created_at: r.created_at,
      };
    });
    setParticipants(list);
    setDetailLoading(false);
  }

  async function kickMember(reservationId: string) {
    if (!confirm('Retirer ce membre du créneau ?')) return;
    setKicking(reservationId);
    await supabase.from('class_reservations').delete().eq('id', reservationId);
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
    await supabase.from('class_schedules').delete().eq('id', item.id);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Horaires & Créneaux</h1>
          <p className="text-sm text-gray-400 mt-1">Gérez les créneaux de cours de votre box</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTemplates(true)}
            className="flex items-center gap-2 border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
          >
            <LayoutTemplate size={16} />
            Modèle de semaine
          </button>
          <button
            onClick={generateFromTemplate}
            disabled={generating}
            className="flex items-center gap-2 border border-[#C9A227] text-[#C9A227] hover:bg-[#C9A227]/10 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <CalendarCheck size={16} />}
            Générer la semaine
          </button>
          <button
            onClick={() => openCreate(todayISO)}
            className="flex items-center gap-2 bg-[#C9A227] hover:bg-[#B8911F] text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Plus size={16} />
            Nouveau créneau
          </button>
        </div>
      </div>

      {/* Week nav */}
      <div className="flex items-center gap-4 bg-[#111111] border border-white/8 rounded-2xl px-5 py-3">
        <button onClick={() => setWeek(w => w - 1)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={18} />
        </button>
        <span className="flex-1 text-center text-sm font-bold text-white">{weekLabel}</span>
        <button onClick={() => setWeek(w => w + 1)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
          <ChevronRight size={18} />
        </button>
        <button onClick={() => setWeek(0)} className="text-xs font-semibold text-[#C9A227] hover:underline px-2">
          Aujourd'hui
        </button>
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-[#C9A227]" />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-3">
          {weekDates.map((d, i) => {
            const iso     = toISO(d);
            const isToday = iso === todayISO;
            const isPast  = iso < todayISO;
            const dayItems = schedules.filter(s => s.scheduled_date === iso);

            return (
              <div key={iso} className="space-y-2">
                {/* Day header */}
                <div className={`rounded-xl px-3 py-2 text-center border ${
                  isToday ? 'bg-[#C9A227] border-[#C9A227]' : 'bg-[#111111] border-white/8'
                }`}>
                  <p className={`text-xs font-bold ${
                    isToday ? 'text-white' : isPast ? 'text-gray-600' : 'text-gray-300'
                  }`}>{DAY_LABELS[i]}</p>
                  <p className={`text-lg font-black ${
                    isToday ? 'text-white' : isPast ? 'text-gray-600' : 'text-white'
                  }`}>{d.getDate()}</p>
                </div>

                {/* Slots — grouped by start_time for simultaneous display */}
                <div className="space-y-1.5 min-h-[80px]">
                  {Array.from(new Set(dayItems.map(s => s.start_time))).sort().map(slotTime => {
                    const slotItems = dayItems.filter(s => s.start_time === slotTime);
                    return (
                      <div key={slotTime} className={`flex gap-1 ${slotItems.length > 1 ? 'flex-row' : ''}`}>
                        {slotItems.map(item => (
                          <div key={item.id} onClick={() => openDetail(item)} className={`flex-1 min-w-0 bg-[#111111] border border-white/8 rounded-xl p-2.5 group relative cursor-pointer ${
                            isPast ? 'opacity-50' : 'hover:border-white/20'
                          } transition-colors`}>
                            <div className="flex items-center gap-1 mb-1">
                              <Clock size={10} className="text-[#C9A227]" />
                              <span className="text-[10px] font-bold text-[#C9A227] truncate">
                                {item.start_time}–{item.end_time}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-white leading-tight truncate">{item.title}</p>
                            {item.coach && (
                              <p className="text-[10px] text-gray-500 mt-0.5 truncate">👤 {item.coach}</p>
                            )}
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <div className="flex items-center gap-1">
                                <Users size={9} className="text-gray-500" />
                                <span className={`text-[10px] font-semibold ${
                                  item.confirmed_count >= item.max_capacity ? 'text-red-400' : 'text-gray-400'
                                }`}>
                                  {item.confirmed_count}/{item.max_capacity}
                                </span>
                              </div>
                              {item.waiting_count > 0 && (
                                <div className="flex items-center gap-1 bg-amber-500/10 rounded px-1 py-0.5">
                                  <Timer size={8} className="text-amber-400" />
                                  <span className="text-[9px] font-bold text-amber-400">{item.waiting_count}</span>
                                </div>
                              )}
                            </div>
                            {/* Hover actions */}
                            <div className="absolute top-1.5 right-1.5 hidden group-hover:flex gap-1">
                              <button onClick={() => openEdit(item)} className="p-1 rounded-lg bg-[#1a1a1a] hover:bg-[#C9A227]/20 text-gray-500 hover:text-[#C9A227] transition-colors">
                                <Pencil size={11} />
                              </button>
                              <button onClick={() => handleDelete(item)} className="p-1 rounded-lg bg-[#1a1a1a] hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors">
                                <Trash2 size={11} />
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
                    className={`w-full border border-dashed rounded-xl py-2 text-xs font-semibold transition-colors ${
                      isPast
                        ? 'border-white/[0.03] text-gray-700 cursor-default'
                        : 'border-white/10 text-gray-600 hover:border-white/20 hover:text-gray-400 cursor-pointer'
                    }`}
                  >
                    {isPast ? '' : '+ Ajouter'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
              <h2 className="text-lg font-black text-white">
                {editItem ? 'Modifier le créneau' : 'Nouveau créneau'}
              </h2>
              <button onClick={() => setModal(false)} className="text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Type de cours</label>
                <div className="flex flex-wrap gap-2">
                  {CLASS_TYPES.map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, title: t }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        form.title === t
                          ? 'bg-[#C9A227] border-[#C9A227] text-white'
                          : 'bg-transparent border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {form.title === 'Autre' && (
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Nom personnalisé</label>
                  <input
                    className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A227]/50"
                    value={form.customTitle} onChange={e => setForm(f => ({ ...f, customTitle: e.target.value }))}
                    placeholder="Ex : Yoga, Pilates…"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Coach (optionnel)</label>
                <input
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A227]/50"
                  value={form.coach} onChange={e => setForm(f => ({ ...f, coach: e.target.value }))}
                  placeholder="Nom du coach"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Date</label>
                <input type="date"
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#C9A227]/50"
                  value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Début</label>
                  <input type="time"
                    className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#C9A227]/50"
                    value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Fin</label>
                  <input type="time"
                    className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#C9A227]/50"
                    value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Capacité</label>
                  <input type="number" min={1}
                    className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#C9A227]/50"
                    value={form.maxCapacity} onChange={e => setForm(f => ({ ...f, maxCapacity: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Description (optionnel)</label>
                <textarea rows={2}
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-[#C9A227]/50"
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Détails du cours…"
                />
              </div>

              {formError && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">{formError}</p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-white/8 flex gap-3">
              <button onClick={() => setModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm font-semibold text-gray-400 hover:text-white hover:border-white/20 transition-colors">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#C9A227] hover:bg-[#B8911F] text-white text-sm font-bold transition-colors disabled:opacity-60">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? 'Enregistrement…' : editItem ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

      {/* Detail modal — participants list */}
      {detailItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
              <div>
                <h2 className="text-lg font-black text-white">{detailItem.title}</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  {new Date(detailItem.scheduled_date + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  {' · '}{detailItem.start_time} – {detailItem.end_time}
                  {detailItem.coach && ` · ${detailItem.coach}`}
                </p>
              </div>
              <button onClick={() => setDetailItem(null)} className="text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
              {detailLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 size={24} className="animate-spin text-[#C9A227]" />
                </div>
              ) : participants.length === 0 ? (
                <div className="text-center py-10">
                  <Users size={32} className="text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Aucun inscrit pour ce créneau</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Confirmed */}
                  {(() => {
                    const confirmed = participants.filter(p => p.status === 'confirmed');
                    return confirmed.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 rounded-full bg-green-400" />
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                            Inscrits ({confirmed.length}/{detailItem.max_capacity})
                          </span>
                        </div>
                        <div className="space-y-1">
                          {confirmed.map((p, i) => (
                            <div key={p.reservation_id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors group">
                              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-xs font-black shrink-0">
                                {p.username[0].toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{p.username}</p>
                                <p className="text-xs text-gray-500 truncate">{p.email}</p>
                              </div>
                              <span className="text-[10px] text-gray-600 font-mono">#{i + 1}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); kickMember(p.reservation_id); }}
                                disabled={kicking === p.reservation_id}
                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all"
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
                          <div className="w-2 h-2 rounded-full bg-amber-400" />
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                            Liste d'attente ({waiting.length})
                          </span>
                        </div>
                        <div className="space-y-1">
                          {waiting.map((p, i) => (
                            <div key={p.reservation_id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors group">
                              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-xs font-black shrink-0">
                                {p.username[0].toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{p.username}</p>
                                <p className="text-xs text-gray-500 truncate">{p.email}</p>
                              </div>
                              <span className="text-[10px] text-amber-400 font-bold">#{i + 1}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); kickMember(p.reservation_id); }}
                                disabled={kicking === p.reservation_id}
                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all"
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
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-white/8">
              <button onClick={() => setDetailItem(null)}
                className="w-full px-4 py-2.5 rounded-xl border border-white/10 text-sm font-semibold text-gray-400 hover:text-white hover:border-white/20 transition-colors">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
