'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Zap, Smartphone, ChevronRight } from 'lucide-react';
import { LandingHeader } from '@/components/landing/header';
import { useLanguage } from '@/components/language-provider';

function SubscriptionVerifier() {
  const searchParams = useSearchParams();
  const boxId = searchParams.get('box_id');

  useEffect(() => {
    if (!boxId) return;
    fetch('/api/verify-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ box_id: boxId }),
    })
      .then(r => r.json())
      .then(data => console.log('Subscription verified:', data))
      .catch(() => {});
  }, [boxId]);

  return null;
}

export default function SubscriptionSuccessPage() {
  const { t } = useLanguage();
  const s = t.funnel.success;
  return (
    <div className="min-h-screen bg-ax-background text-ax-text font-sans antialiased">
      <Suspense fallback={null}>
        <SubscriptionVerifier />
      </Suspense>
      <LandingHeader variant="funnel" />
      <div className="flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Success icon */}
        <div className="w-20 h-20 rounded-ax-panel bg-ax-success-soft flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={40} className="text-ax-success" />
        </div>

        <h1 className="text-3xl font-black mb-3">{s.title}</h1>
        <p className="text-ax-text-secondary text-base mb-8">{s.subtitle}</p>

        {/* Steps */}
        <div className="bg-ax-surface border border-ax-border rounded-ax-card p-6 text-left space-y-4 mb-8">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-ax-control bg-ax-hover flex items-center justify-center shrink-0 mt-0.5">
              <Smartphone size={16} className="text-ax-text" />
            </div>
            <div>
              <p className="text-sm font-bold">{s.step1Title}</p>
              <p className="text-xs text-ax-text-muted mt-1">{s.step1Desc}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-ax-control bg-ax-success-soft flex items-center justify-center shrink-0 mt-0.5">
              <Zap size={16} className="text-ax-success" />
            </div>
            <div>
              <p className="text-sm font-bold">{s.step2Title}</p>
              <p className="text-xs text-ax-text-muted mt-1">{s.step2Desc}</p>
            </div>
          </div>
        </div>

        {/* Deep link to app */}
        <a
          href="athlex://subscription-success"
          className="w-full flex items-center justify-center gap-2 bg-ax-text hover:brightness-110 text-ax-background font-bold py-4 rounded-ax-control text-base transition-colors shadow-lg  mb-4"
        >
          {s.openApp} <ChevronRight size={16} />
        </a>

        <Link
          href="/"
          className="w-full flex items-center justify-center gap-2 bg-ax-hover border border-ax-border text-ax-text font-bold py-3.5 rounded-ax-control text-sm hover:border-ax-input-border transition-colors mb-4"
        >
          {s.dashboard}
        </Link>

        <Link
          href="/landing"
          className="text-sm text-ax-text-muted hover:text-ax-text transition-colors"
        >
          {t.funnel.common.backHome}
        </Link>
      </div>
      </div>
    </div>
  );
}
