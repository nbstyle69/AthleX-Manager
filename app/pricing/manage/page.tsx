'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Zap } from 'lucide-react';
import { LandingHeader } from '@/components/landing/header';
import { useLanguage } from '@/components/language-provider';

export default function ManageSubscriptionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
    <div className="min-h-screen bg-background text-foreground font-sans antialiased">
      <LandingHeader variant="funnel" />
      <div className="flex items-center justify-center p-6 text-center">
      <div>
        {error ? (
          <>
            <p className="text-red-400 text-sm font-bold">{error}</p>
            <a href="athlex://subscription" className="text-foreground text-sm mt-4 inline-block">
              {t.funnel.common.backApp}
            </a>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
              <Zap size={22} className="text-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">{m.redirecting}</p>
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
