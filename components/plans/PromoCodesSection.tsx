'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Plus, Trash2, X, Copy, Check, Users, Clock, AlertTriangle, Loader2, Ticket, Percent,
} from 'lucide-react';

export interface PromoCode {
  id: string;
  box_id: string;
  code: string;
  discount_type: 'percent' | 'amount';
  percent_off: number | null;
  amount_off_cents: number | null;
  currency: string;
  duration: 'once' | 'repeating' | 'forever';
  duration_in_months: number | null;
  max_redemptions: number | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

const EMPTY_PROMO_FORM = {
  code: '',
  discount_type: 'percent' as 'percent' | 'amount',
  percent_off: '' as string,
  amount_off: '' as string,          // en euros (converti en cents)
  duration: 'once' as 'once' | 'repeating' | 'forever', // abonnements uniquement
  duration_in_months: '' as string,
  max_redemptions: '' as string,     // vide = illimité
  expires_at: '' as string,          // date locale (yyyy-mm-dd) ou vide
};

export default function PromoCodesSection({
  boxId, paymentsReady,
}: {
  boxId: string | null;
  /** Stripe Connect en place : sans compte, Stripe ne peut pas porter le code. */
  paymentsReady: boolean;
}) {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [promoForm, setPromoForm] = useState(EMPTY_PROMO_FORM);
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoBusyId, setPromoBusyId] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState<string | null>(null);

  const loadPromoCodes = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/promo-codes?box_id=${encodeURIComponent(id)}`);
      if (!res.ok) { setPromoCodes([]); return; }
      const data = await res.json();
      setPromoCodes((data.codes ?? []) as PromoCode[]);
    } catch { setPromoCodes([]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!boxId) return;
    loadPromoCodes(boxId);
  }, [boxId, loadPromoCodes]);

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCodeCopied(code);
    setTimeout(() => setCodeCopied(null), 2000);
  }

  function openNewPromo() {
    setPromoForm(EMPTY_PROMO_FORM);
    setPromoError(null);
    setShowPromoForm(true);
  }

  async function handleSavePromo() {
    if (!boxId) return;
    setPromoError(null);

    const code = promoForm.code.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,30}$/.test(code)) {
      setPromoError('Le code doit faire 3 à 30 caractères (lettres/chiffres, sans espace).');
      return;
    }

    const body: Record<string, unknown> = {
      box_id: boxId,
      code,
      discount_type: promoForm.discount_type,
      duration: promoForm.duration,
      max_redemptions: promoForm.max_redemptions.trim() || null,
      expires_at: promoForm.expires_at ? new Date(promoForm.expires_at).toISOString() : null,
    };

    if (promoForm.discount_type === 'percent') {
      const pct = parseFloat(promoForm.percent_off.replace(',', '.'));
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
        setPromoError('Pourcentage invalide (1 à 100).');
        return;
      }
      body.percent_off = pct;
    } else {
      const eur = parseFloat(promoForm.amount_off.replace(',', '.'));
      if (!Number.isFinite(eur) || eur <= 0) {
        setPromoError('Montant invalide.');
        return;
      }
      body.amount_off_cents = Math.round(eur * 100);
    }

    if (promoForm.duration === 'repeating') {
      const months = parseInt(promoForm.duration_in_months);
      if (!Number.isFinite(months) || months <= 0) {
        setPromoError('Indique le nombre de mois de la remise.');
        return;
      }
      body.duration_in_months = months;
    }

    setPromoSaving(true);
    try {
      const res = await fetch('/api/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setPromoError(data.error ?? 'Impossible de créer le code.');
        setPromoSaving(false);
        return;
      }
      setShowPromoForm(false);
      await loadPromoCodes(boxId);
    } catch {
      setPromoError('Erreur réseau.');
    }
    setPromoSaving(false);
  }

  async function handleTogglePromo(promo: PromoCode) {
    setPromoBusyId(promo.id);
    try {
      await fetch(`/api/promo-codes/${promo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !promo.is_active }),
      });
      if (boxId) await loadPromoCodes(boxId);
    } catch { /* noop */ }
    setPromoBusyId(null);
  }

  async function handleDeletePromo(promo: PromoCode) {
    if (!confirm(`Supprimer le code ${promo.code} ? Il ne sera plus utilisable au paiement.`)) return;
    setPromoBusyId(promo.id);
    try {
      await fetch(`/api/promo-codes/${promo.id}`, { method: 'DELETE' });
      if (boxId) await loadPromoCodes(boxId);
    } catch { /* noop */ }
    setPromoBusyId(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-black text-white">Codes promo</h2>
        <button
          onClick={openNewPromo}
          disabled={!paymentsReady}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-all"
        >
          <Plus size={16} /> Créer un code
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Des réductions que l&apos;athlète saisit au moment de payer (page Stripe). Valables sur toutes tes offres (abonnements, Drop-in, Carnet, programmes). Stripe vérifie le code, l&apos;expiration et le quota automatiquement.
        {!paymentsReady && <span className="block mt-1 text-amber-400/90 font-semibold">Active d&apos;abord les paiements (Stripe) dans Réglages → Paiements pour créer des codes.</span>}
      </p>

      {loading ? (
        <div className="text-center py-10 text-gray-500">Chargement…</div>
      ) : promoCodes.length === 0 ? (
        <div className="text-center py-12 bg-[#111] border border-white/[0.06] rounded-2xl">
          <Ticket size={36} className="mx-auto text-gray-600 mb-3" />
          <p className="text-gray-500 text-sm">Aucun code promo</p>
          <p className="text-gray-600 text-xs mt-1">Ex. <span className="font-mono">RENTREE25</span> : -20 % sur les 3 premiers mois</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {promoCodes.map(pc => {
            const expired = pc.expires_at ? new Date(pc.expires_at).getTime() < Date.now() : false;
            const discountLabel = pc.discount_type === 'percent'
              ? `-${pc.percent_off}%`
              : `-${((pc.amount_off_cents ?? 0) / 100).toFixed(2)} €`;
            const durationLabel = pc.duration === 'forever'
              ? 'à vie'
              : pc.duration === 'repeating'
              ? `${pc.duration_in_months} mois`
              : '1 fois';
            return (
              <div key={pc.id} className={`bg-[#111] border border-white/[0.06] rounded-2xl p-5 ${(!pc.is_active || expired) ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-white text-base tracking-wider">{pc.code}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-emerald-500/10 text-emerald-400">{discountLabel}</span>
                      {!pc.is_active && <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 font-semibold">Désactivé</span>}
                      {pc.is_active && expired && <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 font-semibold">Expiré</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1"><Percent size={12} /> Abonnement : {durationLabel}</span>
                      <span className="flex items-center gap-1"><Users size={12} /> {pc.max_redemptions != null ? `${pc.max_redemptions} utilisation${pc.max_redemptions > 1 ? 's' : ''} max` : 'Illimité'}</span>
                      {pc.expires_at && (
                        <span className="flex items-center gap-1"><Clock size={12} /> Expire le {new Date(pc.expires_at).toLocaleDateString('fr-FR')}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/[0.06]">
                  <button onClick={() => copyCode(pc.code)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white text-xs font-semibold transition-all">
                    {codeCopied === pc.code ? <Check size={13} /> : <Copy size={13} />} {codeCopied === pc.code ? 'Copié !' : 'Copier'}
                  </button>
                  <button onClick={() => handleTogglePromo(pc)} disabled={promoBusyId === pc.id} className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white text-xs font-semibold transition-all disabled:opacity-40">
                    {promoBusyId === pc.id ? <Loader2 size={13} className="animate-spin" /> : null}
                    {pc.is_active ? 'Désactiver' : 'Activer'}
                  </button>
                  <button onClick={() => handleDeletePromo(pc)} disabled={promoBusyId === pc.id} className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 text-xs font-semibold transition-all disabled:opacity-40">
                    <Trash2 size={13} /> Supprimer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal code promo */}
      {showPromoForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-[#111] border border-white/[0.06] rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-white">Nouveau code promo</h2>
              <button onClick={() => setShowPromoForm(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 mb-1 block">Code *</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono tracking-wider uppercase outline-none focus:border-emerald-500/50"
                  value={promoForm.code}
                  onChange={e => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })}
                  placeholder="RENTREE25"
                  maxLength={30}
                />
                <p className="text-[11px] text-gray-600 mt-1">3 à 30 caractères, lettres et chiffres uniquement.</p>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block">Type de remise</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { v: 'percent', label: 'Pourcentage', desc: 'ex. -20 %' },
                    { v: 'amount', label: 'Montant fixe', desc: 'ex. -10 €' },
                  ] as { v: 'percent' | 'amount'; label: string; desc: string }[]).map(o => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setPromoForm({ ...promoForm, discount_type: o.v })}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${promoForm.discount_type === o.v ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 hover:border-white/20'}`}
                    >
                      <span className="text-sm font-bold text-white block">{o.label}</span>
                      <span className="text-[11px] text-gray-500">{o.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {promoForm.discount_type === 'percent' ? (
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Pourcentage de remise *</label>
                  <div className="relative">
                    <input
                      type="number" min="1" max="100"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 pr-8 text-sm text-white outline-none focus:border-emerald-500/50"
                      value={promoForm.percent_off}
                      onChange={e => setPromoForm({ ...promoForm, percent_off: e.target.value })}
                      placeholder="20"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">%</span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Montant de remise *</label>
                  <div className="relative">
                    <input
                      type="number" min="0" step="0.01"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 pr-8 text-sm text-white outline-none focus:border-emerald-500/50"
                      value={promoForm.amount_off}
                      onChange={e => setPromoForm({ ...promoForm, amount_off: e.target.value })}
                      placeholder="10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">€</span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block">Durée de la remise (abonnements)</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: 'once', label: '1 fois', desc: '1re facture' },
                    { v: 'repeating', label: 'N mois', desc: 'plusieurs mois' },
                    { v: 'forever', label: 'À vie', desc: 'toujours' },
                  ] as { v: 'once' | 'repeating' | 'forever'; label: string; desc: string }[]).map(o => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setPromoForm({ ...promoForm, duration: o.v })}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${promoForm.duration === o.v ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 hover:border-white/20'}`}
                    >
                      <span className="text-sm font-bold text-white block">{o.label}</span>
                      <span className="text-[11px] text-gray-500">{o.desc}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-600 mt-1">Sur un achat unique (Drop-in / Carnet / programme), la remise s&apos;applique une seule fois quel que soit ce réglage.</p>
              </div>

              {promoForm.duration === 'repeating' && (
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Nombre de mois *</label>
                  <input
                    type="number" min="1"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                    value={promoForm.duration_in_months}
                    onChange={e => setPromoForm({ ...promoForm, duration_in_months: e.target.value })}
                    placeholder="3"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Utilisations max</label>
                  <input
                    type="number" min="1"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                    value={promoForm.max_redemptions}
                    onChange={e => setPromoForm({ ...promoForm, max_redemptions: e.target.value })}
                    placeholder="Illimité"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Expire le</label>
                  <input
                    type="date"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                    value={promoForm.expires_at}
                    onChange={e => setPromoForm({ ...promoForm, expires_at: e.target.value })}
                  />
                </div>
              </div>

              {promoError && (
                <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {promoError}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button onClick={() => setShowPromoForm(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm font-bold transition-all">
                Annuler
              </button>
              <button
                onClick={handleSavePromo}
                disabled={promoSaving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold transition-all"
              >
                {promoSaving ? <Loader2 size={16} className="animate-spin" /> : <Ticket size={16} />}
                {promoSaving ? 'Création…' : 'Créer le code'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
