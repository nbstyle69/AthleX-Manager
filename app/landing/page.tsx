import type { Metadata } from 'next';
import { LandingHeader } from '@/components/landing/header';
import { Hero } from '@/components/landing/hero';
import { Stats } from '@/components/landing/stats';
import { Features } from '@/components/landing/features';
import { Experiences } from '@/components/landing/experiences';
import { Steps } from '@/components/landing/steps';
import { AppShowcase } from '@/components/landing/app-showcase';
import { Leaderboard } from '@/components/landing/leaderboard';
import { Pricing } from '@/components/landing/pricing';
import { FinalCta } from '@/components/landing/final-cta';
import { LandingFooter } from '@/components/landing/footer';
import { getLeaderboards } from '@/lib/leaderboard';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'AthleX — La plateforme tout-en-un pour votre box',
  description:
    'Gère, anime et développe ta box CrossFit / Hyrox : membres, réservations, WODs, tournois et communauté. Back office web + app mobile athlète.',
};

export default async function LandingPage() {
  const { athletes, boxes } = await getLeaderboards();
  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      <LandingHeader />
      <main>
        <Hero />
        <Stats />
        <Features />
        <Experiences />
        <Leaderboard athletes={athletes} boxes={boxes} />
        <Steps />
        <AppShowcase />
        <Pricing />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
