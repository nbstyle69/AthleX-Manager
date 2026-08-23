'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, Banknote, ChevronDown, CreditCard, Euro, Loader2, PackageOpen, UserMinus,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Delta from './Delta';

interface MoneySummary {
  mrr_stripe_cents: number;
  mrr_stripe_subs: number;
  mrr_cash_cents: number;
  mrr_cash_subs: number;
  past_due_count: number;
  past_due_cents: number;
  cash_to_collect_count: number;
  cash_to_collect_cents: number;
  cancellations_period: number;
  new_subs_period: number;
  program_revenue_cents: number;
  program_sales_period: number;
  cash_collected_cents: number;
  cash_collected_count: number;
}

interface PlanRow {
  plan_id: string;
  plan_name: string;
  plan_color: string | null;
  price_cents: number | null;
  subs: number;
  mrr_cents: number;
}

interface PersonRow {
  kind: 'past_due' | 'cash';
  ref_id: string;
  member_id: string | null;
  label: string | null;
  email: string | null;
  amount_cents: number | null;
  since: string | null;
  detail: string | null;
}

interface MonthRow {
  month: string;
  membership_cents: number;
  program_cents: number;
  cash_cents: number;
}

const EUR = (cents: number) =>
  `${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;

const MONTH_LABEL = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' });
};

const DAYS_AGO = (iso: string | null) => {
  if (!iso) return '—';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "aujourd'hui" : `depuis ${days} j`;
};

/** Bornes du mois calendaire en cours et du mois précédent. */
function monthBounds() {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfPrev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return {
    current: { from: startOfMonth.toISOString(), to: endOfMonth.toISOString() },
    previous: { from: startOfPrev.toISOString(), to: startOfMonth.toISOString() },
  };
}

/**
 * Bloc « Argent » de la page Statistiques.
 *
 * Tout passe par des RPC serveur : `box_members` n'accorde plus les colonnes de
 * facturation à `authenticated`, une lecture directe renverrait 42501 — et un
 * zéro parfaitement crédible si l'erreur n'est pas regardée. Ici, une erreur
 * s'affiche ; elle ne se transforme jamais en chiffre.
 */
export default function MoneyBlock({ boxId }: { boxId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<MoneySummary | null>(null);
  const [previous, setPrevious] = useState<MoneySummary | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [history, setHistory] = useState<MonthRow[]>([]);
  const [hasStripeAccount, setHasStripeAccount] = useState(true);
  const [openList, setOpenList] = useState<'past_due' | 'cash' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { current: cur, previous: prev } = monthBounds();

    const [curRes, prevRes, planRes, peopleRes] = await Promise.all([
      supabase.rpc('get_box_money_summary', { p_box_id: boxId, p_from: cur.from, p_to: cur.to }),
      supabase.rpc('get_box_money_summary', { p_box_id: boxId, p_from: prev.from, p_to: prev.to }),
      supabase.rpc('get_box_plan_breakdown', { p_box_id: boxId }),
      supabase.rpc('get_box_money_people', { p_box_id: boxId }),
    ]);

    const firstError = curRes.error ?? prevRes.error ?? planRes.error ?? peopleRes.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const one = (data: unknown) => (Array.isArray(data) ? data[0] : data) as MoneySummary | undefined;
    setCurrent(one(curRes.data) ?? null);
    setPrevious(one(prevRes.data) ?? null);
    setPlans((planRes.data ?? []) as PlanRow[]);
    setPeople((peopleRes.data ?? []) as PersonRow[]);

    try {
      const res = await fetch(`/api/box-revenue?box_id=${boxId}&months=6`);
      if (res.ok) {
        const data = await res.json() as { months: MonthRow[]; has_stripe_account: boolean };
        setHistory(data.months ?? []);
        setHasStripeAccount(data.has_stripe_account);
      }
    } catch {
      // L'historique vient de Stripe : son absence ne doit pas masquer le reste.
      setHistory([]);
    }

    setLoading(false);
  }, [boxId, supabase]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="bg-[#111111] border border-white/8 rounded-2xl p-6 flex items-center gap-3">
        <Loader2 size={16} className="animate-spin text-white" />
        <span className="text-sm text-gray-400">Chargement des chiffres d&apos;argent…</span>
      </div>
    );
  }

  if (error || !current || !previous) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5">
        <p className="text-sm font-bold text-red-300 flex items-center gap-2">
          <AlertTriangle size={16} /> Chiffres d&apos;argent indisponibles
        </p>
        <p className="text-xs text-red-200/80 mt-1">{error ?? 'Réponse vide du serveur.'}</p>
      </div>
    );
  }

  const mrrTotal = current.mrr_stripe_cents + current.mrr_cash_cents;
  const prevMrrTotal = previous.mrr_stripe_cents + previous.mrr_cash_cents;
  const monthTotal = (h: MonthRow) => h.membership_cents + h.program_cents + h.cash_cents;
  const maxMonth = Math.max(...history.map(monthTotal), 1);
  const pastDuePeople = people.filter(p => p.kind === 'past_due');
  const cashPeople = people.filter(p => p.kind === 'cash');

  const cards = [
    {
      key: 'mrr',
      label: 'MRR abonnements',
      value: EUR(mrrTotal),
      sub: `${current.mrr_stripe_subs + current.mrr_cash_subs} abonné(s)`,
      icon: Euro,
      delta: <Delta current={mrrTotal} previous={prevMrrTotal} suffix=" €" />,
    },
    {
      key: 'cash',
      label: 'Encaissé au comptoir',
      value: EUR(current.cash_collected_cents),
      // Hors comptoir de programme : celui-là est du chiffre d'affaires de
      // programme, compté dans la carte voisine. Le total additionne les deux.
      sub: `${current.cash_collected_count} encaissement(s) d'adhésion ce mois`,
      icon: Banknote,
      delta: <Delta current={current.cash_collected_cents} previous={previous.cash_collected_cents} suffix=" €" />,
    },
    {
      key: 'programs',
      label: 'Programmes ce mois',
      value: EUR(current.program_revenue_cents),
      sub: `${current.program_sales_period} vente(s), Stripe et comptoir`,
      icon: PackageOpen,
      delta: <Delta current={current.program_revenue_cents} previous={previous.program_revenue_cents} suffix=" €" />,
    },
    {
      key: 'new',
      label: 'Nouveaux abonnés',
      value: String(current.new_subs_period),
      sub: 'ce mois-ci',
      icon: CreditCard,
      delta: <Delta current={current.new_subs_period} previous={previous.new_subs_period} />,
    },
    {
      key: 'churn',
      label: 'Résiliations',
      value: String(current.cancellations_period),
      sub: 'ce mois-ci',
      icon: UserMinus,
      delta: <Delta current={current.cancellations_period} previous={previous.cancellations_period} goodWhenUp={false} />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Euro size={16} className="text-white" />
          Argent
        </h2>
        <span className="text-[11px] text-gray-500">comparaisons vs mois précédent</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {cards.map(({ key, label, value, sub, icon: Icon, delta }) => (
          <div key={key} className="bg-[#111111] border border-white/8 rounded-2xl p-4">
            <div className="flex items-start justify-between">
              <Icon size={16} className="text-gray-400" />
              {delta}
            </div>
            <p className="text-2xl font-black text-white mt-3">{value}</p>
            <p className="text-[11px] text-gray-400 font-medium mt-1">{label}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Argent en attente — nominatif, dépliable */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {([
          {
            kind: 'past_due' as const,
            title: 'Impayés en cours',
            count: current.past_due_count,
            cents: current.past_due_cents,
            rows: pastDuePeople,
            href: '/subscribers',
            hrefLabel: 'Relancer depuis Abonnés',
            tone: 'text-red-400',
          },
          {
            kind: 'cash' as const,
            title: 'À encaisser au comptoir',
            count: current.cash_to_collect_count,
            cents: current.cash_to_collect_cents,
            rows: cashPeople,
            href: '/invitations',
            hrefLabel: 'Voir les invitations',
            tone: 'text-amber-400',
          },
        ]).map(({ kind, title, count, cents, rows, href, hrefLabel, tone }) => (
          <div key={kind} className="bg-[#111111] border border-white/8 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenList(openList === kind ? null : kind)}
              disabled={count === 0}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] disabled:hover:bg-transparent disabled:cursor-default transition-colors"
            >
              <div className="text-left">
                <p className="text-xs font-bold text-gray-400">{title}</p>
                <p className={`text-xl font-black mt-1 ${count > 0 ? tone : 'text-gray-600'}`}>
                  {count} · {EUR(cents)}
                </p>
              </div>
              {count > 0 && (
                <ChevronDown size={16} className={`text-gray-500 transition-transform ${openList === kind ? 'rotate-180' : ''}`} />
              )}
            </button>

            {openList === kind && rows.length > 0 && (
              <div className="border-t border-white/8 divide-y divide-white/5">
                {rows.map(p => (
                  <div key={p.ref_id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {p.label?.trim() || p.email || '—'}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {DAYS_AGO(p.since)}{p.detail ? ` · ${p.detail}` : ''}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-white shrink-0">{EUR(p.amount_cents ?? 0)}</span>
                  </div>
                ))}
                <Link href={href} className="block px-5 py-3 text-xs font-bold text-white hover:bg-white/[0.03] transition-colors">
                  {hrefLabel} →
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Historique réellement encaissé */}
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-1">Encaissé sur 6 mois</h3>
          <p className="text-[11px] text-gray-500 mb-5">
            {hasStripeAccount
              ? 'Factures Stripe, achats de programmes (Stripe et comptoir) et encaissements comptoir d\'adhésion.'
              : 'Aucun compte Stripe connecté : seuls les programmes et le comptoir apparaissent.'}
          </p>
          {history.length === 0 ? (
            <p className="text-xs text-gray-600 py-6 text-center">Aucun encaissement sur la période.</p>
          ) : (
            <div className="flex items-end gap-2 h-36">
              {history.map(h => {
                const total = monthTotal(h);
                return (
                  <div key={h.month} className="flex-1 h-full flex flex-col items-center justify-end gap-1 group relative">
                    <div className="absolute -top-7 bg-[#1a1a1a] border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                      {EUR(total)}
                    </div>
                    <div className="w-full flex flex-col justify-end" style={{ height: `${Math.max((total / maxMonth) * 100, 2)}%` }}>
                      {h.program_cents > 0 && (
                        <div className="w-full rounded-t-sm bg-white/40" style={{ height: `${(h.program_cents / Math.max(total, 1)) * 100}%` }} />
                      )}
                      {h.cash_cents > 0 && (
                        <div className="w-full bg-amber-400/70" style={{ height: `${(h.cash_cents / Math.max(total, 1)) * 100}%` }} />
                      )}
                      <div className="w-full flex-1 bg-white" />
                    </div>
                    <span className="text-[10px] text-gray-600">{MONTH_LABEL(h.month)}</span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[10px] text-gray-600 mt-3">
            Le comptoir n&apos;y figure que depuis la pose du journal : les encaissements en espèces
            antérieurs n&apos;ont laissé ni montant ni date, ils sont perdus pour toujours.
          </p>
        </div>

        {/* Répartition par formule */}
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
            <Banknote size={16} className="text-white" />
            Abonnés par formule
          </h3>
          {plans.length === 0 ? (
            <p className="text-xs text-gray-600 py-6 text-center">Aucune formule d&apos;abonnement.</p>
          ) : (
            <div className="space-y-3">
              {plans.map(p => {
                const totalSubs = plans.reduce((s, x) => s + x.subs, 0) || 1;
                const pct = Math.round((p.subs / totalSubs) * 100);
                const color = p.plan_color ?? '#FFFFFF';
                return (
                  <div key={p.plan_id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white">{p.plan_name}</span>
                      <span className="text-xs text-gray-400">
                        {p.subs} · {EUR(p.mrr_cents)}
                      </span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {current.mrr_cash_subs > 0 && (
            <p className="text-[10px] text-gray-600 mt-4">
              dont {current.mrr_cash_subs} abonnement(s) au comptoir : {EUR(current.mrr_cash_cents)} attendus au prix
              de la formule, à rapprocher des {EUR(current.cash_collected_cents)} réellement encaissés ce mois.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
