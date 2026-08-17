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
    <div className="min-h-screen bg-background text-foreground font-sans antialiased">
      <Suspense fallback={null}>
        <SubscriptionVerifier />
      </Suspense>
      <LandingHeader variant="funnel" />
      <div className="flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Success icon */}
        <div className="w-20 h-20 rounded-3xl bg-green-500/15 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={40} className="text-green-400" />
        </div>

        <h1 className="text-3xl font-black mb-3">{s.title}</h1>
        <p className="text-muted-foreground text-base mb-8">{s.subtitle}</p>

        {/* Steps */}
        <div className="bg-card border border-border rounded-2xl p-6 text-left space-y-4 mb-8">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0 mt-0.5">
              <Smartphone size={16} className="text-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold">{s.step1Title}</p>
              <p className="text-xs text-gray-500 mt-1">{s.step1Desc}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-green-500/15 flex items-center justify-center shrink-0 mt-0.5">
              <Zap size={16} className="text-green-400" />
            </div>
            <div>
              <p className="text-sm font-bold">{s.step2Title}</p>
              <p className="text-xs text-gray-500 mt-1">{s.step2Desc}</p>
            </div>
          </div>
        </div>

        {/* Deep link to app */}
        <a
          href="athlex://subscription-success"
          className="w-full flex items-center justify-center gap-2 bg-white hover:bg-[#B8911F] text-[#0A0A0A] font-bold py-4 rounded-xl text-base transition-colors shadow-lg shadow-white/20 mb-4"
        >
          {s.openApp} <ChevronRight size={16} />
        </a>

        <Link
          href="/"
          className="w-full flex items-center justify-center gap-2 bg-white/5 border border-border text-foreground font-bold py-3.5 rounded-xl text-sm hover:bg-white/10 transition-colors mb-4"
        >
          {s.dashboard}
        </Link>

        <Link
          href="/landing"
          className="text-sm text-gray-500 hover:text-foreground transition-colors"
        >
          {t.funnel.common.backHome}
        </Link>
      </div>
      </div>
    </div>
  );
}
