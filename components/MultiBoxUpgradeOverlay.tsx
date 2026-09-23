'use client';

import { useState } from 'react';
import { Layers, CreditCard, ArrowLeft } from 'lucide-react';
import { setActiveBox } from '@/app/(dashboard)/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

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
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ax-overlay backdrop-blur-ax-glass p-6"
      role="dialog" aria-modal="true"
    >
      <Card className="rounded-ax-panel shadow-ax-panel p-8 max-w-md w-full max-h-full overflow-y-auto text-center">
        <div className="w-14 h-14 rounded-ax-card bg-ax-accent-soft border border-ax-border flex items-center justify-center mx-auto mb-5">
          <Layers size={24} className="text-ax-accent-text" />
        </div>
        <h2 className="font-display text-xl font-medium uppercase tracking-wide text-ax-text mb-2">Débloque le multi-box</h2>
        <p className="text-sm text-ax-text-secondary mb-1">
          « {boxName} » est une box supplémentaire.
        </p>
        <p className="text-sm text-ax-text-secondary mb-5">
          Passe au plan <span className="text-ax-text font-semibold">Multi-box</span> pour gérer toutes tes box
          depuis le même AthleX Manager.
        </p>

        <div className="rounded-ax-card bg-ax-surface-secondary border border-ax-border p-4 mb-5 text-left">
          <div className="flex items-center justify-between text-sm text-ax-text-secondary mb-1">
            <span>Plan de base</span><span>{basePrice} €</span>
          </div>
          <div className="flex items-center justify-between text-sm text-ax-text-secondary mb-2">
            <span>{extraBoxes} box supplémentaire{extraBoxes > 1 ? 's' : ''} × {extraPerBox} €</span>
            <span>{extraBoxes * extraPerBox} €</span>
          </div>
          <div className="flex items-center justify-between text-ax-text font-bold border-t border-ax-border pt-2">
            <span>Total</span><span>{monthly} € / mois</span>
          </div>
        </div>

        <Button
          variant="ax-mint"
          onClick={upgrade} disabled={loading}
          className="w-full mb-3"
        >
          <CreditCard size={16} />
          {loading ? 'Redirection…' : 'Passer au plan Multi-box'}
        </Button>

        {primaryBoxId && (
          <Button
            variant="ax-outline"
            onClick={backToPrimary}
            className="w-full text-xs"
          >
            <ArrowLeft size={13} />
            Revenir à ma box principale
          </Button>
        )}

        {error && <p className="text-xs text-ax-danger mt-2">{error}</p>}
      </Card>
    </div>
  );
}
