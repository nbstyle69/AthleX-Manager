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
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      <LandingHeader variant="funnel" />
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm bg-card rounded-2xl border border-border p-8 text-center">
          <h1 className="text-lg font-bold text-foreground">{j.refusedTitle}</h1>
          <p className="text-sm text-muted-foreground mt-2">{known ?? j.refusedFallback}</p>
          <p className="text-xs text-gray-500 mt-4">{j.refusedHint}</p>
          <Link
            href="/box"
            className="inline-block mt-5 text-sm text-foreground font-semibold hover:underline"
          >
            {j.refusedDirectory}
          </Link>
        </div>
      </div>
    </div>
  );
}
