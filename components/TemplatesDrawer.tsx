'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Pencil, Trash2, X, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';

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

const CLASS_TYPES = ['WOD','Halterophilie','Cardio','Open Gym','Strength','Mobility','Kids','Teens','Autre'];

const DAYS = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
  { value: 7, label: 'Dimanche' },
];

const EMPTY_FORM = { title: 'WOD', description: '', coach: '', day_of_week: 1, start_time: '09:00', end_time: '10:00', max_capacity: 15 };

interface Props { open: boolean; onClose: () => void; boxId: string | null; }

export default function TemplatesDrawer({ open, onClose, boxId }: Props) {
  const supabase = createClient();
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [loading, setLoading]     = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<ScheduleTemplate | null>(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [coaches, setCoaches]     = useState<{ id: string; username: string }[]>([]);

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

  const load = useCallback(async () => {
    if (!boxId) return;
    setLoading(true);
    const { data } = await supabase.from('schedule_templates').select('*').eq('box_id', boxId).order('day_of_week').order('start_time');
    setTemplates((data ?? []) as ScheduleTemplate[]);
    setLoading(false);
  }, [boxId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  function openCreate(day: number) {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, day_of_week: day });
    setShowModal(true);
  }

  function openEdit(t: ScheduleTemplate) {
    setEditTarget(t);
    setForm({ title: t.title, description: t.description ?? '', coach: t.coach ?? '', day_of_week: t.day_of_week, start_time: t.start_time, end_time: t.end_time, max_capacity: t.max_capacity });
    setShowModal(true);
  }

  async function handleSave() {
    if (!boxId) return;
    setSaving(true);
    const payload = { box_id: boxId, title: form.title, description: form.description || null, coach: form.coach || null, day_of_week: form.day_of_week, start_time: form.start_time, end_time: form.end_time, max_capacity: form.max_capacity };
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
    if (!confirm('Supprimer ce modele ?')) return;
    setDeleting(id);
    await supabase.from('schedule_templates').delete().eq('id', id);
    setDeleting(null);
    load();
  }

  async function toggleActive(t: ScheduleTemplate) {
    await supabase.from('schedule_templates').update({ is_active: !t.is_active }).eq('id', t.id);
    load();
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-5xl bg-[#0d0d0d] border-l border-white/10 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div>
            <h2 className="text-lg font-bold text-white">Modele de semaine</h2>
            <p className="text-xs text-gray-500 mt-0.5">Definissez les creneaux recurrents de votre box</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-500" size={28} /></div>
          ) : (
            <div className="grid grid-cols-7 gap-3">
              {DAYS.map(({ value, label }) => {
                const items = templates.filter(t => t.day_of_week === value);
                return (
                  <div key={value} className="space-y-2">
                    <div className="bg-[#111] border border-white/8 rounded-xl px-2 py-2 text-center">
                      <p className="text-xs font-bold text-gray-300">{label}</p>
                    </div>
                    {Array.from(new Set(items.map(t => t.start_time))).sort().map(slotTime => {
                      const slotItems = items.filter(t => t.start_time === slotTime);
                      return (
                        <div key={slotTime} className="flex gap-1">
                          {slotItems.map(t => (
                            <div key={t.id} className={`flex-1 min-w-0 bg-[#111] border rounded-xl p-3 transition-opacity ${t.is_active ? 'border-white/10' : 'border-white/5 opacity-40'}`}>
                              <p className="text-xs font-bold text-white mb-1 truncate">{t.start_time} - {t.end_time}</p>
                              <p className="text-xs font-semibold text-white leading-tight mb-1 truncate">{t.title}</p>
                              {t.coach && <p className="text-[10px] text-gray-500 mb-1 truncate">{t.coach}</p>}
                              <p className="text-[10px] text-gray-600 mb-2">{t.max_capacity} places</p>
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => toggleActive(t)} title={t.is_active ? 'Desactiver' : 'Activer'} className="text-gray-500 hover:text-white transition-colors">
                                  {t.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                                </button>
                                <button onClick={() => openEdit(t)} className="text-gray-500 hover:text-white transition-colors"><Pencil size={12} /></button>
                                <button onClick={() => handleDelete(t.id)} disabled={deleting === t.id} className="text-gray-500 hover:text-red-400 transition-colors">
                                  {deleting === t.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    <button onClick={() => openCreate(value)} className="w-full text-center text-xs text-gray-600 hover:text-gray-400 py-2 border border-dashed border-white/5 hover:border-white/10 rounded-xl transition-colors">
                      + Ajouter
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal form */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-white text-lg">{editTarget ? 'Modifier' : 'Nouveau creneau type'}</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-gray-400 hover:text-white" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">Jour</label>
                <select value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: Number(e.target.value) }))} className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white">
                  {DAYS.map(d => <option key={d.value} value={d.value} className="text-black">{d.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">Type de cours</label>
                <select value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white">
                  {CLASS_TYPES.map(c => <option key={c} className="text-black">{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">Debut</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">Fin</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">Coach</label>
                {coaches.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {coaches.map(c => (
                      <button key={c.id} type="button" onClick={() => setForm(f => ({ ...f, coach: f.coach === c.username ? '' : c.username }))}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                          form.coach === c.username
                            ? 'bg-white border-white text-[#0A0A0A]'
                            : 'bg-transparent border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
                        }`}>
                        {c.username}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Aucun coach assigné</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">Capacite max</label>
                <input type="number" min={1} max={100} value={form.max_capacity} onChange={e => setForm(f => ({ ...f, max_capacity: Number(e.target.value) }))} className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-gray-400 hover:text-white transition-colors">Annuler</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-white hover:bg-[#B8911F] text-[#0A0A0A] text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                {saving && <Loader2 size={15} className="animate-spin" />}
                {editTarget ? 'Enregistrer' : 'Creer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
