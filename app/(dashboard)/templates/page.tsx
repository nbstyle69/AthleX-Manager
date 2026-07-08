'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Pencil, Trash2, X, Loader2, CalendarDays, ToggleLeft, ToggleRight } from 'lucide-react';
import { getMyBox } from '@/lib/getMyBox';

interface ScheduleTemplate {
  id: string;
  box_id: string;
  title: string;
  description: string | null;
  coach: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_capacity: number;
  is_active: boolean;
}

const CLASS_TYPES = [
  'WOD', 'Haltérophilie', 'Cardio', 'Open Gym',
  'Strength', 'Mobility', 'Kids', 'Teens', 'Autre',
];

const DAYS = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
  { value: 7, label: 'Dimanche' },
];

const EMPTY_FORM = {
  title: 'WOD',
  description: '',
  coach: '',
  day_of_week: 1,
  start_time: '09:00',
  end_time: '10:00',
  max_capacity: 15,
};

export default function TemplatesPage() {
  const supabase = createClient();

  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [loading, setLoading]     = useState(true);
  const [boxId, setBoxId]         = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<ScheduleTemplate | null>(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const box = await getMyBox(supabase, user.id);
    if (!box) { setLoading(false); return; }
    setBoxId(box.id);
    const { data } = await supabase
      .from('schedule_templates')
      .select('*')
      .eq('box_id', box.id)
      .order('day_of_week')
      .order('start_time');
    setTemplates((data ?? []) as ScheduleTemplate[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(t: ScheduleTemplate) {
    setEditTarget(t);
    setForm({
      title: t.title,
      description: t.description ?? '',
      coach: t.coach ?? '',
      day_of_week: t.day_of_week,
      start_time: t.start_time,
      end_time: t.end_time,
      max_capacity: t.max_capacity,
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!boxId) return;
    setSaving(true);
    const payload = {
      box_id: boxId,
      title: form.title,
      description: form.description || null,
      coach: form.coach || null,
      day_of_week: form.day_of_week,
      start_time: form.start_time,
      end_time: form.end_time,
      max_capacity: form.max_capacity,
    };
    if (editTarget) {
      await supabase.from('schedule_templates').update(payload).eq('id', editTarget.id);
    } else {
      await supabase.from('schedule_templates').insert({ ...payload, is_active: true });
    }
    setSaving(false);
    setShowModal(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce modèle ?')) return;
    setDeleting(id);
    await supabase.from('schedule_templates').delete().eq('id', id);
    setDeleting(null);
    load();
  }

  async function toggleActive(t: ScheduleTemplate) {
    await supabase.from('schedule_templates').update({ is_active: !t.is_active }).eq('id', t.id);
    load();
  }

  const byDay = DAYS.map(d => ({
    ...d,
    items: templates.filter(t => t.day_of_week === d.value),
  })).filter(d => d.items.length > 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Modèle de semaine</h1>
          <p className="text-gray-400 text-sm mt-1">Définissez les créneaux récurrents de votre box</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-[#B8911F] text-[#0A0A0A] rounded-xl font-semibold text-sm transition-colors"
        >
          <Plus size={16} />
          Nouveau créneau type
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-500" size={28} /></div>
      ) : (
        <div className="grid grid-cols-7 gap-3">
          {DAYS.map(({ value, label }) => {
            const items = templates.filter(t => t.day_of_week === value);
            return (
              <div key={value} className="space-y-2">
                {/* Day header */}
                <div className="bg-[#111111] border border-white/8 rounded-xl px-3 py-2 text-center">
                  <p className="text-xs font-bold text-gray-300">{label}</p>
                </div>

                {/* Slots */}
                {items.map(t => (
                  <div
                    key={t.id}
                    className={`bg-[#111] border rounded-xl p-3 transition-opacity ${t.is_active ? 'border-white/10' : 'border-white/5 opacity-40'}`}
                  >
                    <p className="text-xs font-bold text-white mb-1">{t.start_time} – {t.end_time}</p>
                    <p className="text-xs font-semibold text-white leading-tight mb-1">{t.title}</p>
                    {t.coach && <p className="text-[10px] text-gray-500 mb-1">{t.coach}</p>}
                    <p className="text-[10px] text-gray-600 mb-2">{t.max_capacity} places</p>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => toggleActive(t)} title={t.is_active ? 'Désactiver' : 'Activer'}
                        className="text-gray-500 hover:text-white transition-colors">
                        {t.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      </button>
                      <button onClick={() => openEdit(t)} className="text-gray-500 hover:text-white transition-colors">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => handleDelete(t.id)} disabled={deleting === t.id}
                        className="text-gray-500 hover:text-red-400 transition-colors">
                        {deleting === t.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add button */}
                <button
                  onClick={() => { setEditTarget(null); setForm({ ...EMPTY_FORM, day_of_week: value }); setShowModal(true); }}
                  className="w-full text-center text-xs text-gray-600 hover:text-gray-400 py-2 border border-dashed border-white/5 hover:border-white/10 rounded-xl transition-colors"
                >
                  + Ajouter
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-white text-lg">{editTarget ? 'Modifier le modèle' : 'Nouveau créneau type'}</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-gray-400 hover:text-white" /></button>
            </div>

            <div className="space-y-4">
              {/* Jour */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">Jour</label>
                <select
                  value={form.day_of_week}
                  onChange={e => setForm(f => ({ ...f, day_of_week: Number(e.target.value) }))}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
                >
                  {DAYS.map(d => <option key={d.value} value={d.value} className="text-black">{d.label}</option>)}
                </select>
              </div>

              {/* Titre */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">Type de cours</label>
                <select
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
                >
                  {CLASS_TYPES.map(c => <option key={c} className="text-black">{c}</option>)}
                </select>
              </div>

              {/* Horaires */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">Début</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">Fin</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
                </div>
              </div>

              {/* Coach */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">Coach</label>
                <input type="text" placeholder="Nom du coach" value={form.coach} onChange={e => setForm(f => ({ ...f, coach: e.target.value }))}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-600" />
              </div>

              {/* Capacité */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">Capacité max</label>
                <input type="number" min={1} max={100} value={form.max_capacity} onChange={e => setForm(f => ({ ...f, max_capacity: Number(e.target.value) }))}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">Description (optionnel)</label>
                <textarea rows={2} placeholder="Info complémentaire..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-600 resize-none" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-gray-400 hover:text-white transition-colors">Annuler</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-white hover:bg-[#B8911F] text-[#0A0A0A] text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                {editTarget ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
