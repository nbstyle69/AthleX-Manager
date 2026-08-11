'use client';

import { useState } from 'react';
import { Loader2, AlertCircle, CheckCircle2, Apple, Smartphone, Mail, Building2 } from 'lucide-react';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/store-links';

export type InvitationPeek = {
  ok: true;
  email: string;
  first_name: string | null;
  last_name: string | null;
  payment_mode: 'box' | 'stripe';
  expires_at: string;
  box: { name: string; slug: string | null; city: string | null; logo_url: string | null };
  plan: {
    name: string;
    description: string | null;
    price_cents: number | null;
    currency: string | null;
    plan_type: string | null;
    max_sessions_per_week: number | null;
    commitment_months: number | null;
  } | null;
} | { ok: false; reason: string };

type Gender = 'male' | 'female';

function formatPrice(cents: number | null, currency: string | null) {
  if (cents == null) return null;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: (currency ?? 'EUR').toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export default function JoinInvitationClient({
  token,
  invitation,
  sessionEmail,
}: {
  token: string;
  invitation: Extract<InvitationPeek, { ok: true }>;
  sessionEmail: string | null;
}) {
  const suggested = (invitation.first_name ?? '').replace(/[^A-Za-z0-9_-]/g, '');
  const [username, setUsername] = useState(suggested);
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [cgu, setCgu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ finalUsername: string; pseudoChanged: boolean } | null>(null);

  const { box, plan } = invitation;
  const price = plan ? formatPrice(plan.price_cents, plan.currency) : null;
  // Le compte connecté est-il bien celui invité ? Le serveur retranche de toute
  // façon, ceci évite juste de proposer un bouton qui échouera.
  const sessionMatches = sessionEmail !== null && sessionEmail === invitation.email;

  async function submit(body: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...body }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? 'Impossible de rejoindre la box.');
        setLoading(false);
        return;
      }
      setDone({ finalUsername: json.finalUsername ?? '', pseudoChanged: !!json.pseudoChanged });
      setLoading(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur réseau.');
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Shell box={box}>
        <div className="text-center">
          <CheckCircle2 size={40} className="text-green-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-white">Bienvenue chez {box.name} 🎉</h2>
          <p className="text-sm text-gray-400 mt-2">
            {invitation.payment_mode === 'stripe'
              ? 'Ton compte est créé. Il ne reste qu’à régler ton abonnement pour activer ton accès.'
              : 'Ton compte est créé et rattaché à la box. Télécharge l’app pour réserver tes cours.'}
          </p>
          {done.pseudoChanged && done.finalUsername && (
            <p className="text-xs text-gray-500 mt-3">
              Le pseudo demandé était pris, le tien est devenu « {done.finalUsername} ». Tu pourras le
              changer dans l’app.
            </p>
          )}
          <div className="mt-6 flex flex-col gap-2">
            <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-white text-[#0A0A0A] font-bold py-3 rounded-xl text-sm">
              <Apple size={16} /> Télécharger sur l&apos;App Store
            </a>
            <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-white/10 border border-white/15 text-white font-bold py-3 rounded-xl text-sm">
              <Smartphone size={16} /> Disponible sur Google Play
            </a>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell box={box}>
      <h2 className="text-lg font-bold text-white">
        {invitation.first_name ? `${invitation.first_name}, rejoins ${box.name}` : `Rejoins ${box.name}`}
      </h2>
      <p className="text-sm text-gray-400 mt-1">
        {box.city ? `${box.city} · ` : ''}Invitation personnelle
      </p>

      {/* Ce que le gérant a préparé : lecture seule, rien n'est modifiable ici. */}
      <div className="mt-5 space-y-2">
        <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
          <Mail size={15} className="text-gray-500 shrink-0" />
          <span className="text-sm text-white truncate">{invitation.email}</span>
        </div>
        {plan && (
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-white">{plan.name}</span>
              {price && (
                <span className="text-sm font-bold text-white shrink-0">
                  {price}
                  {plan.plan_type === 'subscription' && <span className="text-xs text-gray-400"> /mois</span>}
                </span>
              )}
            </div>
            {plan.description && <p className="text-xs text-gray-400 mt-1">{plan.description}</p>}
            <p className="text-xs text-gray-500 mt-1.5">
              {plan.max_sessions_per_week
                ? `${plan.max_sessions_per_week} séance${plan.max_sessions_per_week > 1 ? 's' : ''} / semaine`
                : 'Accès illimité'}
              {plan.commitment_months ? ` · engagement ${plan.commitment_months} mois` : ''}
              {invitation.payment_mode === 'box' ? ' · réglé à la box' : ''}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mt-5">
          <AlertCircle size={15} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {sessionMatches ? (
        <div className="mt-5">
          <p className="text-sm text-gray-400">
            Tu es déjà connecté avec cette adresse — un clic suffit.
          </p>
          <button type="button" disabled={loading} onClick={() => submit({ mode: 'existing' })}
            className="w-full bg-white hover:bg-gray-200 disabled:opacity-60 text-[#0A0A0A] font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-3">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Rattachement…' : `Rejoindre ${box.name}`}
          </button>
        </div>
      ) : (
        <form
          className="space-y-4 mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!cgu) { setError('Tu dois accepter les CGU.'); return; }
            submit({ mode: 'signup', username, password, gender });
          }}
        >
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Pseudo</label>
            <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder="TonPseudo" autoCapitalize="none"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Mot de passe</label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Genre</label>
            <div className="flex gap-2">
              {(['male', 'female'] as Gender[]).map((g) => (
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
            <input type="checkbox" checked={cgu} onChange={(e) => setCgu(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-white" />
            <span>
              J&apos;accepte les{' '}
              <a href="/privacy" className="text-white underline">CGU &amp; la politique de confidentialité</a>.
            </span>
          </label>

          <button type="submit" disabled={loading || !cgu}
            className="w-full bg-white hover:bg-gray-200 disabled:opacity-60 text-[#0A0A0A] font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Création…' : 'Créer mon compte et rejoindre'}
          </button>
        </form>
      )}

      {sessionEmail && !sessionMatches && (
        <p className="text-xs text-gray-500 text-center mt-4">
          Tu es connecté avec une autre adresse. Cette invitation est nominative : déconnecte-toi pour
          l&apos;utiliser avec {invitation.email}.
        </p>
      )}
    </Shell>
  );
}

function Shell({
  box,
  children,
}: {
  box: { name: string; logo_url: string | null };
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6 gap-3">
          {box.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={box.logo_url} alt={box.name} className="w-16 h-16 rounded-2xl object-cover border border-white/10" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Building2 size={26} className="text-gray-500" />
            </div>
          )}
        </div>
        <div className="bg-[#111111] rounded-2xl border border-white/8 p-8">{children}</div>
        <p className="text-center text-xs text-gray-600 mt-5">Propulsé par AthleX</p>
      </div>
    </div>
  );
}
