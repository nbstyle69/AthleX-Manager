'use client';

import { useState } from 'react';
import { Loader2, AlertCircle, CheckCircle2, Mail, Building2, CreditCard } from 'lucide-react';
import { LandingHeader } from '@/components/landing/header';
import { useLanguage } from '@/components/language-provider';
import { StoreBadges } from '@/components/store-badges';

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

function formatPrice(cents: number | null, currency: string | null, locale: string) {
  if (cents == null) return null;
  return new Intl.NumberFormat(locale, {
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
  const { lang, t } = useLanguage();
  const j = t.funnel.join;
  const suggested = (invitation.first_name ?? '').replace(/[^A-Za-z0-9_-]/g, '');
  const [username, setUsername] = useState(suggested);
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [cgu, setCgu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ finalUsername: string; pseudoChanged: boolean } | null>(null);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const { box, plan } = invitation;
  const price = plan ? formatPrice(plan.price_cents, plan.currency, lang === 'en' ? 'en-GB' : 'fr-FR') : null;
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
        setError(json.error ?? j.failed);
        setLoading(false);
        return;
      }
      setDone({ finalUsername: json.finalUsername ?? '', pseudoChanged: !!json.pseudoChanged });
      setLoading(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.funnel.common.networkError);
      setLoading(false);
    }
  }

  // Mode Stripe : le compte existe, l'accès non. Le Checkout est ouvert sur le
  // compte connecté de la box, et c'est le webhook — jamais ce retour de
  // navigateur — qui activera l'adhésion.
  async function pay() {
    setPayLoading(true);
    setPayError(null);
    try {
      const res = await fetch('/api/create-membership-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitation_token: token }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setPayError(json.error ?? j.payUnavailable);
        setPayLoading(false);
        return;
      }
      window.location.href = json.url;
    } catch (err: unknown) {
      setPayError(err instanceof Error ? err.message : t.funnel.common.networkError);
      setPayLoading(false);
    }
  }

  if (done) {
    return (
      <Shell box={box}>
        <div className="text-center">
          <CheckCircle2 size={40} className="text-green-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-foreground">
            {j.welcomeTitle}
            {box.name} 🎉
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            {invitation.payment_mode === 'stripe' ? j.welcomeStripe : j.welcomeBox}
          </p>
          {done.pseudoChanged && done.finalUsername && (
            <p className="text-xs text-gray-500 mt-3">
              {t.funnel.signup.pseudoTakenBefore}
              {done.finalUsername}
              {t.funnel.signup.pseudoTakenAfter}
            </p>
          )}
          {invitation.payment_mode === 'stripe' && (
            <div className="mt-5">
              <button type="button" disabled={payLoading} onClick={pay}
                className="w-full bg-white hover:bg-gray-200 disabled:opacity-60 text-[#0A0A0A] font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                {payLoading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                {payLoading ? j.payOpening : j.payCta}
              </button>
              <p className="text-xs text-gray-500 mt-2">{j.payHint}</p>
              {payError && <p className="text-xs text-red-400 mt-2">{payError}</p>}
            </div>
          )}

          <StoreBadges layout="stacked" className="mt-6" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell box={box}>
      <h2 className="text-lg font-bold text-foreground">
        {invitation.first_name
          ? `${invitation.first_name}${j.titleWithName}${box.name}`
          : `${j.title}${box.name}`}
      </h2>
      <p className="text-sm text-muted-foreground mt-1">
        {box.city ? `${box.city} · ` : ''}
        {j.badge}
      </p>

      {/* Ce que le gérant a préparé : lecture seule, rien n'est modifiable ici. */}
      <div className="mt-5 space-y-2">
        <div className="flex items-center gap-2.5 bg-white/5 border border-border rounded-xl px-4 py-3">
          <Mail size={15} className="text-gray-500 shrink-0" />
          <span className="text-sm text-foreground truncate">{invitation.email}</span>
        </div>
        {plan && (
          <div className="bg-white/5 border border-border rounded-xl px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-foreground">{plan.name}</span>
              {price && (
                <span className="text-sm font-bold text-foreground shrink-0">
                  {price}
                  {plan.plan_type === 'subscription' && (
                    <span className="text-xs text-muted-foreground">{j.perMonth}</span>
                  )}
                </span>
              )}
            </div>
            {plan.description && <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>}
            <p className="text-xs text-gray-500 mt-1.5">
              {plan.max_sessions_per_week
                ? `${plan.max_sessions_per_week}${plan.max_sessions_per_week > 1 ? j.sessionsPerWeek : j.sessionPerWeek}`
                : j.unlimited}
              {plan.commitment_months
                ? `${j.commitment}${plan.commitment_months}${j.commitmentMonths}`
                : ''}
              {invitation.payment_mode === 'box' ? j.paidAtBox : ''}
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
          <p className="text-sm text-muted-foreground">{j.alreadySignedIn}</p>
          <button type="button" disabled={loading} onClick={() => submit({ mode: 'existing' })}
            className="w-full bg-white hover:bg-gray-200 disabled:opacity-60 text-[#0A0A0A] font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-3">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? j.joining : `${j.joinCta}${box.name}`}
          </button>
        </div>
      ) : (
        <form
          className="space-y-4 mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!cgu) { setError(t.funnel.signup.cguRequired); return; }
            submit({ mode: 'signup', username, password, gender });
          }}
        >
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
              {t.funnel.signup.username}
            </label>
            <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder={t.funnel.signup.usernamePlaceholder} autoCapitalize="none"
              className="w-full bg-white/5 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-gray-600 focus:outline-none focus:border-foreground transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
              {t.funnel.common.password}
            </label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white/5 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-gray-600 focus:outline-none focus:border-foreground transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
              {t.funnel.signup.gender}
            </label>
            <div className="flex gap-2">
              {(['male', 'female'] as Gender[]).map((g) => (
                <button type="button" key={g} onClick={() => setGender(g)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                    gender === g ? 'bg-white text-[#0A0A0A] border-white' : 'bg-white/5 text-gray-300 border-border hover:border-white/25'
                  }`}>
                  {g === 'male' ? t.funnel.signup.male : t.funnel.signup.female}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2.5 text-sm text-muted-foreground pt-1">
            <input type="checkbox" checked={cgu} onChange={(e) => setCgu(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-white" />
            <span>
              {t.funnel.signup.cguPrefix}
              <a href="/privacy" className="text-foreground underline">{t.funnel.signup.cguLink}</a>.
            </span>
          </label>

          <button type="submit" disabled={loading || !cgu}
            className="w-full bg-white hover:bg-gray-200 disabled:opacity-60 text-[#0A0A0A] font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? j.signingUp : j.signupCta}
          </button>
        </form>
      )}

      {sessionEmail && !sessionMatches && (
        <p className="text-xs text-gray-500 text-center mt-4">
          {j.otherAccountBefore}
          {invitation.email}
          {j.otherAccountAfter}
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
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      <LandingHeader variant="funnel" />
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-6 gap-3">
            {box.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={box.logo_url} alt={box.name} className="w-16 h-16 rounded-2xl object-cover border border-border" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-border flex items-center justify-center">
                <Building2 size={26} className="text-gray-500" />
              </div>
            )}
          </div>
          <div className="bg-card rounded-2xl border border-border p-8">{children}</div>
          <p className="text-center text-xs text-gray-600 mt-5">{t.funnel.common.poweredBy}</p>
        </div>
      </div>
    </div>
  );
}
