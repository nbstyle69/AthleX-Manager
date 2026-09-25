'use client';

import Link from 'next/link';
import { LandingHeader } from '@/components/landing/header';
import { useLanguage } from '@/components/language-provider';

/**
 * Fiche publique d'une box archivée ou en archivage programmé (PR 3) : un état
 * propre, sans formulaire ni bouton d'achat. Même texte que la base et l'app.
 */
export default function ClosedBoxNotice({ name }: { name: string }) {
  const { t } = useLanguage();
  const j = t.funnel.join;
  return (
    <div className="min-h-screen bg-ax-background font-sans text-ax-text antialiased">
      <LandingHeader variant="funnel" />
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm bg-ax-surface rounded-ax-card border border-ax-border p-8 text-center" data-testid="box-fermee">
          <h1 className="text-lg font-bold text-ax-text break-words">{name}</h1>
          <p className="text-sm text-ax-text-secondary mt-2">{j.refused.box_archivage_programme}</p>
          <Link href="/box" className="inline-block mt-5 text-sm text-ax-text font-semibold hover:underline">
            {j.refusedDirectory}
          </Link>
        </div>
      </div>
    </div>
  );
}
