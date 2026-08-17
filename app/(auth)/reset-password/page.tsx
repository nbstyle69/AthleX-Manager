'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, AlertCircle, ArrowLeft, MailCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { SITE_URL } from '@/lib/site-url';
import { useLanguage } from '@/components/language-provider';

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
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        {t.funnel.common.backLogin}
      </Link>
      <div className="flex flex-col items-center mb-10 gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="AthleX" width={96} height={96} className="w-24 h-24 object-contain" />
        <p className="text-sm text-muted-foreground font-medium">{r.header}</p>
      </div>

      <div className="bg-card rounded-2xl border border-border p-8">
        {sent ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <MailCheck size={32} className="text-foreground" />
            <h2 className="text-lg font-bold text-foreground">{r.sentTitle}</h2>
            <p className="text-sm text-muted-foreground">
              {r.sentBefore}<span className="text-foreground">{email}</span>{r.sentAfter}
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-foreground mb-6">{r.title}</h2>

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
                  placeholder={t.funnel.common.emailPlaceholder}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-white hover:bg-white disabled:opacity-60 text-[#0A0A0A] font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2">
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? r.submitting : r.submit}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
