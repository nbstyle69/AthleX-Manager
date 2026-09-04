'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';

/**
 * Atterrissage du lien « Confirm signup ». Aucune session n'est requise et
 * aucun formulaire n'est proposé : l'adresse est confirmée côté GoTrue avant
 * la redirection, il ne reste qu'à ouvrir l'app. Le fragment porté par l'URL
 * (jetons implicites) est effacé pour ne pas traîner dans l'historique.
 */
export default function EmailConfirmePage() {
  const { t } = useLanguage();
  const c = t.funnel.confirmed;

  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  return (
    <div className="w-full max-w-sm mx-auto px-4">
      <div className="flex flex-col items-center mb-10 gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="AthleX" width={96} height={96} className="w-24 h-24 object-contain" />
        <p className="text-sm text-muted-foreground font-medium">{c.header}</p>
      </div>

      <div className="bg-card rounded-2xl border border-border p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <MailCheck size={32} className="text-foreground" />
          <h2 className="text-lg font-bold text-foreground">{c.title}</h2>
          <p className="text-sm text-muted-foreground">{c.body}</p>
          <Link href="/landing" className="text-foreground font-semibold hover:underline text-sm">
            {t.funnel.common.backHome}
          </Link>
        </div>
      </div>
    </div>
  );
}
