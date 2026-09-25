'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { entryRefusalFrom, entryRefusalInfo } from '@/lib/entryRefusalView';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';

interface Props {
  programId: string;
  priceLabel: string;
  recurring: boolean;
}

export default function ProgramBuyButton({ programId, priceLabel, recurring }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Archivage (PR 3) : un refus de box fermée s'affiche dans une boîte d'information.
  const { dialog, inform } = useConfirmDialog();

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
      const refusal = entryRefusalFrom(data);
      if (refusal) { setLoading(false); setOpen(false); void inform(entryRefusalInfo(refusal)); return; }
      if (!res.ok) throw new Error(data.error ?? 'Erreur de paiement');
      window.location.href = data.url;
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <>
      {dialog}
      <Button onClick={() => setOpen(true)} variant="ax-white" size="ax-compact">
        Acheter — {priceLabel}
      </Button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ax-overlay backdrop-blur-sm">
          <div className="w-full max-w-sm bg-ax-surface border border-ax-border rounded-ax-card p-6 relative">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-ax-text-muted hover:text-ax-text transition-colors"
            >
              <X size={18} />
            </button>
            <h3 className="text-lg font-black mb-1">Acheter ce programme</h3>
            <p className="text-xs text-ax-text-muted mb-5">
              {recurring ? `${priceLabel} — abonnement mensuel.` : `${priceLabel} — paiement unique.`}{' '}
              Utilise l'e-mail de ton compte AthleX au paiement : le programme apparaîtra
              automatiquement dans l'app. Pas encore de compte ? Ton achat sera rattaché à
              ton inscription.
            </p>
            {error && <p className="text-xs text-ax-danger mb-3">{error}</p>}
            <Button onClick={handleCheckout} disabled={loading} variant="ax-white" className="w-full">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Redirection…</> : 'Payer par carte'}
            </Button>
            <p className="text-[10px] text-ax-text-muted mt-3 text-center">
              Paiement sécurisé par Stripe. Aucune donnée bancaire n'est stockée par AthleX.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
