'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Phase = 'checking' | 'ready' | 'invalid' | 'done';

export default function UpdatePasswordPage() {
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

  // The recovery link lands here with a token. GoTrue's verify redirect uses an
  // implicit hash (#access_token=…&type=recovery); the web-initiated flow may
  // instead use a PKCE ?code=. Consume whichever is present and open a session
  // so updateUser() can set the new password.
  useEffect(() => {
    (async () => {
      try {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const query = new URLSearchParams(window.location.search);

        if (hash.get('error') || query.get('error')) {
          setError(hash.get('error_description') || query.get('error_description') || 'Lien invalide ou expiré.');
          setPhase('invalid');
          return;
        }

        const accessToken = hash.get('access_token');
        const refreshToken = hash.get('refresh_token');
        const code = query.get('code');

        if (accessToken && refreshToken) {
          const { error: e } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (e) throw e;
          window.history.replaceState(null, '', window.location.pathname);
          setPhase('ready');
          return;
        }

        if (code) {
          const { error: e } = await supabase.auth.exchangeCodeForSession(code);
          if (e) throw e;
          window.history.replaceState(null, '', window.location.pathname);
          setPhase('ready');
          return;
        }

        // No token in the URL but maybe detectSessionInUrl already stored one.
        const { data } = await supabase.auth.getSession();
        setPhase(data.session ? 'ready' : 'invalid');
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Lien invalide ou expiré.');
        setPhase('invalid');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    if (password !== confirm) { setError('Les deux mots de passe ne correspondent pas.'); return; }
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) { setError(authError.message); setLoading(false); return; }
      // Sign out so the recovery session isn't left lingering; user logs in fresh.
      await supabase.auth.signOut();
      setPhase('done');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur réseau.');
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto px-4">
      <div className="flex flex-col items-center mb-10 gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="AthleX" width={96} height={96} className="w-24 h-24 object-contain" />
        <p className="text-sm text-gray-400 font-medium">Nouveau mot de passe</p>
      </div>

      <div className="bg-[#111111] rounded-2xl border border-white/8 p-8">
        {phase === 'checking' && (
          <div className="flex items-center justify-center gap-2 text-gray-400 py-4">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Vérification du lien…</span>
          </div>
        )}

        {phase === 'invalid' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle size={32} className="text-red-400" />
            <h2 className="text-lg font-bold text-white">Lien invalide ou expiré</h2>
            <p className="text-sm text-gray-400">{error ?? 'Ce lien de réinitialisation n\'est plus valide.'}</p>
            <Link href="/reset-password" className="text-white font-semibold hover:underline text-sm">
              Demander un nouveau lien
            </Link>
          </div>
        )}

        {phase === 'done' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle2 size={32} className="text-white" />
            <h2 className="text-lg font-bold text-white">Mot de passe mis à jour</h2>
            <p className="text-sm text-gray-400">
              Tu peux maintenant te connecter avec ton nouveau mot de passe, dans l&apos;application ou sur le web.
            </p>
            <Link href="/login" className="w-full bg-white text-[#0A0A0A] font-bold py-3 rounded-xl text-center transition-colors">
              Se connecter
            </Link>
          </div>
        )}

        {phase === 'ready' && (
          <>
            <h2 className="text-lg font-bold text-white mb-6">Choisis un nouveau mot de passe</h2>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5">
                <AlertCircle size={15} className="text-red-400 shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Nouveau mot de passe</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Confirmer</label>
                <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-white hover:bg-white disabled:opacity-60 text-[#0A0A0A] font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2">
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? 'Mise à jour…' : 'Mettre à jour'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
