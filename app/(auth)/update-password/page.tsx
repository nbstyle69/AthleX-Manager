'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { isRecoveryError } from '@/lib/auth/recovery';
import { useLanguage } from '@/components/language-provider';

type Phase = 'checking' | 'ready' | 'invalid' | 'done';

export default function UpdatePasswordPage() {
  const { t } = useLanguage();
  const u = t.funnel.update;
  const [phase, setPhase] = useState<Phase>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A single client instance for the whole recovery flow: the session opened
  // when consuming the link must be the one that updateUser() runs against.
  const clientRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (clientRef.current === null) clientRef.current = createClient();
  const supabase = clientRef.current;

  // La session de récupération est déjà ouverte quand on arrive ici : elle a
  // été posée dans les cookies par `/auth/confirm`, qui a vérifié le
  // `token_hash` du lien côté serveur. La page ne consomme donc aucun jeton
  // d'URL — c'est ce qui permet d'ouvrir le lien depuis un autre navigateur
  // que celui de la demande. Sans session : lien expiré, déjà utilisé, ou
  // incomplet, et on le dit dans la langue du visiteur.
  useEffect(() => {
    (async () => {
      const reason = new URLSearchParams(window.location.search).get('error');
      if (reason) {
        setError(isRecoveryError(reason) ? u.errors[reason] : u.invalidFallback);
        setPhase('invalid');
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setPhase('ready');
        return;
      }
      setError(u.errors.expired);
      setPhase('invalid');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError(u.tooShort); return; }
    if (password !== confirm) { setError(u.mismatch); return; }
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) { setError(authError.message); setLoading(false); return; }
      // La session de récupération ne doit pas survivre au changement : on la
      // ferme des deux côtés (navigateur et cookies serveur), l'utilisateur se
      // reconnecte avec son nouveau mot de passe.
      await supabase.auth.signOut();
      await fetch('/api/auth/clear-session', { method: 'POST' }).catch(() => {});
      setPhase('done');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.funnel.common.networkError);
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto px-4">
      <div className="flex flex-col items-center mb-10 gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="AthleX" width={96} height={96} className="w-24 h-24 object-contain" />
        <p className="text-sm text-muted-foreground font-medium">{u.header}</p>
      </div>

      <div className="bg-card rounded-2xl border border-border p-8">
        {phase === 'checking' && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground py-4">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">{u.checking}</span>
          </div>
        )}

        {phase === 'invalid' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle size={32} className="text-red-400" />
            <h2 className="text-lg font-bold text-foreground">{u.invalidTitle}</h2>
            <p className="text-sm text-muted-foreground">{error ?? u.invalidFallback}</p>
            <Link href="/reset-password" className="text-foreground font-semibold hover:underline text-sm">
              {u.requestNew}
            </Link>
          </div>
        )}

        {phase === 'done' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle2 size={32} className="text-foreground" />
            <h2 className="text-lg font-bold text-foreground">{u.doneTitle}</h2>
            <p className="text-sm text-muted-foreground">{u.doneBody}</p>
            <Link href="/login" className="w-full bg-white text-[#0A0A0A] font-bold py-3 rounded-xl text-center transition-colors">
              {t.funnel.common.login}
            </Link>
          </div>
        )}

        {phase === 'ready' && (
          <>
            <h2 className="text-lg font-bold text-foreground mb-6">{u.title}</h2>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5">
                <AlertCircle size={15} className="text-red-400 shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">{u.newPassword}</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">{u.confirm}</label>
                <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-white hover:bg-white disabled:opacity-60 text-[#0A0A0A] font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2">
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? u.submitting : u.submit}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
