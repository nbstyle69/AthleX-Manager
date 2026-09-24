'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Plus, Trash2, X, Copy, Check, Users, Clock, AlertTriangle, Loader2, Ticket, Percent,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const INPUT_CLS = 'w-full min-h-11 px-3 py-2.5 rounded-ax-control bg-ax-surface border border-ax-input-border text-base sm:text-sm text-ax-text placeholder:text-ax-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface transition-colors';

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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h2 className="text-lg font-black text-ax-text">Codes promo</h2>
        <Button variant="ax-mint" onClick={openNewPromo} disabled={!paymentsReady}>
          <Plus size={16} /> Créer un code
        </Button>
      </div>
      <p className="text-xs text-ax-text-muted mb-4">
        Des réductions que l&apos;athlète saisit au moment de payer (page Stripe). Valables sur toutes tes offres (abonnements, Drop-in, Carnet, programmes). Stripe vérifie le code, l&apos;expiration et le quota automatiquement.
        {!paymentsReady && <span className="block mt-1 text-ax-warning font-semibold">Active d&apos;abord les paiements (Stripe) dans Réglages → Paiements pour créer des codes.</span>}
      </p>

      {loading ? (
        <div className="text-center py-10 text-ax-text-muted">Chargement…</div>
      ) : promoCodes.length === 0 ? (
        <div className="text-center py-12 bg-ax-surface border border-ax-border rounded-ax-card">
          <Ticket size={36} className="mx-auto text-ax-text-muted mb-3" />
          <p className="text-ax-text-muted text-sm">Aucun code promo</p>
          <p className="text-ax-text-muted text-xs mt-1">Ex. <span className="font-mono">RENTREE25</span> : -20 % sur les 3 premiers mois</p>
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
              <div key={pc.id} className={`bg-ax-surface border border-ax-border rounded-ax-card p-5 ${(!pc.is_active || expired) ? 'border-dashed border-ax-input-border' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-ax-text text-base tracking-wider break-all">{pc.code}</span>
                      <Badge variant="success" className="text-[10px] px-2 py-0.5 font-bold">{discountLabel}</Badge>
                      {!pc.is_active && <Badge variant="danger" className="text-[10px] px-2 py-0.5">Désactivé</Badge>}
                      {pc.is_active && expired && <Badge variant="warning" className="text-[10px] px-2 py-0.5">Expiré</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-ax-text-muted flex-wrap">
                      <span className="flex items-center gap-1"><Percent size={12} /> Abonnement : {durationLabel}</span>
                      <span className="flex items-center gap-1"><Users size={12} /> {pc.max_redemptions != null ? `${pc.max_redemptions} utilisation${pc.max_redemptions > 1 ? 's' : ''} max` : 'Illimité'}</span>
                      {pc.expires_at && (
                        <span className="flex items-center gap-1"><Clock size={12} /> Expire le {new Date(pc.expires_at).toLocaleDateString('fr-FR')}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-ax-border">
                  <button onClick={() => copyCode(pc.code)} className="flex items-center gap-1.5 px-3 py-2 rounded-ax-control hover:bg-ax-hover text-ax-text-secondary hover:text-ax-text text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface">
                    {codeCopied === pc.code ? <Check size={13} /> : <Copy size={13} />} {codeCopied === pc.code ? 'Copié !' : 'Copier'}
                  </button>
                  <button onClick={() => handleTogglePromo(pc)} disabled={promoBusyId === pc.id} className="flex items-center gap-1.5 px-3 py-2 rounded-ax-control hover:bg-ax-hover text-ax-text-secondary hover:text-ax-text text-xs font-semibold transition-all disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface">
                    {promoBusyId === pc.id ? <Loader2 size={13} className="animate-spin" /> : null}
                    {pc.is_active ? 'Désactiver' : 'Activer'}
                  </button>
                  <button onClick={() => handleDeletePromo(pc)} disabled={promoBusyId === pc.id} className="flex items-center gap-1.5 px-3 py-2 rounded-ax-control hover:bg-ax-danger-soft text-ax-text-muted hover:text-ax-danger text-xs font-semibold transition-all disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ax-overlay backdrop-blur-ax-glass p-4">
          <div className="w-full max-w-lg bg-ax-surface border border-ax-border rounded-ax-panel shadow-ax-panel p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-ax-text">Nouveau code promo</h2>
              <button onClick={() => setShowPromoForm(false)} aria-label="Fermer" className="text-ax-text-muted hover:text-ax-text"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-ax-text-secondary mb-1 block">Code *</label>
                <input
                  className={`${INPUT_CLS} font-mono tracking-wider uppercase`}
                  value={promoForm.code}
                  onChange={e => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })}
                  placeholder="RENTREE25"
                  maxLength={30}
                />
                <p className="text-[11px] text-ax-text-muted mt-1">3 à 30 caractères, lettres et chiffres uniquement.</p>
              </div>

              <div>
                <label className="text-xs font-bold text-ax-text-secondary mb-2 block">Type de remise</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { v: 'percent', label: 'Pourcentage', desc: 'ex. -20 %' },
                    { v: 'amount', label: 'Montant fixe', desc: 'ex. -10 €' },
                  ] as { v: 'percent' | 'amount'; label: string; desc: string }[]).map(o => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setPromoForm({ ...promoForm, discount_type: o.v })}
                      aria-pressed={promoForm.discount_type === o.v}
                      className={`p-3 rounded-ax-control border-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface ${promoForm.discount_type === o.v ? 'border-ax-accent-text bg-ax-accent-soft' : 'border-ax-border hover:border-ax-input-border'}`}
                    >
                      <span className="text-sm font-bold text-ax-text block">{o.label}</span>
                      <span className="text-[11px] text-ax-text-muted">{o.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {promoForm.discount_type === 'percent' ? (
                <div>
                  <label className="text-xs font-bold text-ax-text-secondary mb-1 block">Pourcentage de remise *</label>
                  <div className="relative">
                    <input
                      type="number" min="1" max="100"
                      className={`${INPUT_CLS} pr-8`}
                      value={promoForm.percent_off}
                      onChange={e => setPromoForm({ ...promoForm, percent_off: e.target.value })}
                      placeholder="20"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ax-text-muted">%</span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold text-ax-text-secondary mb-1 block">Montant de remise *</label>
                  <div className="relative">
                    <input
                      type="number" min="0" step="0.01"
                      className={`${INPUT_CLS} pr-8`}
                      value={promoForm.amount_off}
                      onChange={e => setPromoForm({ ...promoForm, amount_off: e.target.value })}
                      placeholder="10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ax-text-muted">€</span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-ax-text-secondary mb-2 block">Durée de la remise (abonnements)</label>
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
                      aria-pressed={promoForm.duration === o.v}
                      className={`p-3 rounded-ax-control border-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface ${promoForm.duration === o.v ? 'border-ax-accent-text bg-ax-accent-soft' : 'border-ax-border hover:border-ax-input-border'}`}
                    >
                      <span className="text-sm font-bold text-ax-text block">{o.label}</span>
                      <span className="text-[11px] text-ax-text-muted">{o.desc}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-ax-text-muted mt-1">Sur un achat unique (Drop-in / Carnet / programme), la remise s&apos;applique une seule fois quel que soit ce réglage.</p>
              </div>

              {promoForm.duration === 'repeating' && (
                <div>
                  <label className="text-xs font-bold text-ax-text-secondary mb-1 block">Nombre de mois *</label>
                  <input
                    type="number" min="1"
                    className={INPUT_CLS}
                    value={promoForm.duration_in_months}
                    onChange={e => setPromoForm({ ...promoForm, duration_in_months: e.target.value })}
                    placeholder="3"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-ax-text-secondary mb-1 block">Utilisations max</label>
                  <input
                    type="number" min="1"
                    className={INPUT_CLS}
                    value={promoForm.max_redemptions}
                    onChange={e => setPromoForm({ ...promoForm, max_redemptions: e.target.value })}
                    placeholder="Illimité"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-ax-text-secondary mb-1 block">Expire le</label>
                  <input
                    type="date"
                    className={INPUT_CLS}
                    value={promoForm.expires_at}
                    onChange={e => setPromoForm({ ...promoForm, expires_at: e.target.value })}
                  />
                </div>
              </div>

              {promoError && (
                <div className="flex items-start gap-2 text-xs text-ax-danger bg-ax-danger-soft border border-ax-danger rounded-ax-control px-3 py-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {promoError}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mt-6">
              <Button variant="ax-outline" onClick={() => setShowPromoForm(false)} className="flex-1">
                Annuler
              </Button>
              <Button
                variant="ax-mint"
                onClick={handleSavePromo}
                disabled={promoSaving}
                className="flex-1"
              >
                {promoSaving ? <Loader2 size={16} className="animate-spin" /> : <Ticket size={16} />}
                {promoSaving ? 'Création…' : 'Créer le code'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
