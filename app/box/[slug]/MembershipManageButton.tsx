'use client';

import { useState } from 'react';
import { X, Loader2, CheckCircle2, Settings2 } from 'lucide-react';

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
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 text-xs font-semibold text-gray-300 border border-white/15 hover:bg-white/5 transition-colors px-4 py-2 rounded-lg"
      >
        <Settings2 size={14} /> Changer de formule
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#111] border border-white/10 rounded-2xl p-6 relative">
            <button
              onClick={close}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>

            {done !== null ? (
              <div className="text-center py-4">
                <CheckCircle2 size={40} className="text-green-400 mx-auto mb-4" />
                <h3 className="text-lg font-black mb-1">Formule changée 🎉</h3>
                <p className="text-xs text-gray-500">
                  Tu es maintenant sur la formule <span className="text-white font-semibold">{done}</span>.
                  Le prorata a été appliqué immédiatement et la facturation reste ancrée au 1er du mois.
                </p>
                <button
                  onClick={close}
                  className="mt-6 w-full text-sm font-bold text-black bg-white hover:bg-gray-200 py-2.5 rounded-lg"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-black mb-1">Changer de formule</h3>
                <p className="text-xs text-gray-500 mb-5">
                  Tu dois être connecté à ton compte AthleX. Le changement est immédiat, avec
                  prorata Stripe (crédit du temps non consommé), sans changer ta date de facturation.
                </p>
                <div className="space-y-2 mb-4">
                  {plans.map(pl => (
                    <button
                      key={pl.id}
                      onClick={() => setPlanId(pl.id)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm transition-colors ${
                        planId === pl.id
                          ? 'border-white bg-white/10 text-white'
                          : 'border-white/10 text-gray-300 hover:border-white/25'
                      }`}
                    >
                      <span className="font-semibold">{pl.name}</span>
                      <span className="text-xs text-gray-400">{pl.priceLabel}</span>
                    </button>
                  ))}
                </div>
                {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full text-sm font-bold text-black bg-white hover:bg-gray-200 disabled:opacity-60 transition-colors py-2.5 rounded-lg flex items-center justify-center gap-2"
                >
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Traitement…</> : 'Confirmer le changement'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
