'use client';

import Link from 'next/link';
import { LandingHeader } from '@/components/landing/header';
import { useLanguage } from '@/components/language-provider';

/**
 * État de refus d'une invitation. Le motif vient du serveur sous forme de clé
 * (`invitation_expiree`, …) ; la phrase montrée est celle de la langue choisie.
 */
export default function InvitationUnavailable({ reason }: { reason: string }) {
  const { t } = useLanguage();
  const j = t.funnel.join;
  const known = Object.keys(j.refused).includes(reason)
    ? j.refused[reason as keyof typeof j.refused]
    : null;

  return (
    <div className="min-h-screen bg-ax-background font-sans text-ax-text antialiased">
      <LandingHeader variant="funnel" />
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm bg-ax-surface rounded-ax-card border border-ax-border p-8 text-center">
          <h1 className="text-lg font-bold text-ax-text">{j.refusedTitle}</h1>
          <p className="text-sm text-ax-text-secondary mt-2">{known ?? j.refusedFallback}</p>
          <p className="text-xs text-ax-text-muted mt-4">{j.refusedHint}</p>
          <Link
            href="/box"
            className="inline-block mt-5 text-sm text-ax-text font-semibold hover:underline"
          >
            {j.refusedDirectory}
          </Link>
        </div>
      </div>
    </div>
  );
}
