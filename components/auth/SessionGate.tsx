'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Aligne la session du navigateur sur celle du serveur avant de rendre une page
 * du back-office.
 *
 * Sans cette porte, une page client peut lire pendant que le client navigateur
 * n'a aucune session : PostgREST répond à la clé anon, la RLS ferme tout, et
 * l'écran affiche une liste vide plausible. Le cas mesuré en prod : `/programming`
 * annonçait « Aucune box active » et « Vous n'avez pas encore publié de
 * programmation » à un gérant qui a une box et deux offres publiées.
 *
 * Deux règles, dans cet ordre :
 * - on ne rend rien avant que l'état de la session soit tranché (sinon la page
 *   lit avant l'hydratation, et c'est le même écran vide) ;
 * - un échec d'hydratation se dit. Il ne se déguise pas en « rien à afficher ».
 */
export default function SessionGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        if (!cancelled) setReady(true);
        return;
      }

      try {
        const res = await fetch('/api/auth/browser-session', { cache: 'no-store' });
        const json = (await res.json()) as {
          ok: boolean; access_token?: string; refresh_token?: string;
        };
        if (!res.ok || !json.ok || !json.access_token || !json.refresh_token) {
          throw new Error('session serveur absente');
        }
        const { error } = await supabase.auth.setSession({
          access_token: json.access_token,
          refresh_token: json.refresh_token,
        });
        if (error) throw error;
      } catch {
        if (!cancelled) setFailed(true);
      }

      if (!cancelled) setReady(true);
    })();

    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-ax-text-muted" />
      </div>
    );
  }

  return (
    <>
      {failed && (
        <div className="flex items-start gap-3 bg-ax-danger-soft border border-ax-danger rounded-ax-card px-4 py-3 mb-6">
          <AlertCircle size={16} className="text-ax-danger shrink-0 mt-0.5" />
          <p className="text-sm text-ax-danger">
            Ta session a expiré côté navigateur : les listes de cette page peuvent
            s&apos;afficher vides alors que les données existent.{' '}
            <a href="/login" className={cn(buttonVariants({ variant: 'ax-outline' }))}>Reconnecte-toi</a> pour la rétablir.
          </p>
        </div>
      )}
      {children}
    </>
  );
}
