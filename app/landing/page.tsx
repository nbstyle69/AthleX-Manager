import type { Metadata } from 'next';
import { LandingHeader } from '@/components/landing/header';
import { Hero } from '@/components/landing/hero';
import { Stats } from '@/components/landing/stats';
import { Features } from '@/components/landing/features';
import { Experiences } from '@/components/landing/experiences';
import { Steps } from '@/components/landing/steps';
import { AppShowcase } from '@/components/landing/app-showcase';
import { AthleteCta } from '@/components/landing/athlete-cta';
import { Pricing } from '@/components/landing/pricing';
import { FinalCta } from '@/components/landing/final-cta';
import { LandingFooter } from '@/components/landing/footer';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'AthleX — La plateforme tout-en-un pour votre box',
  description:
    'Gère, anime et développe ta box CrossFit / Hyrox : membres, réservations, WODs, tournois et communauté. Back office web + app mobile athlète.',
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      <LandingHeader />
      <main>
        <Hero />
        <Stats />
        <Features />
        <Experiences />
        <Steps />
        <AppShowcase />
        <AthleteCta />
        <Pricing />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
