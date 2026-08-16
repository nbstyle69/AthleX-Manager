'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Loader2, TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Delta from './Delta';

interface FunnelSummary {
  prospects: number;
  prospects_converted: number;
  invitations_sent: number;
  invitations_accepted: number;
  members_joined: number;
  members_subscribed: number;
}

const WINDOW_DAYS = 30;

/** Un taux n'a de sens que si la cohorte de départ en supporte un. */
const MIN_COHORT = 10;

const isoString = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString();

/**
 * Bloc « Croissance » de la page Statistiques.
 *
 * Le funnel suit UNE cohorte : les abonnés affichés sont ceux des adhésions de
 * la période, pas les abonnements actifs de la box. Sinon un bon mois donnerait
 * un taux de passage supérieur à 100 %.
 *
 * Les taux de passage ne s'affichent qu'à partir de {@link MIN_COHORT} entrées.
 * En dessous, « 1 prospect sur 3 » se lit ; « 33 % de conversion » se cite —
 * et une conversion de plus ferait bondir le chiffre de 33 points.
 */
export default function GrowthBlock({ boxId }: { boxId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<FunnelSummary | null>(null);
  const [previous, setPrevious] = useState<FunnelSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const args = (from: number, to: number) => ({
      p_box_id: boxId,
      p_from: isoString(from),
      p_to: isoString(to),
    });

    const [curRes, prevRes] = await Promise.all([
      supabase.rpc('get_box_funnel_summary', args(-WINDOW_DAYS, 0)),
      supabase.rpc('get_box_funnel_summary', args(-2 * WINDOW_DAYS, -WINDOW_DAYS)),
    ]);

    const firstError = curRes.error ?? prevRes.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const one = (data: unknown) =>
      (Array.isArray(data) ? data[0] : data) as FunnelSummary | undefined;
    setCurrent(one(curRes.data) ?? null);
    setPrevious(one(prevRes.data) ?? null);
    setLoading(false);
  }, [boxId, supabase]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="bg-[#111111] border border-white/8 rounded-2xl p-6 flex items-center gap-3">
        <Loader2 size={16} className="animate-spin text-white" />
        <span className="text-sm text-gray-400">Chargement de la croissance…</span>
      </div>
    );
  }

  if (error || !current || !previous) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5">
        <p className="text-sm font-bold text-red-300 flex items-center gap-2">
          <AlertTriangle size={16} /> Croissance indisponible
        </p>
        <p className="text-xs text-red-200/80 mt-1">{error ?? 'Réponse vide du serveur.'}</p>
      </div>
    );
  }

  const steps = [
    {
      key: 'prospects',
      label: 'Prospects',
      value: current.prospects,
      prev: previous.prospects,
      sub: `${current.prospects_converted} converti(s)`,
      href: '/prospects',
    },
    {
      key: 'invitations',
      label: 'Invitations',
      value: current.invitations_sent,
      prev: previous.invitations_sent,
      sub: `${current.invitations_accepted} acceptée(s)`,
      href: '/invitations',
    },
    {
      key: 'members',
      label: 'Membres',
      value: current.members_joined,
      prev: previous.members_joined,
      sub: 'adhésions de la période',
      href: '/members',
    },
    {
      key: 'subscribers',
      label: 'Abonnés',
      value: current.members_subscribed,
      prev: previous.members_subscribed,
      sub: 'de cette même cohorte',
      href: '/subscribers',
    },
  ];

  // Le taux de passage d'un étage à l'autre, quand la cohorte le supporte.
  const passage = (from: number, to: number) =>
    from >= MIN_COHORT ? `${Math.round((to / from) * 100)} %` : `${to}/${from}`;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <TrendingUp size={16} className="text-white" />
          Croissance
        </h2>
        <span className="text-[11px] text-gray-500">
          {WINDOW_DAYS} derniers jours · vs {WINDOW_DAYS} jours précédents
        </span>
      </div>

      <div className="bg-[#111111] border border-white/8 rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-stretch gap-2">
          {steps.map((step, i) => (
            <div key={step.key} className="flex-1 flex items-center gap-2">
              <Link
                href={step.href}
                className="flex-1 rounded-xl border border-white/8 bg-white/[0.02] hover:bg-white/[0.05] transition-colors p-4 block"
              >
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-bold text-gray-400">{step.label}</p>
                  <Delta current={step.value} previous={step.prev} />
                </div>
                <p className="text-2xl font-black text-white mt-2">{step.value}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">{step.sub}</p>
              </Link>

              {i < steps.length - 1 && (
                <div className="hidden lg:flex flex-col items-center justify-center px-1 shrink-0">
                  <ArrowRight size={14} className="text-gray-600" />
                  <span className="text-[10px] font-bold text-gray-500 mt-1">
                    {passage(step.value, steps[i + 1].value)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="text-[10px] text-gray-600 mt-4">
          {current.members_joined < MIN_COHORT
            ? 'Effectifs bruts : sur de petites cohortes, un pourcentage varierait de dizaines de points pour une personne de plus.'
            : 'Les abonnés sont comptés dans la cohorte des adhésions de la période, pas sur l’ensemble de la box.'}
        </p>
      </div>
    </div>
  );
}
