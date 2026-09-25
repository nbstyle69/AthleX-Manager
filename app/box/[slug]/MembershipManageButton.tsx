'use client';

import { useState } from 'react';
import { X, Loader2, CheckCircle2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { entryRefusalFrom, entryRefusalInfo } from '@/lib/entryRefusalView';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';

interface Plan {
  id: string;
  name: string;
  priceLabel: string;
}

interface Props {
  plans: Plan[];
}

export default function MembershipManageButton({ plans }: Props) {
  const [open, setOpen] = useState(false);
  const [planId, setPlanId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  // Archivage (PR 3) : un refus de box fermée s'affiche dans une boîte d'information.
  const { dialog, inform } = useConfirmDialog();

  async function handleSubmit() {
    if (!planId) {
      setError('Choisis la nouvelle formule.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/change-membership-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_plan_id: planId }),
      });
      const data = await res.json();
      const refusal = entryRefusalFrom(data);
      if (refusal) { setLoading(false); setOpen(false); void inform(entryRefusalInfo(refusal)); return; }
      if (res.status === 401) {
        throw new Error('Connecte-toi à ton compte AthleX pour changer de formule.');
      }
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      setDone(data.plan_name ?? '');
      setLoading(false);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  function close() {
    setOpen(false);
    setDone(null);
    setError(null);
    setPlanId('');
  }

  return (
    <>
      {dialog}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 text-xs font-semibold text-ax-text border border-ax-border hover:bg-ax-hover transition-colors px-4 py-2 rounded-ax-control"
      >
        <Settings2 size={14} /> Changer de formule
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ax-overlay backdrop-blur-sm">
          <div className="w-full max-w-sm bg-ax-surface border border-ax-border rounded-ax-card p-6 relative">
            <button
              onClick={close}
              className="absolute top-4 right-4 text-ax-text-muted hover:text-ax-text transition-colors"
            >
              <X size={18} />
            </button>

            {done !== null ? (
              <div className="text-center py-4">
                <CheckCircle2 size={40} className="text-ax-success mx-auto mb-4" />
                <h3 className="text-lg font-black mb-1">Formule changée 🎉</h3>
                <p className="text-xs text-ax-text-muted">
                  Tu es maintenant sur la formule <span className="text-ax-text font-semibold">{done}</span>.
                  Le prorata a été appliqué immédiatement et la facturation reste ancrée au 1er du mois.
                </p>
                <Button onClick={close} variant="ax-white" className="mt-6 w-full">
                  Fermer
                </Button>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-black mb-1">Changer de formule</h3>
                <p className="text-xs text-ax-text-muted mb-5">
                  Tu dois être connecté à ton compte AthleX. Le changement est immédiat, avec
                  prorata Stripe (crédit du temps non consommé), sans changer ta date de facturation.
                </p>
                <div className="space-y-2 mb-4">
                  {plans.map(pl => (
                    <button
                      key={pl.id}
                      onClick={() => setPlanId(pl.id)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-ax-control border text-sm transition-colors ${
                        planId === pl.id
                          ? 'border-ax-text bg-ax-hover text-ax-text'
                          : 'border-ax-border text-ax-text hover:border-ax-input-border'
                      }`}
                    >
                      <span className="font-semibold">{pl.name}</span>
                      <span className="text-xs text-ax-text-secondary">{pl.priceLabel}</span>
                    </button>
                  ))}
                </div>
                {error && <p className="text-xs text-ax-danger mb-3">{error}</p>}
                <Button onClick={handleSubmit} disabled={loading} variant="ax-white" className="w-full">
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Traitement…</> : 'Confirmer le changement'}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
