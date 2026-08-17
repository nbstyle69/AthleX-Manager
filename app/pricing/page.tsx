'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Zap, Check, ChevronRight, CreditCard, Shield, Crown,
  Users, Dumbbell, CalendarClock, MessageSquare, Trophy,
  BarChart3, Bell, Award, Newspaper, FileText, Globe,
} from 'lucide-react';
import { LandingHeader } from '@/components/landing/header';
import { useLanguage } from '@/components/language-provider';

// Ordre aligné sur t.funnel.pricing.features : l'icône suit la position, le
// libellé vient de la traduction.
const FEATURE_ICONS = [
  Users, Users, Dumbbell, CalendarClock, MessageSquare, BarChart3, FileText,
  Bell, Trophy, Globe, Award, Newspaper, Shield,
];

export default function PricingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <PricingContent />
    </Suspense>
  );
}

function PricingContent() {
  const { t } = useLanguage();
  const p = t.funnel.pricing;
  const params = useSearchParams();
  const boxId = params.get('box_id');
  const [loading, setLoading] = useState(false);
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');

  async function handleSubscribe() {
    if (!boxId) {
      window.location.href = '/pricing/onboarding';
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ box_id: boxId, billing }),
      });
      if (res.status === 401) {
        // Souvent le cas quand la page est ouverte depuis l'app mobile : pas de
        // session web. On renvoie vers la connexion puis on revient ici.
        window.location.href = `/login/box?next=${encodeURIComponent(`/pricing?box_id=${boxId}`)}`;
        return;
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? p.checkoutError);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t.funnel.common.networkError);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased">
      <LandingHeader />

      {/* Hero */}
      <section className="pt-16 pb-8 px-6 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-foreground mb-6">
          <Crown size={11} /> {p.badge}
        </div>
        <h1 className="text-4xl md:text-6xl font-black leading-tight tracking-tight mb-4">
          {p.titleLine1}<br />{p.titleLine2}
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">{p.subtitle}</p>
      </section>

      {/* Billing toggle */}
      <div className="flex justify-center mb-10">
        <div className="bg-card border border-border rounded-2xl p-1.5 flex gap-1">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              billing === 'monthly' ? 'bg-white text-[#0A0A0A]' : 'text-gray-500 hover:text-foreground'
            }`}
          >
            {p.monthly}
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              billing === 'annual' ? 'bg-white text-[#0A0A0A]' : 'text-gray-500 hover:text-foreground'
            }`}
          >
            {p.annual}
            <span className="text-[10px] font-extrabold bg-green-500/20 text-green-400 border border-green-500/30 rounded px-1.5 py-0.5">
              -20%
            </span>
          </button>
        </div>
      </div>

      {/* Plan card */}
      <section className="px-6 pb-20">
        <div className="max-w-lg mx-auto">
          <div className="bg-card border-2 border-white/40 rounded-3xl overflow-hidden relative">
            {/* Glow */}
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-40 bg-white/8 rounded-full blur-3xl pointer-events-none" />

            <div className="relative p-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
                  <Crown size={22} className="text-foreground" />
                </div>
                <div>
                  <h2 className="text-xl font-black">{p.planName}</h2>
                  <p className="text-xs text-gray-500">{p.planDesc}</p>
                </div>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-1 mt-6 mb-1">
                <span className="text-5xl font-black text-foreground">
                  {billing === 'monthly' ? p.priceMonthly : p.priceAnnual}
                </span>
                <span className="text-lg font-bold text-gray-500">{p.perMonth}</span>
              </div>
              {billing === 'annual' && (
                <p className="text-sm text-gray-500">
                  {p.annualBilledBefore}
                  <span className="text-foreground font-bold">{p.annualBilledAmount}</span>
                  {p.annualBilledAfter}
                </p>
              )}
              {billing === 'monthly' && (
                <p className="text-sm text-gray-500">{p.noCommitment}</p>
              )}

              {/* Trial badge */}
              <div className="mt-5 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
                <Zap size={16} className="text-green-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-green-400">{p.trialTitle}</p>
                  <p className="text-xs text-gray-500">{p.trialDesc}</p>
                </div>
              </div>

              {/* Features */}
              <div className="mt-8 space-y-3">
                {p.features.map((text, i) => {
                  const Icon = FEATURE_ICONS[i] ?? Check;
                  return (
                    <div key={text} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                        <Icon size={14} className="text-foreground" />
                      </div>
                      <span className="text-sm font-semibold text-gray-300">{text}</span>
                    </div>
                  );
                })}
              </div>

              {/* CTA */}
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full mt-8 flex items-center justify-center gap-2 bg-white hover:bg-gray-200 disabled:opacity-50 text-[#0A0A0A] font-bold py-4 rounded-xl text-base transition-colors shadow-lg shadow-white/20"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <CreditCard size={18} />
                    {boxId ? p.subscribeCta : p.createCta}
                    <ChevronRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Trust */}
          <div className="flex flex-wrap justify-center gap-5 mt-8">
            {p.trust.map((label) => (
              <div key={label} className="flex items-center gap-2 text-xs text-gray-600">
                <Check size={12} className="text-foreground" />{label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Early adopter banner */}
      <section className="px-6 pb-20">
        <div className="max-w-lg mx-auto bg-card border border-white/20 rounded-2xl p-6 text-center">
          <span className="text-2xl">🏅</span>
          <h3 className="text-lg font-black mt-2">{p.founderTitle}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {p.founderBefore}
            <strong className="text-foreground">{p.founderBoxes}</strong>
            {p.founderMiddle}
            <strong className="text-foreground">{p.founderTrial}</strong>
            {p.founderAfter}
          </p>
          <p className="text-xs text-gray-600 mt-3">{p.founderBadge}</p>
        </div>
      </section>

      {/* FAQ mini */}
      <section className="px-6 pb-20">
        <div className="max-w-lg mx-auto space-y-4">
          <h3 className="text-xl font-black text-center mb-6">{p.faqTitle}</h3>
          {p.faq.map(({ q, a }) => (
            <div key={q} className="bg-card border border-border rounded-xl p-5">
              <p className="text-sm font-bold text-foreground">{q}</p>
              <p className="text-sm text-gray-500 mt-2">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
              <Zap size={13} className="text-foreground" />
            </div>
            <span className="text-sm font-black">AthleX</span>
          </div>
          <p className="text-[11px] text-gray-700">{p.rights}</p>
        </div>
      </footer>
    </div>
  );
}
