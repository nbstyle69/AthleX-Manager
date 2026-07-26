'use client';

import { useState } from 'react';
import { Loader2, Settings2, XCircle, FileUp, PauseCircle } from 'lucide-react';

interface Plan { id: string; name: string; price_cents: number }

interface Props {
  currentPlanId: string | null;
  plans: Plan[];
  canManage: boolean;
  boxId: string;
  commitmentEndDate: string | null;
  paused: boolean;
  pauseResumesAt: string | null;
}

function fmt(cents: number) {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: cents % 100 === 0 ? 0 : 2 });
}

function fmtDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

const REASONS = [
  { value: 'moving', label: 'Déménagement' },
  { value: 'medical', label: 'Santé / blessure grave' },
  { value: 'other', label: 'Autre motif' },
] as const;

export default function ManageSubscription({
  currentPlanId, plans, canManage, boxId, commitmentEndDate, paused, pauseResumesAt,
}: Props) {
  const [mode, setMode] = useState<null | 'change' | 'cancel' | 'request'>(null);
  const [planId, setPlanId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Demande de résiliation anticipée
  const [reasonType, setReasonType] = useState<string>('moving');
  const [reqMessage, setReqMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const otherPlans = plans.filter(p => p.id !== currentPlanId);
  const engaged = !!commitmentEndDate && new Date(commitmentEndDate) > new Date();

  async function handleChange() {
    if (!planId) { setError('Choisis une formule.'); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/change-membership-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_plan_id: planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      setMessage(`Formule changée pour « ${data.plan_name} ». La page se recharge…`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
      setLoading(false);
    }
  }

  async function handleCancel() {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/cancel-membership', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        // Engagement encore actif → bascule vers la demande sur justificatif.
        if (data.error === 'ENGAGEMENT_ACTIVE') {
          setMode('request');
          setLoading(false);
          return;
        }
        throw new Error(data.error ?? 'Erreur');
      }
      setMessage('Ton abonnement sera résilié à la fin de la période en cours. La page se recharge…');
      setTimeout(() => window.location.reload(), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
      setLoading(false);
    }
  }

  async function handleRequest() {
    setLoading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append('box_id', boxId);
      fd.append('reason_type', reasonType);
      if (reqMessage.trim()) fd.append('message', reqMessage.trim());
      if (file) fd.append('document', file);
      const res = await fetch('/api/cancellation-request', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      setMessage('Ta demande de résiliation a été envoyée à ta box. Tu seras notifié·e de la décision.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
      setLoading(false);
    }
  }

  if (!canManage) return null;

  return (
    <div className="pt-3 border-t border-white/[0.06] space-y-3">
      {paused && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400">
          <PauseCircle size={13} /> Abonnement en pause{pauseResumesAt ? ` — reprise le ${fmtDate(pauseResumesAt)}` : ''}. Contacte ta box pour le réactiver.
        </div>
      )}
      {engaged && (
        <p className="text-[11px] text-amber-400/90 font-semibold">
          Engagement jusqu&apos;au {fmtDate(commitmentEndDate)}.
        </p>
      )}

      {message ? (
        <p className="text-xs text-emerald-400 font-semibold">{message}</p>
      ) : mode === null ? (
        <div className="flex flex-wrap gap-2">
          {otherPlans.length > 0 && (
            <button
              onClick={() => setMode('change')}
              className="flex items-center gap-1.5 text-xs font-bold text-gray-300 bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 transition-all"
            >
              <Settings2 size={13} /> Changer de formule
            </button>
          )}
          <button
            onClick={() => setMode(engaged ? 'request' : 'cancel')}
            className="flex items-center gap-1.5 text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg px-3 py-2 transition-all"
          >
            <XCircle size={13} /> {engaged ? 'Demander une résiliation' : 'Résilier'}
          </button>
        </div>
      ) : mode === 'change' ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 font-semibold">Nouvelle formule (prorata immédiat)</p>
          <div className="grid gap-2">
            {otherPlans.map(p => (
              <label key={p.id} className={`flex items-center justify-between border rounded-xl px-3 py-2.5 cursor-pointer transition-all ${planId === p.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 hover:border-white/20'}`}>
                <span className="flex items-center gap-2">
                  <input type="radio" name="plan" checked={planId === p.id} onChange={() => setPlanId(p.id)} className="accent-emerald-500" />
                  <span className="text-sm text-white font-semibold">{p.name}</span>
                </span>
                <span className="text-sm font-black text-white">{fmt(p.price_cents)}<span className="text-[10px] text-gray-500"> /mois</span></span>
              </label>
            ))}
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleChange} disabled={loading} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all">
              {loading && <Loader2 size={13} className="animate-spin" />} Confirmer
            </button>
            <button onClick={() => { setMode(null); setError(null); setPlanId(''); }} className="px-4 py-2 rounded-lg text-xs font-bold text-gray-400 hover:text-white transition-all">Annuler</button>
          </div>
        </div>
      ) : mode === 'cancel' ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">Ton abonnement restera actif jusqu&apos;à la fin de la période déjà payée, puis sera résilié. Tu ne seras plus prélevé.</p>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleCancel} disabled={loading} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold transition-all">
              {loading && <Loader2 size={13} className="animate-spin" />} Confirmer la résiliation
            </button>
            <button onClick={() => { setMode(null); setError(null); }} className="px-4 py-2 rounded-lg text-xs font-bold text-gray-400 hover:text-white transition-all">Retour</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">
            {engaged
              ? `Ton abonnement est engagé jusqu'au ${fmtDate(commitmentEndDate)}. Une résiliation anticipée n'est possible que pour un motif légitime (déménagement, problème de santé grave), sur justificatif. Ta box étudiera la demande.`
              : 'Décris le motif de ta demande de résiliation. Tu peux joindre un justificatif.'}
          </p>
          <div>
            <label className="text-xs font-bold text-gray-400 mb-1 block">Motif</label>
            <select value={reasonType} onChange={e => setReasonType(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30">
              {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 mb-1 block">Message (optionnel)</label>
            <textarea value={reqMessage} onChange={e => setReqMessage(e.target.value)} rows={3}
              placeholder="Explique brièvement ta situation…"
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30 resize-none" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 mb-1 block">Justificatif (PDF ou image, max 10 Mo)</label>
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-300 bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2.5 cursor-pointer transition-all w-fit">
              <FileUp size={14} /> {file ? file.name : 'Choisir un fichier'}
              <input type="file" accept=".pdf,image/*" className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleRequest} disabled={loading} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold transition-all">
              {loading && <Loader2 size={13} className="animate-spin" />} Envoyer la demande
            </button>
            <button onClick={() => { setMode(null); setError(null); }} className="px-4 py-2 rounded-lg text-xs font-bold text-gray-400 hover:text-white transition-all">Retour</button>
          </div>
        </div>
      )}
    </div>
  );
}
