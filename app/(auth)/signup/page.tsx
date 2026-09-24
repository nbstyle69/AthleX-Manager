'use client';

import { useState } from 'react';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { StoreBadges } from '@/components/store-badges';
import { useLanguage } from '@/components/language-provider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Gender = 'male' | 'female';

export default function SignupPage() {
  const { t } = useLanguage();
  const s = t.funnel.signup;
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
    if (!cgu) { setError(s.cguRequired); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, gender }),
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error ?? s.error); setLoading(false); return; }
      setDone({ needsConfirmation: json.needsConfirmation, finalUsername: json.finalUsername, pseudoChanged: json.pseudoChanged });
      setLoading(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.funnel.common.networkError);
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="w-full max-w-sm mx-auto px-4">
        <div className="bg-ax-surface rounded-ax-card border border-ax-border p-8 text-center">
          <CheckCircle2 size={40} className="text-ax-success mx-auto mb-4" />
          <h2 className="text-lg font-bold text-ax-text">{s.doneTitle}</h2>
          {done.needsConfirmation ? (
            <p className="text-sm text-ax-text-secondary mt-2">
              {s.confirmBefore}<span className="text-ax-text">{email}</span>{s.confirmAfter}
            </p>
          ) : (
            <p className="text-sm text-ax-text-secondary mt-2">
              {s.readyBefore}<span className="text-ax-text">{done.finalUsername}</span>{s.readyAfter}
            </p>
          )}
          {done.pseudoChanged && (
            <p className="text-xs text-ax-text-muted mt-3">
              {s.pseudoTakenBefore}{done.finalUsername}{s.pseudoTakenAfter}
            </p>
          )}
          <StoreBadges layout="stacked" className="mt-6" />
          <a href="/landing" className="block text-xs text-ax-text-muted hover:text-ax-text mt-5">{t.funnel.common.backHome}</a>
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
          <h1 className="text-2xl font-black text-ax-text tracking-tight">AthleX</h1>
          <p className="text-sm text-ax-text-secondary font-medium mt-0.5">{s.subtitle}</p>
        </div>
      </div>

      <div className="bg-ax-surface rounded-ax-card border border-ax-border p-8">
        <h2 className="text-lg font-bold text-ax-text mb-6">{s.title}</h2>

        {error && (
          <div className="flex items-center gap-2 bg-ax-danger-soft border border-ax-danger rounded-ax-control px-4 py-3 mb-5">
            <AlertCircle size={15} className="text-ax-danger shrink-0" />
            <p className="text-sm text-ax-danger">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ax-text-secondary mb-1.5 uppercase tracking-wider">{s.username}</label>
            <Input type="text" required value={username} onChange={e => setUsername(e.target.value)}
              placeholder={s.usernamePlaceholder} autoCapitalize="none"
               />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ax-text-secondary mb-1.5 uppercase tracking-wider">{t.funnel.common.email}</label>
            <Input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder={t.funnel.common.emailPlaceholder} autoCapitalize="none"
               />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ax-text-secondary mb-1.5 uppercase tracking-wider">{t.funnel.common.password}</label>
            <Input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" minLength={6}
               />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ax-text-secondary mb-1.5 uppercase tracking-wider">{s.gender}</label>
            <div className="flex gap-2">
              {(['male', 'female'] as Gender[]).map(g => (
                <button type="button" key={g} onClick={() => setGender(g)}
                  className={`flex-1 py-2.5 rounded-ax-control text-sm font-bold border transition-colors ${
                    gender === g ? 'bg-ax-text text-ax-background border-ax-text' : 'bg-ax-hover text-ax-text border-ax-border hover:border-ax-input-border'
                  }`}>
                  {g === 'male' ? s.male : s.female}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2.5 text-sm text-ax-text-secondary pt-1">
            <input type="checkbox" checked={cgu} onChange={e => setCgu(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-ax-accent" />
            <span>
              {s.cguPrefix}
              <a href="/privacy" className="text-ax-text underline">{s.cguLink}</a>.
            </span>
          </label>

          <Button type="submit" disabled={loading || !cgu} variant="ax-white" className="w-full mt-2">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? s.submitting : s.submit}
          </Button>
        </form>

        <p className="text-sm text-ax-text-secondary text-center mt-6">
          {s.alreadyPrompt}{' '}
          <a href="/login" className="text-ax-text font-semibold hover:underline">{t.funnel.common.login}</a>
        </p>
      </div>
    </div>
  );
}
