'use client';

import { useState } from 'react';
import { Layers, CreditCard, ArrowLeft } from 'lucide-react';
import { setActiveBox } from '@/app/(dashboard)/actions';

interface Props {
  boxName: string;
  boxCount: number;
  primaryBoxId: string | null;
  basePrice: number;
  extraPerBox: number;
}

export default function MultiBoxUpgradeOverlay({ boxName, boxCount, primaryBoxId, basePrice, extraPerBox }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extraBoxes = Math.max(0, boxCount - 1);
  const monthly = basePrice + extraBoxes * extraPerBox;

  async function upgrade() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/create-owner-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ box_quota: boxCount }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      setError(data.error ?? 'Impossible de démarrer le paiement.');
    } catch {
      setError('Impossible de démarrer le paiement.');
    } finally {
      setLoading(false);
    }
  }

  async function backToPrimary() {
    if (!primaryBoxId) return;
    await setActiveBox(primaryBoxId);
    window.location.reload();
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0A0A0A]/90 backdrop-blur-sm p-6"
      role="dialog" aria-modal="true"
    >
      <div className="bg-[#111111] border border-white/10 rounded-2xl p-8 max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center mx-auto mb-5">
          <Layers size={24} className="text-white" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Débloque le multi-box</h2>
        <p className="text-sm text-gray-400 mb-1">
          « {boxName} » est une box supplémentaire.
        </p>
        <p className="text-sm text-gray-400 mb-5">
          Passe au plan <span className="text-white font-semibold">Multi-box</span> pour gérer toutes tes box
          depuis le même AthleX Manager.
        </p>

        <div className="rounded-xl bg-white/5 border border-white/10 p-4 mb-5 text-left">
          <div className="flex items-center justify-between text-sm text-gray-300 mb-1">
            <span>Plan de base</span><span>{basePrice} €</span>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-300 mb-2">
            <span>{extraBoxes} box supplémentaire{extraBoxes > 1 ? 's' : ''} × {extraPerBox} €</span>
            <span>{extraBoxes * extraPerBox} €</span>
          </div>
          <div className="flex items-center justify-between text-white font-bold border-t border-white/10 pt-2">
            <span>Total</span><span>{monthly} € / mois</span>
          </div>
        </div>

        <button
          onClick={upgrade} disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-white text-[#0A0A0A] font-bold py-3.5 rounded-xl hover:bg-gray-200 transition-colors text-sm mb-3 disabled:opacity-60"
        >
          <CreditCard size={16} />
          {loading ? 'Redirection…' : 'Passer au plan Multi-box'}
        </button>

        {primaryBoxId && (
          <button
            onClick={backToPrimary}
            className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-white text-xs font-bold py-2 transition-colors"
          >
            <ArrowLeft size={13} />
            Revenir à ma box principale
          </button>
        )}

        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>
    </div>
  );
}
