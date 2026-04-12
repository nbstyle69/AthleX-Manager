'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Zap, Check, ChevronRight, CreditCard, Shield, Crown,
  Users, Dumbbell, CalendarClock, MessageSquare, Trophy,
  BarChart3, Bell, Award, Newspaper, FileText, Globe,
} from 'lucide-react';

const FEATURES = [
  { icon: Users,         text: 'Membres illimités' },
  { icon: Users,         text: 'Coachs illimités' },
  { icon: Dumbbell,      text: 'WODs publishing illimité' },
  { icon: CalendarClock, text: 'Horaires & Réservations' },
  { icon: MessageSquare, text: 'Groupes de messages illimités' },
  { icon: BarChart3,     text: 'Analytics box avancés' },
  { icon: FileText,      text: 'Export CSV' },
  { icon: Bell,          text: 'Push notifications custom' },
  { icon: Trophy,        text: 'Tournois & Compétitions' },
  { icon: Globe,         text: 'Référencement annuaire AthleX' },
  { icon: Award,         text: 'Gamification (badges, ELO)' },
  { icon: Newspaper,     text: 'Rapport mensuel auto' },
  { icon: Shield,        text: 'Support prioritaire' },
];

export default function PricingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#C9A227]/30 border-t-[#C9A227] rounded-full animate-spin" />
      </div>
    }>
      <PricingContent />
    </Suspense>
  );
}

function PricingContent() {
  const params = useSearchParams();
  const boxId = params.get('box_id');
  const [loading, setLoading] = useState(false);
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');

  async function handleSubscribe() {
    if (!boxId) {
      window.location.href = '/login';
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ box_id: boxId, billing }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? 'Erreur lors de la création de la session');
      }
    } catch {
      alert('Erreur réseau');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans antialiased">
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] bg-[#080808]/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/landing" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#C9A227]/20 flex items-center justify-center">
              <Zap size={15} className="text-[#C9A227]" />
            </div>
            <span className="text-base font-black tracking-tight">Athle<span className="text-[#C9A227]">X</span></span>
          </Link>
          <Link href="/login" className="flex items-center gap-1.5 bg-white/5 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">
            Se connecter
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-8 px-6 text-center">
        <div className="inline-flex items-center gap-2 bg-[#C9A227]/10 border border-[#C9A227]/20 rounded-full px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-[#C9A227] mb-6">
          <Crown size={11} /> Tarifs pour les box
        </div>
        <h1 className="text-4xl md:text-6xl font-black leading-tight tracking-tight mb-4">
          Un seul plan.<br /><span className="text-[#C9A227]">Tout inclus.</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-xl mx-auto">
          Pas de tiers, pas de surprises. Toutes les fonctionnalités pour gérer votre box, à un prix simple.
        </p>
      </section>

      {/* Billing toggle */}
      <div className="flex justify-center mb-10">
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-1.5 flex gap-1">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              billing === 'monthly' ? 'bg-[#C9A227] text-white' : 'text-gray-500 hover:text-white'
            }`}
          >
            Mensuel
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              billing === 'annual' ? 'bg-[#C9A227] text-white' : 'text-gray-500 hover:text-white'
            }`}
          >
            Annuel
            <span className="text-[10px] font-extrabold bg-green-500/20 text-green-400 border border-green-500/30 rounded px-1.5 py-0.5">
              -20%
            </span>
          </button>
        </div>
      </div>

      {/* Plan card */}
      <section className="px-6 pb-20">
        <div className="max-w-lg mx-auto">
          <div className="bg-[#111111] border-2 border-[#C9A227]/40 rounded-3xl overflow-hidden relative">
            {/* Glow */}
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-40 bg-[#C9A227]/8 rounded-full blur-3xl pointer-events-none" />

            <div className="relative p-8">
              {/* Header */}
              <div className="flex items-center gap-3 mb-2">
                <div className="w-11 h-11 rounded-2xl bg-[#C9A227]/15 flex items-center justify-center">
                  <Crown size={22} className="text-[#C9A227]" />
                </div>
                <div>
                  <h2 className="text-xl font-black">Plan Complet</h2>
                  <p className="text-xs text-gray-500">Toutes les fonctionnalités</p>
                </div>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-1 mt-6 mb-1">
                <span className="text-5xl font-black text-[#C9A227]">
                  {billing === 'monthly' ? '79€' : '62€'}
                </span>
                <span className="text-lg font-bold text-gray-500">/mois</span>
              </div>
              {billing === 'annual' && (
                <p className="text-sm text-gray-500">
                  Facturé <span className="text-white font-bold">749€/an</span> au lieu de 948€
                </p>
              )}
              {billing === 'monthly' && (
                <p className="text-sm text-gray-500">Sans engagement, résiliable à tout moment</p>
              )}

              {/* Trial badge */}
              <div className="mt-5 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
                <Zap size={16} className="text-green-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-green-400">Essai gratuit inclus</p>
                  <p className="text-xs text-gray-500">30 jours pour tester, aucune carte requise au départ</p>
                </div>
              </div>

              {/* Features */}
              <div className="mt-8 space-y-3">
                {FEATURES.map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-[#C9A227]/10 flex items-center justify-center shrink-0">
                      <Icon size={14} className="text-[#C9A227]" />
                    </div>
                    <span className="text-sm font-semibold text-gray-300">{text}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full mt-8 flex items-center justify-center gap-2 bg-[#C9A227] hover:bg-[#B8911F] disabled:opacity-50 text-white font-bold py-4 rounded-xl text-base transition-colors shadow-lg shadow-[#C9A227]/20"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <CreditCard size={18} />
                    {boxId ? 'Souscrire maintenant' : 'Créer ma box — Essai gratuit'}
                    <ChevronRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Trust */}
          <div className="flex flex-wrap justify-center gap-5 mt-8">
            {['Paiement sécurisé Stripe', 'Résiliable à tout moment', 'Données protégées', 'Support réactif'].map(p => (
              <div key={p} className="flex items-center gap-2 text-xs text-gray-600">
                <Check size={12} className="text-[#C9A227]" />{p}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Early adopter banner */}
      <section className="px-6 pb-20">
        <div className="max-w-lg mx-auto bg-[#111111] border border-[#C9A227]/20 rounded-2xl p-6 text-center">
          <span className="text-2xl">🏅</span>
          <h3 className="text-lg font-black mt-2">Offre Fondateur</h3>
          <p className="text-sm text-gray-400 mt-1">
            Les <strong className="text-white">5 premières boxes</strong> bénéficient de{' '}
            <strong className="text-[#C9A227]">60 jours d&apos;essai gratuit</strong> au lieu de 30.
          </p>
          <p className="text-xs text-gray-600 mt-3">
            + Badge &quot;Fondateur&quot; permanent dans l&apos;app
          </p>
        </div>
      </section>

      {/* FAQ mini */}
      <section className="px-6 pb-20">
        <div className="max-w-lg mx-auto space-y-4">
          <h3 className="text-xl font-black text-center mb-6">Questions fréquentes</h3>
          {[
            { q: 'Ai-je besoin d\'une carte bancaire pour l\'essai ?', a: 'Non. L\'essai gratuit commence immédiatement à la création de votre box, sans carte requise.' },
            { q: 'Que se passe-t-il à la fin de l\'essai ?', a: 'Votre back-office est verrouillé mais vos données sont conservées 30 jours. Souscrivez pour retrouver l\'accès.' },
            { q: 'Puis-je annuler à tout moment ?', a: 'Oui, sans engagement. Vous pouvez résilier depuis votre espace de facturation en un clic.' },
            { q: 'Y a-t-il des frais cachés ?', a: 'Non. Un seul plan, un seul prix. Pas de frais d\'installation, pas de coût par membre.' },
          ].map(({ q, a }) => (
            <div key={q} className="bg-[#111111] border border-white/8 rounded-xl p-5">
              <p className="text-sm font-bold text-white">{q}</p>
              <p className="text-sm text-gray-500 mt-2">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] bg-[#080808] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#C9A227]/20 flex items-center justify-center">
              <Zap size={13} className="text-[#C9A227]" />
            </div>
            <span className="text-sm font-black">Athle<span className="text-[#C9A227]">X</span></span>
          </div>
          <p className="text-[11px] text-gray-700">© 2026 AthleX. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
