'use client';

import { useState } from 'react';
import { X, Loader2, FileText } from 'lucide-react';

interface Props {
  planId: string;
  planName: string;
  priceLabel: string;
  /** 'subscription' (mensuel) ou 'oneshot' (Drop-in / Carnet, paiement unique) */
  mode?: 'subscription' | 'oneshot';
  commitmentMonths?: number;
  description?: string | null;
  maxSessionsPerWeek?: number | null;
  terms?: string | null;
  termsPdfUrl?: string | null;
}

export default function MembershipSubscribeButton({
  planId, planName, priceLabel, mode = 'subscription',
  commitmentMonths = 0, description = null, maxSessionsPerWeek = null, terms = null, termsPdfUrl = null,
}: Props) {
  const oneShot = mode === 'oneshot';
  const cta = oneShot ? 'Acheter' : 'S\'abonner';
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      // L'e-mail n'est plus saisi ici : c'est celui du paiement Stripe (ou de la
      // session si l'acheteur est connecté) qui détermine le compte crédité.
      const res = await fetch('/api/create-membership-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur de paiement');
      window.location.href = data.url;
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-bold text-black bg-white hover:bg-gray-200 transition-colors px-4 py-2 rounded-lg whitespace-nowrap"
      >
        {cta} — {priceLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#111] border border-white/10 rounded-2xl p-6 relative">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
            <h3 className="text-lg font-black mb-1">{cta} — {planName}</h3>
            <p className="text-xs text-gray-500 mb-5">
              {oneShot
                ? `${priceLabel} — paiement unique. Utilise l'e-mail de ton compte AthleX au paiement : tes crédits de séances s'activent automatiquement. Pas encore de compte ? Ton achat sera rattaché à ton inscription.`
                : `${priceLabel} — abonnement mensuel. Utilise l'e-mail de ton compte AthleX au paiement : ton abonnement et l'accès aux cours s'activent automatiquement dans l'app. Pas encore de compte ? Ton abonnement sera rattaché à ton inscription.`}
            </p>

            {!oneShot && (
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 mb-4 space-y-1.5">
                <p className="text-[11px] font-black text-gray-300 uppercase tracking-wide mb-1">Récapitulatif du contrat</p>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Prix TTC</span>
                  <span className="text-white font-semibold">{priceLabel} / mois</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Engagement</span>
                  <span className="text-white font-semibold">
                    {commitmentMonths > 0 ? `${commitmentMonths} mois` : 'Sans engagement'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Séances</span>
                  <span className="text-white font-semibold">
                    {maxSessionsPerWeek ? `${maxSessionsPerWeek} / semaine` : 'Illimitées'}
                  </span>
                </div>
                {description && (
                  <p className="text-[11px] text-gray-400 pt-1.5 border-t border-white/[0.06] whitespace-pre-wrap">{description}</p>
                )}
                {terms && (
                  <p className="text-[11px] text-gray-500 pt-1.5 border-t border-white/[0.06] whitespace-pre-wrap">{terms}</p>
                )}
                <p className="text-[10px] text-gray-600 pt-1.5 border-t border-white/[0.06]">
                  {commitmentMonths > 0
                    ? `Résiliation libre après ${commitmentMonths} mois. Avant l'échéance : uniquement pour motif légitime (déménagement, santé) sur justificatif. Gel possible en cas de blessure/absence.`
                    : `Résiliation à tout moment (effet à la fin de la période payée). Gel possible en cas de blessure/absence.`}
                </p>
                {termsPdfUrl && (
                  <a
                    href={termsPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-white/80 hover:text-white pt-1.5 border-t border-white/[0.06]"
                  >
                    <FileText size={12} /> Voir les conditions générales (PDF)
                  </a>
                )}
              </div>
            )}

            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full text-sm font-bold text-black bg-white hover:bg-gray-200 disabled:opacity-60 transition-colors py-2.5 rounded-lg flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Redirection…</> : 'Payer par carte'}
            </button>
            <p className="text-[10px] text-gray-600 mt-3 text-center">
              Paiement sécurisé par Stripe. Aucune donnée bancaire n'est stockée par AthleX.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
