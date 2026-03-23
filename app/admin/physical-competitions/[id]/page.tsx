'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowLeft, Plus, Loader2, Trash2, MapPin, Calendar,
  Clock, Video, Pencil, ExternalLink, Zap, Info, GripVertical,
} from 'lucide-react';

interface PhysComp {
  id: string;
  name: string;
  description: string;
  date: string;
  location: string;
  status: string;
  mode: string;
  logo_url: string | null;
  registration_url: string | null;
  format: string;
  price: string | null;
}

interface PhysWOD {
  id: string;
  competition_id: string;
  name: string;
  description: string;
  timer_type: string;
  total_seconds: number;
  max_time: number;
  interval_seconds: number;
  rounds: number;
  work_time: number;
  rest_time: number;
  with_camera: boolean;
  order_index: number;
}

const TIMER_TYPES = [
  { key: 'for-time', label: 'For Time' },
  { key: 'amrap',    label: 'AMRAP' },
  { key: 'emom',     label: 'EMOM' },
  { key: 'tabata',   label: 'Tabata' },
];

export default function PhysicalCompetitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [comp, setComp] = useState<PhysComp | null>(null);
  const [wods, setWods] = useState<PhysWOD[]>([]);
  const [loading, setLoading] = useState(true);

  // WOD form
  const [showForm, setShowForm] = useState(false);
  const [editWodId, setEditWodId] = useState<string | null>(null);
  const [wodName, setWodName] = useState('');
  const [wodDesc, setWodDesc] = useState('');
  const [wodTimer, setWodTimer] = useState('for-time');
  const [wodDurMin, setWodDurMin] = useState('15');
  const [wodRounds, setWodRounds] = useState('3');
  const [wodWork, setWodWork] = useState('40');
  const [wodRest, setWodRest] = useState('20');
  const [wodCamera, setWodCamera] = useState(true);
  const [savingWod, setSavingWod] = useState(false);
  const [deletingWod, setDeletingWod] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: c }, { data: w }] = await Promise.all([
      supabase.from('physical_competitions').select('*').eq('id', id).single(),
      supabase.from('physical_wods').select('*').eq('competition_id', id).order('order_index', { ascending: true }),
    ]);
    setComp(c as PhysComp | null);
    setWods((w ?? []) as PhysWOD[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setShowForm(false);
    setEditWodId(null);
    setWodName('');
    setWodDesc('');
    setWodTimer('for-time');
    setWodDurMin('15');
    setWodRounds('3');
    setWodWork('40');
    setWodRest('20');
    setWodCamera(true);
  }

  function startEdit(w: PhysWOD) {
    setEditWodId(w.id);
    setWodName(w.name);
    setWodDesc(w.description ?? '');
    setWodTimer(w.timer_type);
    setWodDurMin(String(Math.round(w.total_seconds / 60)));
    setWodRounds(String(w.rounds));
    setWodWork(String(w.work_time));
    setWodRest(String(w.rest_time));
    setWodCamera(w.with_camera);
    setShowForm(true);
  }

  async function handleSaveWod() {
    if (!wodName.trim()) return;
    setSavingWod(true);
    const dur = parseInt(wodDurMin) || 15;
    const rnd = parseInt(wodRounds) || 3;
    const wk = parseInt(wodWork) || 40;
    const rst = parseInt(wodRest) || 20;

    const payload = {
      competition_id: id,
      name: wodName.trim(),
      description: wodDesc.trim(),
      timer_type: wodTimer,
      total_seconds: dur * 60,
      max_time: wodTimer === 'for-time' ? dur * 60 : 0,
      interval_seconds: wodTimer === 'emom' ? 60 : 0,
      rounds: rnd,
      work_time: wk,
      rest_time: rst,
      with_camera: wodCamera,
      order_index: editWodId ? undefined : wods.length + 1,
    };

    if (editWodId) {
      const { order_index, ...updatePayload } = payload;
      await supabase.from('physical_wods').update(updatePayload).eq('id', editWodId);
    } else {
      await supabase.from('physical_wods').insert(payload);
    }

    setSavingWod(false);
    resetForm();
    load();
  }

  async function handleDeleteWod(w: PhysWOD) {
    if (!confirm(`Supprimer le WOD "${w.name}" ?`)) return;
    setDeletingWod(w.id);
    await supabase.from('physical_wods').delete().eq('id', w.id);
    setDeletingWod(null);
    load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="text-purple-400 animate-spin" />
      </div>
    );
  }

  if (!comp) {
    return (
      <div className="text-center py-24">
        <p className="text-gray-400">Compétition introuvable.</p>
        <button onClick={() => router.push('/admin/physical-competitions')} className="text-purple-400 hover:underline text-sm mt-2">
          Retour à la liste
        </button>
      </div>
    );
  }

  const isQualif = comp.mode === 'qualification';

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back + header */}
      <button onClick={() => router.push('/admin/physical-competitions')} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm font-semibold transition-colors">
        <ArrowLeft size={16} /> Retour
      </button>

      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0 overflow-hidden">
          {comp.logo_url ? (
            <img src={comp.logo_url} alt="" className="w-full h-full object-cover rounded-xl" />
          ) : (
            <MapPin size={24} className="text-purple-400" />
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-black text-white">{comp.name}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md ${isQualif ? 'bg-purple-500/15 text-purple-400' : 'bg-blue-500/15 text-blue-400'}`}>
              {isQualif ? 'Qualification en ligne' : 'Sans qualification'}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-white/5 text-gray-400 px-2 py-0.5 rounded-md">
              {comp.format === 'team' ? 'Équipe' : 'Individuel'}
            </span>
            {comp.location && (
              <span className="flex items-center gap-1 text-xs text-gray-500"><MapPin size={11} /> {comp.location}</span>
            )}
            {comp.date && (
              <span className="flex items-center gap-1 text-xs text-gray-500"><Calendar size={11} /> {new Date(comp.date).toLocaleDateString('fr-FR')}</span>
            )}
          </div>
          {comp.description && <p className="text-sm text-gray-500 mt-2">{comp.description}</p>}
          {comp.registration_url && (
            <a href={comp.registration_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline mt-2">
              <ExternalLink size={11} /> Lien d&apos;inscription
            </a>
          )}
          {comp.price && <p className="text-sm text-amber-400 font-bold mt-1">{comp.price}</p>}
        </div>
        <button
          onClick={() => router.push(`/admin/physical-competitions/new?edit=${comp.id}`)}
          className="p-2 rounded-xl bg-[#0A0A0A] hover:bg-white/5 text-gray-500 hover:text-white transition-colors shrink-0"
        >
          <Pencil size={15} />
        </button>
      </div>

      {/* WODs section */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-white">WODs ({wods.length})</h2>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl transition-colors ${isQualif ? 'bg-purple-500 hover:bg-purple-600' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
        >
          <Plus size={16} /> Ajouter un WOD
        </button>
      </div>

      {/* WOD form */}
      {showForm && (
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-black text-white">{editWodId ? 'Modifier le WOD' : 'Nouveau WOD'}</h3>

          <div>
            <label className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400 mb-1 block">Nom du WOD *</label>
            <input type="text" value={wodName} onChange={e => setWodName(e.target.value)} placeholder="ex: WOD 1 — Fran"
              className="w-full bg-[#0A0A0A] border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-white/20 focus:outline-none" />
          </div>

          <div>
            <label className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400 mb-1 block">Description / Mouvements</label>
            <textarea value={wodDesc} onChange={e => setWodDesc(e.target.value)} placeholder="ex: 21-15-9 Thrusters 43kg / Pull-ups" rows={2}
              className="w-full bg-[#0A0A0A] border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-white/20 focus:outline-none resize-none" />
          </div>

          <div>
            <label className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400 mb-1 block">Type de timer</label>
            <div className="flex gap-2 flex-wrap">
              {TIMER_TYPES.map(t => (
                <button key={t.key} onClick={() => setWodTimer(t.key)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    wodTimer === t.key
                      ? `${isQualif ? 'bg-purple-500' : 'bg-blue-500'} text-white`
                      : 'bg-[#0A0A0A] border border-white/8 text-gray-400 hover:text-white'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400 mb-1 block">Durée (min)</label>
              <input type="number" value={wodDurMin} onChange={e => setWodDurMin(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white focus:border-white/20 focus:outline-none" />
            </div>
            {(wodTimer === 'tabata' || wodTimer === 'emom') && (
              <div>
                <label className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400 mb-1 block">Rounds</label>
                <input type="number" value={wodRounds} onChange={e => setWodRounds(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white focus:border-white/20 focus:outline-none" />
              </div>
            )}
            {wodTimer === 'tabata' && (<>
              <div>
                <label className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400 mb-1 block">Travail (s)</label>
                <input type="number" value={wodWork} onChange={e => setWodWork(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white focus:border-white/20 focus:outline-none" />
              </div>
              <div>
                <label className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400 mb-1 block">Repos (s)</label>
                <input type="number" value={wodRest} onChange={e => setWodRest(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white focus:border-white/20 focus:outline-none" />
              </div>
            </>)}
          </div>

          {isQualif && (
            <div className="flex items-center justify-between bg-[#0A0A0A] border border-white/8 rounded-xl p-3">
              <div className="flex items-center gap-3">
                <Video size={16} className="text-purple-400" />
                <div>
                  <p className="text-sm font-bold text-white">Caméra pré-configurée</p>
                  <p className="text-[11px] text-gray-500">L&apos;athlète démarre l&apos;enregistrement automatiquement</p>
                </div>
              </div>
              <button onClick={() => setWodCamera(!wodCamera)}
                className={`w-10 h-6 rounded-full transition-colors relative ${wodCamera ? (isQualif ? 'bg-purple-500' : 'bg-blue-500') : 'bg-gray-700'}`}>
                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${wodCamera ? 'left-5' : 'left-1'}`} />
              </button>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={resetForm} className="flex-1 px-4 py-2.5 rounded-xl bg-[#0A0A0A] border border-white/8 text-sm font-bold text-gray-400 hover:text-white transition-colors">
              Annuler
            </button>
            <button onClick={handleSaveWod} disabled={!wodName.trim() || savingWod}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-40 ${isQualif ? 'bg-purple-500 hover:bg-purple-600' : 'bg-blue-500 hover:bg-blue-600'}`}>
              {savingWod ? <Loader2 size={14} className="animate-spin" /> : <>{editWodId ? 'Enregistrer' : 'Ajouter'}</>}
            </button>
          </div>
        </div>
      )}

      {/* WODs list */}
      {wods.length === 0 && !showForm ? (
        <div className="text-center py-12 bg-[#111111] border border-white/8 rounded-2xl">
          <Clock size={36} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 font-semibold">Aucun WOD configuré.</p>
          <p className="text-gray-600 text-sm mt-1">Ajoutez le premier WOD de cette compétition.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {wods.map((w, i) => (
            <div key={w.id} className="bg-[#111111] border border-white/8 rounded-2xl p-4 hover:border-white/15 transition-all">
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-black ${isQualif ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-black text-white">{w.name}</h3>
                  {w.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{w.description}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${isQualif ? 'bg-purple-500/15 text-purple-400' : 'bg-blue-500/15 text-blue-400'}`}>
                      {TIMER_TYPES.find(t => t.key === w.timer_type)?.label ?? w.timer_type} · {Math.round(w.total_seconds / 60)} min
                    </span>
                    {w.with_camera && (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-red-500/15 text-red-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Video size={9} /> Caméra
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => startEdit(w)}
                    className="p-2 rounded-xl hover:bg-white/5 text-gray-500 hover:text-white transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDeleteWod(w)} disabled={deletingWod === w.id}
                    className="p-2 rounded-xl hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-40">
                    {deletingWod === w.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
