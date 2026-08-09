'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';

interface Props {
  programId: string;
  priceLabel: string;
  recurring: boolean;
}

export default function ProgramBuyButton({ programId, priceLabel, recurring }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      // L'e-mail n'est plus saisi ici : c'est celui du paiement Stripe (ou de la
      // session si l'acheteur est connecté) qui détermine le compte crédité.
      const res = await fetch('/api/create-program-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_id: programId }),
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
        className="text-xs font-bold text-black bg-white hover:bg-gray-200 transition-colors px-4 py-2 rounded-lg"
      >
        Acheter — {priceLabel}
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
            <h3 className="text-lg font-black mb-1">Acheter ce programme</h3>
            <p className="text-xs text-gray-500 mb-5">
              {recurring ? `${priceLabel} — abonnement mensuel.` : `${priceLabel} — paiement unique.`}{' '}
              Utilise l'e-mail de ton compte AthleX au paiement : le programme apparaîtra
              automatiquement dans l'app. Pas encore de compte ? Ton achat sera rattaché à
              ton inscription.
            </p>
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
