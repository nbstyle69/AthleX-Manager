'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Audience = 'athlete' | 'box';

const COPY: Record<Audience, { subtitle: string; signupPrompt: string; signupCta: string; signupHref: string }> = {
  athlete: {
    subtitle: 'Connexion au compte athlète',
    signupPrompt: 'Pas encore de compte ?',
    signupCta: 'Créez votre compte athlète',
    signupHref: '/signup',
  },
  box: {
    subtitle: 'AthleX Manager · Gérant / Coach',
    signupPrompt: 'Pas encore de box ?',
    signupCta: 'Créez votre compte',
    signupHref: '/pricing/onboarding',
  },
};

/** Only same-origin relative paths are honoured, so `next` can't be an open redirect. */
function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

export default function LoginForm({ audience }: { audience: Audience }) {
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const copy = COPY[audience];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) { setError(authError.message); setLoading(false); return; }
      if (!data.session) { setError('Session non créée — vérifiez vos identifiants.'); setLoading(false); return; }

      const res = await fetch('/api/auth/set-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        }),
      });
      const json = await res.json();
      if (!json.ok) { setError('Erreur serveur: ' + json.error); setLoading(false); return; }

      if (next) { window.location.href = next; return; }

      // Check role to redirect super_admin to /admin
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', data.user.id).single();
      const role = profile?.role;
      if (role === 'super_admin' || role === 'admin') {
        window.location.href = '/admin';
        return;
      }

      // Owner (propriétaire ou co-owner) → back-office ; sinon athlète → espace compte.
      // Pas de box active au login : on cherche seulement s'il en existe une,
      // sans jamais supposer qu'il n'y en a qu'une (maybeSingle échoue à 2+).
      const { data: ownedBoxes } = await supabase
        .from('boxes').select('id').eq('owner_id', data.user.id).limit(1);
      let isOwner = (ownedBoxes ?? []).length > 0;
      if (!isOwner) {
        const { data: coOwner } = await supabase
          .from('box_members').select('id')
          .eq('member_id', data.user.id).eq('role', 'owner').eq('status', 'active').limit(1);
        isOwner = (coOwner ?? []).length > 0;
      }
      window.location.href = isOwner ? '/' : '/compte';
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur réseau.');
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto px-4">
      <Link
        href="/login"
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Changer de profil
      </Link>
      <div className="flex flex-col items-center mb-10 gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="AthleX" width={96} height={96} className="w-24 h-24 object-contain" />
        <div className="text-center">
          <p className="text-sm text-gray-400 font-medium">{copy.subtitle}</p>
        </div>
      </div>

      <div className="bg-[#111111] rounded-2xl border border-white/8 p-8">
        <h2 className="text-lg font-bold text-white mb-6">Connexion</h2>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5">
            <AlertCircle size={15} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder={audience === 'box' ? 'owner@mabox.com' : 'ton@email.com'}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Mot de passe</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-white hover:bg-white disabled:opacity-60 text-[#0A0A0A] font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className="text-sm text-gray-400 text-center mt-5">
          <Link href="/reset-password" className="text-white/70 hover:text-white hover:underline">
            Mot de passe oublié ?
          </Link>
        </p>

        <p className="text-sm text-gray-400 text-center mt-4">
          {copy.signupPrompt}{' '}
          <a href={copy.signupHref} className="text-white font-semibold hover:underline">
            {copy.signupCta}
          </a>
        </p>
      </div>
    </div>
  );
}
