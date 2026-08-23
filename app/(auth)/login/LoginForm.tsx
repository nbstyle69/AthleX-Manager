'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/components/language-provider';
import { postLoginPath } from '@/lib/authz/post-login';
import type { BoxRole } from '@/lib/authz/coach-perimeter';

type Audience = 'athlete' | 'box';

const SIGNUP_HREF: Record<Audience, string> = {
  athlete: '/signup',
  box: '/pricing/onboarding',
};

/** Only same-origin relative paths are honoured, so `next` can't be an open redirect. */
function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

export default function LoginForm({ audience }: { audience: Audience }) {
  const { t } = useLanguage();
  const l = t.funnel.login;
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const copy =
    audience === 'box'
      ? { subtitle: l.ownerSubtitle, signupPrompt: l.ownerPrompt, signupCta: l.ownerCta }
      : { subtitle: l.athleteSubtitle, signupPrompt: l.athletePrompt, signupCta: l.athleteCta };
  const signupHref = SIGNUP_HREF[audience];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) { setError(authError.message); setLoading(false); return; }
      if (!data.session) { setError(l.sessionMissing); setLoading(false); return; }

      const res = await fetch('/api/auth/set-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        }),
      });
      const json = await res.json();
      if (!json.ok) { setError(l.serverError + json.error); setLoading(false); return; }

      if (next) { window.location.href = next; return; }

      // Check role to redirect super_admin to /admin
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', data.user.id).single();
      const role = profile?.role;
      if (role === 'super_admin' || role === 'admin') {
        window.location.href = '/admin';
        return;
      }

      // La destination suit le titre prononcé par le serveur. Refaire « qui est
      // staff » ici avait envoyé les coachs dans l'espace athlète : la barre
      // latérale leur ouvrait un back-office qu'aucun lien n'atteignait.
      const { data: boxes, error: boxesError } = await supabase.rpc('get_my_admin_boxes');
      if (boxesError) { setError(l.serverError + boxesError.message); setLoading(false); return; }
      window.location.href = postLoginPath((boxes ?? []) as { my_role: BoxRole }[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.funnel.common.networkError);
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto px-4">
      <Link
        href="/login"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        {l.switchProfile}
      </Link>
      <div className="flex flex-col items-center mb-10 gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="AthleX" width={96} height={96} className="w-24 h-24 object-contain" />
        <div className="text-center">
          <p className="text-sm text-muted-foreground font-medium">{copy.subtitle}</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border p-8">
        <h2 className="text-lg font-bold text-foreground mb-6">{l.title}</h2>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5">
            <AlertCircle size={15} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">{t.funnel.common.email}</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder={audience === 'box' ? t.funnel.common.ownerEmailPlaceholder : t.funnel.common.emailPlaceholder}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">{t.funnel.common.password}</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-white hover:bg-white disabled:opacity-60 text-[#0A0A0A] font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? l.submitting : l.submit}
          </button>
        </form>

        <p className="text-sm text-muted-foreground text-center mt-5">
          <Link href="/reset-password" className="text-white/70 hover:text-white hover:underline">
            {l.forgot}
          </Link>
        </p>

        <p className="text-sm text-muted-foreground text-center mt-4">
          {copy.signupPrompt}{' '}
          <a href={signupHref} className="text-foreground font-semibold hover:underline">
            {copy.signupCta}
          </a>
        </p>
      </div>
    </div>
  );
}
