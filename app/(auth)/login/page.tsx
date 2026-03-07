'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Trophy, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        alert('ERREUR: ' + error.message);
        setError(error.message);
        setLoading(false);
        return;
      }
      if (!data.session) {
        alert('PAS DE SESSION - email non confirmé');
        setError('Session non créée — email non confirmé ou mot de passe incorrect.');
        setLoading(false);
        return;
      }
      alert('OK SESSION: ' + data.session.user.email);
      window.location.href = '/';
    } catch (err: any) {
      setError(err?.message ?? 'Erreur réseau — vérifiez les variables Supabase.');
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto px-4">
      {/* Logo */}
      <div className="flex flex-col items-center mb-10 gap-3">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center">
          <Trophy className="text-white" size={28} />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black text-white tracking-tight">BattleWOD</h1>
          <p className="text-sm text-gray-400 font-medium mt-0.5">Back Office Box Owner</p>
        </div>
      </div>

      {/* Card */}
      <div className="bg-[#16162A] rounded-2xl border border-white/8 p-8">
        <h2 className="text-lg font-bold text-white mb-6">Connexion</h2>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5">
            <AlertCircle size={15} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
              Email
            </label>
            <input
              type="email" required value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="owner@mabox.com"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
              Mot de passe
            </label>
            <input
              type="password" required value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className="text-xs text-gray-600 text-center mt-6">
          Accès réservé aux propriétaires de box.<br />
          Contactez l&apos;équipe BattleWOD pour créer un compte.
        </p>
      </div>
    </div>
  );
}
