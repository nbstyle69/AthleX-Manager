'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { CreditCard, Loader2, Search, Users, BookOpen } from 'lucide-react';
import { getMyBox } from '@/lib/getMyBox';

const supabase = createClient();

type Kind = 'membership' | 'program';

interface Row {
  key: string;
  kind: Kind;
  username: string;
  email: string;
  label: string;        // formule ou programme
  color: string;
  amountCents: number | null;
  status: string;       // active | past_due | cancelled | ...
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  active:    { label: 'Actif',    color: '#22C55E' },
  past_due:  { label: 'Impayé',   color: '#F59E0B' },
  cancelled: { label: 'Annulé',   color: '#EF4444' },
  refunded:  { label: 'Remboursé', color: '#EF4444' },
};

function fmtPrice(cents: number | null) {
  if (!cents) return '—';
  return `${(cents / 100).toFixed(2)} €`;
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SubscribersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | Kind>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const box = await getMyBox(supabase, user.id);
    if (!box) { router.push('/login'); return; }

    // Abonnements de salle (formules payantes)
    const { data: memberRows } = await supabase
      .from('box_members')
      .select('member_id, amount_cents, subscription_status, subscription_current_period_end, subscription_cancel_at_period_end, plan:membership_plans(name, color, price_cents), profile:profiles(username, email)')
      .eq('box_id', box.id)
      .not('subscription_status', 'is', null);

    // Achats de programmes
    const { data: programRows } = await supabase
      .from('program_members')
      .select('user_id, amount_cents, status, program:programs!inner(title, box_id), profile:profiles(username, email)')
      .eq('program.box_id', box.id);

    const memberships: Row[] = (memberRows ?? []).map((r: any, i: number) => {
      const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
      const plan = Array.isArray(r.plan) ? r.plan[0] : r.plan;
      return {
        key: `m-${r.member_id}-${i}`,
        kind: 'membership' as Kind,
        username: p?.username ?? '?',
        email: p?.email ?? '',
        label: plan?.name ?? 'Formule',
        color: plan?.color ?? '#FFFFFF',
        amountCents: r.amount_cents ?? plan?.price_cents ?? null,
        status: r.subscription_status ?? 'active',
        periodEnd: r.subscription_current_period_end ?? null,
        cancelAtPeriodEnd: !!r.subscription_cancel_at_period_end,
      };
    });

    const programs: Row[] = (programRows ?? []).map((r: any, i: number) => {
      const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
      const prog = Array.isArray(r.program) ? r.program[0] : r.program;
      return {
        key: `p-${r.user_id}-${i}`,
        kind: 'program' as Kind,
        username: p?.username ?? '?',
        email: p?.email ?? '',
        label: prog?.title ?? 'Programme',
        color: '#8B5CF6',
        amountCents: r.amount_cents ?? null,
        status: r.status ?? 'active',
        periodEnd: null,
        cancelAtPeriodEnd: false,
      };
    });

    setRows([...memberships, ...programs]);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter(r => {
    if (filter !== 'all' && r.kind !== filter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.username.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.label.toLowerCase().includes(q);
  });

  const activeCount = rows.filter(r => r.status === 'active').length;
  const mrrCents = rows
    .filter(r => r.kind === 'membership' && r.status === 'active')
    .reduce((s, r) => s + (r.amountCents ?? 0), 0);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-gray-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Abonnés</h1>
          <p className="text-sm text-gray-400 mt-1">Tous les membres qui paient (abonnements salle + programmes)</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-4">
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Abonnements actifs</p>
          <p className="text-2xl font-black text-white mt-1">{activeCount}</p>
        </div>
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-4">
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Revenu mensuel (salle)</p>
          <p className="text-2xl font-black text-white mt-1">{fmtPrice(mrrCents)}</p>
        </div>
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-4">
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total lignes</p>
          <p className="text-2xl font-black text-white mt-1">{rows.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un membre, une formule…"
            className="w-full bg-[#111111] border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30" />
        </div>
        {(['all', 'membership', 'program'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${filter === f ? 'bg-white text-black' : 'bg-[#111111] border border-white/10 text-gray-400 hover:text-white'}`}>
            {f === 'all' ? 'Tout' : f === 'membership' ? 'Salle' : 'Programmes'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#111111] border border-white/8 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 text-left">
              <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Membre</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Formule / Programme</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Montant</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Statut</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Prochaine échéance</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const st = STATUS_STYLE[r.status] ?? { label: r.status, color: '#9CA3AF' };
              return (
                <tr key={r.key} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white">{r.username}</p>
                    <p className="text-xs text-gray-500">{r.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400">
                      {r.kind === 'membership' ? <Users size={13} /> : <BookOpen size={13} />}
                      {r.kind === 'membership' ? 'Salle' : 'Programme'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 text-white font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                      {r.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-white">
                    {fmtPrice(r.amountCents)}{r.kind === 'membership' && <span className="text-[10px] text-gray-500 font-semibold">/mois</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-lg"
                      style={{ color: st.color, backgroundColor: `${st.color}18` }}>
                      {st.label}
                    </span>
                    {r.cancelAtPeriodEnd && (
                      <span className="block mt-1 text-[10px] font-semibold text-amber-400">Résiliation prévue</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {fmtDate(r.periodEnd)}
                    {r.cancelAtPeriodEnd && r.periodEnd && (
                      <span className="block text-[10px] text-amber-400/80">fin d'abonnement</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-600">
                <CreditCard size={22} className="mx-auto mb-2 text-gray-700" />
                Aucun abonné pour l'instant.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
