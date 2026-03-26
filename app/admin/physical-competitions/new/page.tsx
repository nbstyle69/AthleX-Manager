'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  MapPin, ArrowLeft, Loader2, Check, Upload, Zap, Info,
} from 'lucide-react';

type Mode = 'qualification' | 'info';

export default function NewPhysicalCompetitionPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get('edit');

  const [mode, setMode] = useState<Mode | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('');
  const [format, setFormat] = useState('individual');
  const [registrationUrl, setRegistrationUrl] = useState('');
  const [price, setPrice] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(!!editId);

  useEffect(() => {
    if (!editId) return;
    (async () => {
      const { data } = await supabase.from('physical_competitions').select('*').eq('id', editId).single();
      if (data) {
        setMode(data.mode as Mode);
        setName(data.name ?? '');
        setDescription(data.description ?? '');
        setDate(data.date ?? '');
        setStartDate(data.start_date ?? '');
        setEndDate(data.end_date ?? '');
        setLocation(data.location ?? '');
        setFormat(data.format ?? 'individual');
        setRegistrationUrl(data.registration_url ?? '');
        setPrice(data.price ?? '');
        if (data.logo_url) setLogoPreview(data.logo_url);
      }
      setLoadingEdit(false);
    })();
  }, [editId]);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function uploadLogo(): Promise<string | null> {
    if (!logoFile) return logoPreview; // keep existing URL if editing
    const ext = logoFile.name.split('.').pop() ?? 'png';
    const path = `physical-competitions/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('assets').upload(path, logoFile, { upsert: true });
    if (error) { console.error('Upload error', error); return null; }
    const { data } = supabase.storage.from('assets').getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSave() {
    if (!mode || !name.trim()) return;
    setSaving(true);

    const logoUrl = await uploadLogo();

    const payload: Record<string, any> = {
      name: name.trim(),
      description: description.trim(),
      date: mode === 'info' ? (date || new Date().toISOString().slice(0, 10)) : (startDate || new Date().toISOString().slice(0, 10)),
      start_date: mode === 'qualification' ? (startDate || null) : null,
      end_date: mode === 'qualification' ? (endDate || null) : null,
      location: location.trim(),
      mode,
      format,
      logo_url: logoUrl,
      registration_url: registrationUrl.trim() || null,
      price: mode === 'info' ? price.trim() || null : null,
    };

    if (editId) {
      await supabase.from('physical_competitions').update(payload).eq('id', editId);
    } else {
      payload.status = 'open';
      await supabase.from('physical_competitions').insert(payload);
    }

    setSaving(false);
    router.push('/admin/physical-competitions');
  }

  if (loadingEdit) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="text-purple-400 animate-spin" />
      </div>
    );
  }

  // ── Mode selector
  if (!mode) {
    return (
      <div className="space-y-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm font-semibold transition-colors">
          <ArrowLeft size={16} /> Retour
        </button>

        <div className="text-center py-8">
          <h1 className="text-2xl font-black text-white mb-2">Nouvelle compétition physique</h1>
          <p className="text-gray-400">Choisissez le type de compétition</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
          {/* Qualification en ligne */}
          <button
            onClick={() => setMode('qualification')}
            className="bg-[#111111] border border-white/8 rounded-2xl p-6 text-left hover:border-purple-500/50 hover:bg-purple-500/5 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-4">
              <Zap size={24} className="text-purple-400" />
            </div>
            <h2 className="text-lg font-black text-white mb-2 group-hover:text-purple-400 transition-colors">
              Qualification en Ligne
            </h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              Les athlètes font le WOD dans l&apos;app avec la caméra et soumettent leur score.
              Le logo de la compétition apparaît en overlay sur la vidéo.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-400 px-2 py-0.5 rounded-md">Timer + Caméra</span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-400 px-2 py-0.5 rounded-md">Logo overlay</span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-400 px-2 py-0.5 rounded-md">Score card</span>
            </div>
          </button>

          {/* Sans qualification */}
          <button
            onClick={() => setMode('info')}
            className="bg-[#111111] border border-white/8 rounded-2xl p-6 text-left hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4">
              <Info size={24} className="text-blue-400" />
            </div>
            <h2 className="text-lg font-black text-white mb-2 group-hover:text-blue-400 transition-colors">
              Sans Qualification en Ligne
            </h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              Compétition informative. Les athlètes voient les détails et s&apos;inscrivent via un lien externe.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-md">Lien externe</span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-md">Informatif</span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-md">Prix</span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  const accent = mode === 'qualification' ? 'purple' : 'blue';
  const accentBg = mode === 'qualification' ? 'bg-purple-500' : 'bg-blue-500';
  const accentBgHover = mode === 'qualification' ? 'hover:bg-purple-600' : 'hover:bg-blue-600';

  // ── Form
  return (
    <div className="space-y-6 max-w-2xl">
      <button onClick={() => setMode(null)} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm font-semibold transition-colors">
        <ArrowLeft size={16} /> Changer de mode
      </button>

      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${mode === 'qualification' ? 'bg-purple-500/20' : 'bg-blue-500/20'} flex items-center justify-center`}>
          {mode === 'qualification' ? <Zap size={20} className="text-purple-400" /> : <Info size={20} className="text-blue-400" />}
        </div>
        <div>
          <h1 className="text-xl font-black text-white">
            {editId ? 'Modifier' : 'Créer'} — {mode === 'qualification' ? 'Qualification en Ligne' : 'Sans Qualification'}
          </h1>
        </div>
      </div>

      <div className="bg-[#111111] border border-white/8 rounded-2xl p-6 space-y-5">
        {/* Logo upload */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400 mb-2 block">
            Logo de la compétition {mode === 'qualification' && <span className="text-purple-400 ml-1">(overlay vidéo)</span>}
          </label>
          <div className="flex items-center gap-4">
            <label className="w-20 h-20 rounded-xl border-2 border-dashed border-white/10 hover:border-white/20 flex items-center justify-center cursor-pointer overflow-hidden transition-colors">
              {logoPreview ? (
                <img src={logoPreview} alt="" className="w-full h-full object-cover rounded-xl" />
              ) : (
                <Upload size={20} className="text-gray-600" />
              )}
              <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
            </label>
            <p className="text-xs text-gray-500">PNG ou JPG, max 2 MB.<br/>Visible dans l&apos;app et {mode === 'qualification' ? 'en overlay sur la vidéo.' : 'sur la page de détails.'}</p>
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400 mb-2 block">Nom *</label>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="ex: Open NBS 2026"
            className="w-full bg-[#0A0A0A] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-white/20 focus:outline-none transition-colors"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400 mb-2 block">Description</label>
          <textarea
            value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Décrivez la compétition…"
            rows={3}
            className="w-full bg-[#0A0A0A] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-white/20 focus:outline-none transition-colors resize-none"
          />
        </div>

        {/* Dates + Location */}
        {mode === 'qualification' ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400 mb-2 block">Date de début <span className="text-purple-400">*</span></label>
                <input
                  type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-white/20 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400 mb-2 block">Date de fin <span className="text-purple-400">*</span></label>
                <input
                  type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-white/20 focus:outline-none transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400 mb-2 block">Lieu</label>
              <input
                type="text" value={location} onChange={e => setLocation(e.target.value)}
                placeholder="ex: CrossFit NBS, Paris"
                className="w-full bg-[#0A0A0A] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-white/20 focus:outline-none transition-colors"
              />
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400 mb-2 block">Date de l&apos;événement</label>
              <input
                type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-white/20 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400 mb-2 block">Lieu</label>
              <input
                type="text" value={location} onChange={e => setLocation(e.target.value)}
                placeholder="ex: CrossFit NBS, Paris"
                className="w-full bg-[#0A0A0A] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-white/20 focus:outline-none transition-colors"
              />
            </div>
          </div>
        )}

        {/* Format */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400 mb-2 block">Format</label>
          <div className="flex gap-3">
            {(['individual', 'team'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  format === f
                    ? `${accentBg} text-white`
                    : 'bg-[#0A0A0A] border border-white/8 text-gray-400 hover:text-white'
                }`}
              >
                {f === 'individual' ? 'Individuel' : 'Équipe'}
              </button>
            ))}
          </div>
        </div>

        {/* Registration URL — both modes */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400 mb-2 block">
            URL d&apos;inscription externe
            {mode === 'info' && <span className="text-blue-400 ml-1">*</span>}
          </label>
          <input
            type="url" value={registrationUrl} onChange={e => setRegistrationUrl(e.target.value)}
            placeholder="https://inscription-competition.com"
            className="w-full bg-[#0A0A0A] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-white/20 focus:outline-none transition-colors"
          />
          <p className="text-[11px] text-gray-600 mt-1">
            {mode === 'qualification'
              ? "Optionnel — affiché si l'athlète ne s'est pas encore inscrit à l'événement."
              : "L'athlète sera redirigé vers ce lien pour s'inscrire."}
          </p>
        </div>

        {/* Price — mode info only */}
        {mode === 'info' && (
          <div>
            <label className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400 mb-2 block">Prix</label>
            <input
              type="text" value={price} onChange={e => setPrice(e.target.value)}
              placeholder="ex: 45€ / personne"
              className="w-full bg-[#0A0A0A] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-white/20 focus:outline-none transition-colors"
            />
          </div>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className={`w-full flex items-center justify-center gap-2 ${accentBg} ${accentBgHover} text-white text-sm font-bold px-4 py-3 rounded-xl transition-colors disabled:opacity-40`}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {editId ? 'Enregistrer les modifications' : 'Créer la compétition'}
        </button>
      </div>
    </div>
  );
}
