'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AlertTriangle, Loader2, Mail, RefreshCw, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { countOf } from '@/lib/plural';
import { parisDate } from '@/lib/datetime';
import { dunningLoad } from '@/lib/dunningLoad';

const supabase = createClient();

interface UnpaidRow {
  id: string;
  username: string | null;
  email: string | null;
  plan_name: string | null;
  amount_cents: number | null;
  payment_method_type: string | null;
  past_due_since: string | null;
  dunning_attempts: number | null;
  dunning_reminders_sent: number | null;
  dunning_last_reminder_at: string | null;
  last_payment_error: string | null;
  has_stripe_sub: boolean;
  suspended: boolean;
  grace_days: number | null;
}

const METHOD_LABEL: Record<string, string> = {
  card: 'Carte',
  sepa_debit: 'Prélèvement SEPA',
};

function fmtPrice(cents: number | null) {
  return cents ? `${(cents / 100).toFixed(2)} €` : '—';
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return parisDate(iso, { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Jours restants avant suspension des réservations (0 = déjà suspendu). */
function daysBeforeSuspension(row: UnpaidRow) {
  if (!row.past_due_since) return null;
  const ageDays = (Date.now() - new Date(row.past_due_since).getTime()) / 86_400_000;
  return Math.max(0, Math.ceil((row.grace_days ?? 7) - ageDays));
}

export default function UnpaidPanel({ boxId, onChange }: { boxId: string; onChange?: () => void }) {
  const [rows, setRows] = useState<UnpaidRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Refus (42501) ou échec du chargement : dit tel quel, jamais « aucun impayé ».
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { rows: loaded, message } = dunningLoad<UnpaidRow>(await supabase.rpc('get_box_dunning', { p_box_id: boxId }));
    setRows(loaded);
    setLoadError(message);
    setLoading(false);
  }, [boxId]);

  useEffect(() => { load(); }, [load]);

  async function run(row: UnpaidRow, action: 'remind' | 'retry') {
    setBusy(`${row.id}-${action}`); setError(null); setNotice(null);
    try {
      const res = await fetch('/api/dunning', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ box_member_id: row.id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      setNotice(action === 'remind'
        ? `Relance envoyée à ${row.username ?? row.email ?? 'ce membre'}.`
        : `Encaissement lancé (facture ${data.invoice_status}).`);
      await load();
      onChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <Card className="p-4 flex items-center gap-2 text-sm text-ax-text-muted">
        <Loader2 size={15} className="animate-spin" /> Chargement des impayés…
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card role="alert" data-testid="impayes-erreur" className="p-4 flex items-center gap-2 text-sm text-ax-danger">
        <AlertTriangle size={15} className="shrink-0" /> {loadError}
      </Card>
    );
  }

  if (!rows.length) return null;

  const suspendedCount = rows.filter(r => r.suspended).length;

  return (
    <Card className="bg-ax-warning-soft border-ax-warning p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle size={15} className="text-ax-warning" />
        <p className="text-sm font-bold text-ax-warning">
          Impayés ({rows.length}){suspendedCount > 0 ? ` — ${countOf(suspendedCount, 'accès suspendu', 'accès suspendus')}` : ''}
        </p>
      </div>

      {error && <p className="text-sm text-ax-danger">{error}</p>}
      {notice && <p className="text-sm text-ax-success">{notice}</p>}

      {rows.map(r => {
        const left = daysBeforeSuspension(r);
        return (
          <Card key={r.id} className="flex flex-wrap items-start justify-between gap-4 p-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-ax-text">
                {r.username ?? r.email ?? '?'}
                <span className="ml-2 text-xs font-semibold text-ax-text-secondary">{r.plan_name ?? 'Formule'}</span>
                <span className="ml-2 text-xs font-semibold text-ax-warning">{fmtPrice(r.amount_cents)}</span>
              </p>
              <p className="text-xs text-ax-text-secondary mt-1">
                Impayé depuis le {fmtDate(r.past_due_since)} · {countOf(r.dunning_attempts ?? 0, 'tentative', 'tentatives')} ·{' '}
                {countOf(r.dunning_reminders_sent ?? 0, 'relance', 'relances')}
                {r.payment_method_type ? ` · ${METHOD_LABEL[r.payment_method_type] ?? r.payment_method_type}` : ''}
              </p>
              {r.last_payment_error && (
                <p className="text-xs text-ax-text-muted mt-1">Motif : {r.last_payment_error}</p>
              )}
              <p className={`text-xs font-bold mt-1 ${r.suspended ? 'text-ax-danger' : 'text-ax-warning'}`}>
                {r.suspended
                  ? 'Réservations suspendues'
                  : left !== null
                    ? `Suspension des réservations dans ${countOf(left, 'jour', 'jours')}`
                    : 'Suspension programmée'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="ax-outline" onClick={() => run(r, 'remind')} disabled={busy !== null}
                className="gap-1 text-xs px-2.5">
                {busy === `${r.id}-remind` ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />} Relancer
              </Button>
              <Button variant="ax-mint" onClick={() => run(r, 'retry')} disabled={busy !== null || !r.has_stripe_sub}
                title={r.has_stripe_sub ? undefined : 'Aucun abonnement Stripe rattaché'}
                className="gap-1 text-xs px-2.5">
                {busy === `${r.id}-retry` ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Encaisser
              </Button>
            </div>
          </Card>
        );
      })}

      <p className="text-[11px] text-ax-text-muted flex items-center gap-1">
        <Ban size={11} /> Passé le délai de grâce de la box, les réservations sont bloquées automatiquement et rétablies dès le paiement.
      </p>
    </Card>
  );
}
