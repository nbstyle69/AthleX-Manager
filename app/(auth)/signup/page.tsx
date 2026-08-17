'use client';

import { useState } from 'react';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { StoreBadges } from '@/components/store-badges';

type Gender = 'male' | 'female';

export default function SignupPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [cgu, setCgu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ needsConfirmation: boolean; finalUsername: string; pseudoChanged: boolean } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cgu) { setError('Tu dois accepter les CGU.'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, gender }),
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error ?? 'Erreur lors de la création du compte.'); setLoading(false); return; }
      setDone({ needsConfirmation: json.needsConfirmation, finalUsername: json.finalUsername, pseudoChanged: json.pseudoChanged });
      setLoading(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur réseau.');
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="w-full max-w-sm mx-auto px-4">
        <div className="bg-[#111111] rounded-2xl border border-white/8 p-8 text-center">
          <CheckCircle2 size={40} className="text-green-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-white">Compte créé 🎉</h2>
          {done.needsConfirmation ? (
            <p className="text-sm text-gray-400 mt-2">
              Un e-mail de confirmation a été envoyé à <span className="text-white">{email}</span>.
              Clique sur le lien pour activer ton compte, puis connecte-toi dans l&apos;app AthleX.
            </p>
          ) : (
            <p className="text-sm text-gray-400 mt-2">
              Ton compte <span className="text-white">{done.finalUsername}</span> est prêt. Télécharge l&apos;app pour t&apos;entraîner.
            </p>
          )}
          {done.pseudoChanged && (
            <p className="text-xs text-gray-500 mt-3">
              Le pseudo demandé était pris, le tien est devenu « {done.finalUsername} ». Tu pourras le changer dans l&apos;app.
            </p>
          )}
          <StoreBadges layout="stacked" className="mt-6" />
          <a href="/landing" className="block text-xs text-gray-500 hover:text-white mt-5">Retour à l&apos;accueil</a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm mx-auto px-4">
      <div className="flex flex-col items-center mb-8 gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/athex-mark-light.png" alt="AthleX" width={64} height={64} className="w-16 h-16 object-contain" />
        <div className="text-center">
          <h1 className="text-2xl font-black text-white tracking-tight">AthleX</h1>
          <p className="text-sm text-gray-400 font-medium mt-0.5">Crée ton compte athlète</p>
        </div>
      </div>

      <div className="bg-[#111111] rounded-2xl border border-white/8 p-8">
        <h2 className="text-lg font-bold text-white mb-6">Inscription</h2>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5">
            <AlertCircle size={15} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Pseudo</label>
            <input type="text" required value={username} onChange={e => setUsername(e.target.value)}
              placeholder="TonPseudo" autoCapitalize="none"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="ton@email.com" autoCapitalize="none"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Mot de passe</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" minLength={6}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Genre</label>
            <div className="flex gap-2">
              {(['male', 'female'] as Gender[]).map(g => (
                <button type="button" key={g} onClick={() => setGender(g)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                    gender === g ? 'bg-white text-[#0A0A0A] border-white' : 'bg-white/5 text-gray-300 border-white/10 hover:border-white/25'
                  }`}>
                  {g === 'male' ? '♂ Homme' : '♀ Femme'}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2.5 text-sm text-gray-400 pt-1">
            <input type="checkbox" checked={cgu} onChange={e => setCgu(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-white" />
            <span>
              J&apos;accepte les{' '}
              <a href="/privacy" className="text-white underline">CGU &amp; la politique de confidentialité</a>.
            </span>
          </label>

          <button type="submit" disabled={loading || !cgu}
            className="w-full bg-white hover:bg-gray-200 disabled:opacity-60 text-[#0A0A0A] font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>

        <p className="text-sm text-gray-400 text-center mt-6">
          Déjà un compte ?{' '}
          <a href="/login" className="text-white font-semibold hover:underline">Se connecter</a>
        </p>
      </div>
    </div>
  );
}
