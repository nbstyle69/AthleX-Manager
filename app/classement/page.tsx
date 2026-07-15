import type { Metadata } from 'next';
import { LandingHeader } from '@/components/landing/header';
import { LandingFooter } from '@/components/landing/footer';
import { getFullLeaderboard } from '@/lib/leaderboard';
import { ClassementView } from './ClassementView';
import { ClassementHeader } from './ClassementHeader';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Classement AthleX — athlètes & box par ELO',
  description:
    'Le classement complet des athlètes AthleX par ELO, avec recherche par pseudo, et le classement des box par ELO moyen.',
};

export default async function ClassementPage() {
  const { athletes, boxes } = await getFullLeaderboard();

  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      <LandingHeader />
      <main>
        <ClassementHeader />
        <ClassementView athletes={athletes} boxes={boxes} />
      </main>
      <LandingFooter />
    </div>
  );
}
