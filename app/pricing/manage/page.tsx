'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Zap } from 'lucide-react';
import { LandingHeader } from '@/components/landing/header';
import { useLanguage } from '@/components/language-provider';
import { entryRefusalFrom, entryRefusalInfo } from '@/lib/entryRefusalView';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';

export default function ManageSubscriptionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-ax-background text-ax-text flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-ax-input-border border-t-ax-text rounded-full animate-spin" />
      </div>
    }>
      <ManageContent />
    </Suspense>
  );
}

function ManageContent() {
  const { t } = useLanguage();
  const m = t.funnel.manage;
  const params = useSearchParams();
  const boxId = params.get('box_id');
  const [error, setError] = useState<string | null>(null);
  // Archivage (PR 3) : un refus de box fermée s'affiche dans une boîte d'information.
  const { dialog, inform } = useConfirmDialog();

  useEffect(() => {
    if (!boxId) {
      setError(m.missingBox);
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/stripe-portal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ box_id: boxId }),
        });
        if (res.status === 401) {
          // Page ouverte depuis l'app mobile : aucune session web. Connexion
          // puis retour direct sur le portail.
          window.location.href = `/login/box?next=${encodeURIComponent(`/pricing/manage?box_id=${boxId}`)}`;
          return;
        }
        const data = await res.json();
        const refusal = entryRefusalFrom(data);
        if (refusal) { void inform(entryRefusalInfo(refusal)); return; }
        if (data.url) {
          window.location.href = data.url;
        } else {
          setError(data.error ?? m.portalError);
        }
      } catch {
        setError(t.funnel.common.networkError);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxId]);

  return (
    <div className="min-h-screen bg-ax-background text-ax-text font-sans antialiased">
      {dialog}
      <LandingHeader variant="funnel" />
      <div className="flex items-center justify-center p-6 text-center">
      <div>
        {error ? (
          <>
            <p className="text-ax-danger text-sm font-bold">{error}</p>
            <a href="athlex://subscription" className="text-ax-text text-sm mt-4 inline-block">
              {t.funnel.common.backApp}
            </a>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-ax-card bg-ax-hover flex items-center justify-center">
              <Zap size={22} className="text-ax-text" />
            </div>
            <p className="text-ax-text-secondary text-sm">{m.redirecting}</p>
            <div className="w-6 h-6 border-2 border-ax-input-border border-t-ax-text rounded-full animate-spin" />
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
