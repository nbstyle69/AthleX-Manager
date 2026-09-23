'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Pencil, Trash2, X, Loader2, CalendarDays, ToggleLeft, ToggleRight } from 'lucide-react';
import { getMyBox } from '@/lib/getMyBox';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const FOCUS_CLS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface';
const ICON_BTN = `p-1 rounded-ax-control text-ax-text-secondary hover:text-ax-text hover:bg-ax-hover transition-colors motion-reduce:transition-none ${FOCUS_CLS}`;
const LABEL_CLS = 'block text-xs font-semibold text-ax-text-secondary mb-1.5';
const FIELD_CLS = `w-full min-h-11 rounded-ax-control border border-ax-input-border bg-ax-surface px-3 py-2.5 text-base sm:text-sm text-ax-text placeholder:text-ax-text-muted transition-colors ${FOCUS_CLS}`;
const ADD_CLS = `w-full text-center text-xs font-semibold text-ax-text-secondary hover:text-ax-text hover:bg-ax-hover py-2 border border-dashed border-ax-input-border rounded-ax-control transition-colors ${FOCUS_CLS}`;

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
    const box = await getMyBox(supabase);
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
    <div className="sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div className="min-w-0 flex-1 basis-[16rem]">
          <h1 className="font-display text-2xl font-medium uppercase tracking-wide text-ax-text">Créneaux types</h1>
          <p className="text-ax-text-secondary text-sm mt-1">La grille des créneaux récurrents de ta box, celle qui génère les cours des semaines à venir</p>
        </div>
        <Button variant="ax-white" onClick={openCreate}>
          <Plus size={16} />
          Nouveau créneau type
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-ax-text-secondary" size={28} /></div>
      ) : (
        <div className="overflow-x-auto pb-2" data-testid="grille-types">
        <div className="grid grid-cols-7 gap-3 min-w-[56rem]">
          {DAYS.map(({ value, label }) => {
            const items = templates.filter(t => t.day_of_week === value);
            return (
              <div key={value} className="space-y-2 min-w-0">
                {/* Day header */}
                <div className="bg-ax-surface border border-ax-border rounded-ax-control px-3 py-2 text-center">
                  <p className="text-xs font-bold text-ax-text-secondary">{label}</p>
                </div>

                {/* Slots */}
                {items.map(t => (
                  <div
                    key={t.id}
                    className={`border rounded-ax-control p-3 transition-colors ${t.is_active ? 'bg-ax-surface border-ax-border' : 'bg-ax-surface-secondary border-dashed border-ax-input-border'}`}
                  >
                    <p className={`text-xs font-bold mb-1 break-words ${t.is_active ? 'text-ax-text' : 'text-ax-text-secondary'}`}>{t.start_time} – {t.end_time}</p>
                    <p className={`text-xs font-semibold leading-tight mb-1 break-words ${t.is_active ? 'text-ax-text' : 'text-ax-text-secondary'}`}>{t.title}</p>
                    {t.coach && <p className="text-[10px] text-ax-text-secondary mb-1 break-words">{t.coach}</p>}
                    <p className="text-[10px] text-ax-text-muted mb-2">{t.max_capacity} places</p>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => toggleActive(t)} title={t.is_active ? 'Désactiver' : 'Activer'}
                        className={ICON_BTN}>
                        {t.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      </button>
                      <button onClick={() => openEdit(t)} className={ICON_BTN}>
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => handleDelete(t.id)} disabled={deleting === t.id}
                        className={`${ICON_BTN} hover:!text-ax-danger`}>
                        {deleting === t.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add button */}
                <button
                  onClick={() => { setEditTarget(null); setForm({ ...EMPTY_FORM, day_of_week: value }); setShowModal(true); }}
                  className={ADD_CLS}
                >
                  + Ajouter
                </button>
              </div>
            );
          })}
        </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ax-overlay backdrop-blur-ax-glass p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-ax-panel shadow-ax-panel p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-5">
              <h2 className="font-bold text-ax-text text-lg">{editTarget ? 'Modifier le modèle' : 'Nouveau créneau type'}</h2>
              <button onClick={() => setShowModal(false)} aria-label="Fermer" className={`p-1 ${ICON_BTN}`}><X size={20} /></button>
            </div>

            <div className="space-y-4">
              {/* Jour */}
              <div>
                <label className={LABEL_CLS}>Jour</label>
                <select
                  value={form.day_of_week}
                  onChange={e => setForm(f => ({ ...f, day_of_week: Number(e.target.value) }))}
                  className={FIELD_CLS}
                >
                  {DAYS.map(d => <option key={d.value} value={d.value} className="bg-ax-surface text-ax-text">{d.label}</option>)}
                </select>
              </div>

              {/* Titre */}
              <div>
                <label className={LABEL_CLS}>Type de cours</label>
                <select
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className={FIELD_CLS}
                >
                  {CLASS_TYPES.map(c => <option key={c} className="bg-ax-surface text-ax-text">{c}</option>)}
                </select>
              </div>

              {/* Horaires */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Début</label>
                  <Input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Fin</label>
                  <Input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
                </div>
              </div>

              {/* Coach */}
              <div>
                <label className={LABEL_CLS}>Coach</label>
                <Input type="text" placeholder="Nom du coach" value={form.coach} onChange={e => setForm(f => ({ ...f, coach: e.target.value }))} />
              </div>

              {/* Capacité */}
              <div>
                <label className={LABEL_CLS}>Capacité max</label>
                <Input type="number" min={1} max={100} value={form.max_capacity} onChange={e => setForm(f => ({ ...f, max_capacity: Number(e.target.value) }))} />
              </div>

              {/* Description */}
              <div>
                <label className={LABEL_CLS}>Description (optionnel)</label>
                <textarea rows={3} placeholder="Info complémentaire..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className={`${FIELD_CLS} min-h-[5.5rem] [field-sizing:content] resize-none`} />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="ax-outline" onClick={() => setShowModal(false)} className="flex-1">Annuler</Button>
              <Button variant="ax-white" onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                {editTarget ? 'Enregistrer' : 'Créer'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
