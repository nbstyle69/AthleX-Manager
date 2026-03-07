'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Plus, ChevronLeft, ChevronRight, Pencil, Trash2,
  Eye, EyeOff, X, Loader2, Dumbbell,
} from 'lucide-react';

type WodType = 'for-time' | 'amrap' | 'emom' | 'tabata' | 'strength' | 'custom';

interface BoxWOD {
  id: string; box_id: string; created_by: string;
  title: string; description: string | null;
  wod_type: WodType; scheduled_date: string;
  time_cap_seconds: number | null; rounds: number | null;
  notes: string | null; is_published: boolean;
}

const WOD_TYPES: { value: WodType; label: string; color: string }[] = [
  { value: 'for-time', label: 'For Time',  color: '#EF4444' },
  { value: 'amrap',    label: 'AMRAP',     color: '#3B82F6' },
  { value: 'emom',     label: 'EMOM',      color: '#8B5CF6' },
  { value: 'tabata',   label: 'Tabata',    color: '#F59E0B' },
  { value: 'strength', label: 'Force',     color: '#16A34A' },
  { value: 'custom',   label: 'Custom',    color: '#6B7280' },
];

const TYPE_COLOR: Record<string, string> = Object.fromEntries(WOD_TYPES.map(t => [t.value, t.color]));
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
  return d.toISOString().split('T')[0];
}

const EMPTY = { title: '', description: '', wod_type: 'amrap' as WodType, date: '', timeCap: '', rounds: '', notes: '', published: true };

export default function WODsPage() {
  const supabase = createClient();

  const [wods,       setWods]      = useState<BoxWOD[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [weekOffset, setWeek]      = useState(0);
  const [boxId,      setBoxId]     = useState<string | null>(null);
  const [userId,     setUserId]    = useState<string | null>(null);

  const [modal,     setModal]     = useState(false);
  const [editWOD,   setEditWOD]   = useState<BoxWOD | null>(null);
  const [form,      setForm]      = useState(EMPTY);
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const weekDates = getWeekDates(weekOffset);
  const todayISO  = toISO(new Date());

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: box } = await supabase.from('boxes').select('id').eq('owner_id', user.id).single();
      if (box) setBoxId(box.id);
    })();
  }, []);

  const load = useCallback(async () => {
    if (!boxId) return;
    setLoading(true);
    const { data } = await supabase
      .from('box_wods').select('*')
      .eq('box_id', boxId)
      .gte('scheduled_date', toISO(weekDates[0]))
      .lte('scheduled_date', toISO(weekDates[6]))
      .order('scheduled_date');
    setWods((data ?? []) as BoxWOD[]);
    setLoading(false);
  }, [boxId, weekOffset]);

  useEffect(() => { load(); }, [load]);

  function openCreate(date: string) {
    setEditWOD(null);
    setForm({ ...EMPTY, date });
    setFormError(null);
    setModal(true);
  }

  function openEdit(wod: BoxWOD) {
    setEditWOD(wod);
    setForm({
      title: wod.title, description: wod.description ?? '',
      wod_type: wod.wod_type, date: wod.scheduled_date,
      timeCap: wod.time_cap_seconds ? String(Math.floor(wod.time_cap_seconds / 60)) : '',
      rounds: wod.rounds ? String(wod.rounds) : '',
      notes: wod.notes ?? '', published: wod.is_published,
    });
    setFormError(null);
    setModal(true);
  }

  async function saveWOD() {
    if (!form.title.trim() || !form.date || !boxId || !userId) return;
    setSaving(true); setFormError(null);
    const payload = {
      box_id: boxId, created_by: userId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      wod_type: form.wod_type,
      scheduled_date: form.date,
      time_cap_seconds: form.timeCap ? parseInt(form.timeCap) * 60 : null,
      rounds: form.rounds ? parseInt(form.rounds) : null,
      notes: form.notes.trim() || null,
      is_published: form.published,
    };
    const { error } = editWOD
      ? await supabase.from('box_wods').update(payload).eq('id', editWOD.id)
      : await supabase.from('box_wods').insert(payload);
    setSaving(false);
    if (error) { setFormError(error.message); return; }
    setModal(false);
    load();
  }

  async function togglePublish(wod: BoxWOD) {
    await supabase.from('box_wods').update({ is_published: !wod.is_published }).eq('id', wod.id);
    load();
  }

  async function deleteWOD(wod: BoxWOD) {
    if (!confirm(`Supprimer "${wod.title}" ?`)) return;
    await supabase.from('box_wods').delete().eq('id', wod.id);
    load();
  }

  const inp = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 transition-colors';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Whiteboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Calendrier des WODs de la semaine</p>
        </div>
        <button
          onClick={() => openCreate(todayISO)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-colors"
        >
          <Plus size={15} /> Nouveau WOD
        </button>
      </div>

      {/* Week nav */}
      <div className="flex items-center justify-between bg-[#16162A] border border-white/8 rounded-2xl px-5 py-3">
        <button onClick={() => setWeek(w => w - 1)} className="p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-white">
            {weekDates[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
            {' — '}
            {weekDates[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          {weekOffset === 0 && <p className="text-xs text-indigo-400 font-semibold mt-0.5">Semaine actuelle</p>}
        </div>
        <button onClick={() => setWeek(w => w + 1)} className="p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Calendar */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-400" size={28} /></div>
      ) : (
        <div className="space-y-3">
          {weekDates.map((d, i) => {
            const iso     = toISO(d);
            const isToday = iso === todayISO;
            const dayWODs = wods.filter(w => w.scheduled_date === iso);
            return (
              <div key={iso} className={`bg-[#16162A] border rounded-2xl overflow-hidden ${isToday ? 'border-indigo-500/50' : 'border-white/8'}`}>
                {/* Day header */}
                <div className={`flex items-center justify-between px-5 py-3 ${isToday ? 'bg-indigo-600/20' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-black ${isToday ? 'text-indigo-300' : 'text-gray-400'}`}>
                      {DAY_LABELS[i]}
                    </span>
                    <span className={`text-sm font-bold ${isToday ? 'text-white' : 'text-gray-300'}`}>
                      {d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                    {isToday && (
                      <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Aujourd'hui
                      </span>
                    )}
                    <span className="text-xs text-gray-600">{dayWODs.length > 0 ? `${dayWODs.length} WOD${dayWODs.length > 1 ? 's' : ''}` : ''}</span>
                  </div>
                  <button
                    onClick={() => openCreate(iso)}
                    className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
                  >
                    <Plus size={14} /> Ajouter
                  </button>
                </div>

                {/* WODs list */}
                {dayWODs.length === 0 ? (
                  <button
                    onClick={() => openCreate(iso)}
                    className="w-full flex items-center justify-center gap-2 py-5 text-sm text-gray-600 hover:text-gray-400 border-t border-white/5 transition-colors"
                  >
                    <Dumbbell size={14} /> Aucun WOD — cliquez pour en ajouter
                  </button>
                ) : (
                  <div className="border-t border-white/5 divide-y divide-white/5">
                    {dayWODs.map(wod => {
                      const color = TYPE_COLOR[wod.wod_type] ?? '#6B7280';
                      return (
                        <div key={wod.id} className={`flex items-center gap-4 px-5 py-3.5 ${!wod.is_published ? 'opacity-60' : ''}`}>
                          <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[10px] font-black tracking-wider" style={{ color }}>
                                {wod.wod_type.toUpperCase()}
                              </span>
                              {!wod.is_published && (
                                <span className="text-[9px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                  Brouillon
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-bold text-white truncate">{wod.title}</p>
                            {wod.description && (
                              <p className="text-xs text-gray-500 truncate mt-0.5">{wod.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {wod.time_cap_seconds && (
                              <span className="text-xs text-gray-600 mr-2">{Math.floor(wod.time_cap_seconds / 60)} min</span>
                            )}
                            <button
                              onClick={() => togglePublish(wod)}
                              title={wod.is_published ? 'Dépublier' : 'Publier'}
                              className="p-2 rounded-xl hover:bg-white/5 transition-colors"
                            >
                              {wod.is_published
                                ? <Eye size={15} className="text-emerald-400" />
                                : <EyeOff size={15} className="text-gray-500" />}
                            </button>
                            <button onClick={() => openEdit(wod)} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
                              <Pencil size={14} className="text-indigo-400" />
                            </button>
                            <button onClick={() => deleteWOD(wod)} className="p-2 rounded-xl hover:bg-red-500/10 transition-colors">
                              <Trash2 size={14} className="text-red-400" />
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

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#16162A] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
              <h2 className="text-lg font-black text-white">{editWOD ? 'Modifier le WOD' : 'Créer un WOD'}</h2>
              <button onClick={() => setModal(false)} className="p-1.5 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {formError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{formError}</div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Date *</label>
                  <input type="date" className={inp} value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Type</label>
                  <select className={inp} value={form.wod_type}
                    onChange={e => setForm(f => ({ ...f, wod_type: e.target.value as WodType }))}>
                    {WOD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Titre *</label>
                <input className={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Fran, Cindy, Helen…" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Description</label>
                <textarea rows={3} className={`${inp} resize-none`} value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="21-15-9 Thrusters + Pull-ups…" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Time Cap (min)</label>
                  <input type="number" className={inp} value={form.timeCap}
                    onChange={e => setForm(f => ({ ...f, timeCap: e.target.value }))} placeholder="20" min="0" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Rounds</label>
                  <input type="number" className={inp} value={form.rounds}
                    onChange={e => setForm(f => ({ ...f, rounds: e.target.value }))} placeholder="5" min="0" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Notes Coach</label>
                <textarea rows={2} className={`${inp} resize-none`} value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Conseils, scaling options…" />
              </div>

              <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-white">Publier maintenant</p>
                  <p className="text-xs text-gray-500">Visible par les athlètes de la box</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, published: !f.published }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.published ? 'bg-emerald-500' : 'bg-white/10'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.published ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setModal(false)}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-sm text-gray-400 hover:text-white transition-colors">
                  Annuler
                </button>
                <button
                  onClick={saveWOD}
                  disabled={!form.title.trim() || !form.date || saving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold transition-colors"
                >
                  {saving && <Loader2 size={15} className="animate-spin" />}
                  {editWOD ? 'Enregistrer' : 'Créer le WOD'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
