'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, AlertCircle, ArrowLeft, MailCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { SITE_URL } from '@/lib/site-url';
import { useLanguage } from '@/components/language-provider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const r = t.funnel.reset;
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${SITE_URL}/update-password`,
      });
      if (authError) { setError(authError.message); setLoading(false); return; }
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.funnel.common.networkError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto px-4">
      <Link
        href="/login"
        className="inline-flex items-center gap-2 text-sm text-ax-text-secondary hover:text-ax-text transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        {t.funnel.common.backLogin}
      </Link>
      <div className="flex flex-col items-center mb-10 gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="AthleX" width={96} height={96} className="w-24 h-24 object-contain" />
        <p className="text-sm text-ax-text-secondary font-medium">{r.header}</p>
      </div>

      <div className="bg-ax-surface rounded-ax-card border border-ax-border p-8">
        {sent ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <MailCheck size={32} className="text-ax-text" />
            <h2 className="text-lg font-bold text-ax-text">{r.sentTitle}</h2>
            <p className="text-sm text-ax-text-secondary">
              {r.sentBefore}<span className="text-ax-text">{email}</span>{r.sentAfter}
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-ax-text mb-6">{r.title}</h2>

            {error && (
              <div className="flex items-center gap-2 bg-ax-danger-soft border border-ax-danger rounded-ax-control px-4 py-3 mb-5">
                <AlertCircle size={15} className="text-ax-danger shrink-0" />
                <p className="text-sm text-ax-danger">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ax-text-secondary mb-1.5 uppercase tracking-wider">{t.funnel.common.email}</label>
                <Input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder={t.funnel.common.emailPlaceholder}
                   />
              </div>
              <Button type="submit" disabled={loading} variant="ax-white" className="w-full mt-2">
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? r.submitting : r.submit}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
