'use client';

import { CalendarPlus, AlertTriangle, Clock, PauseCircle } from 'lucide-react';
import { addDaysISO, nextMondayISO, subscriptionColorHex, toLocalISO, weekNumberFor } from '@/lib/audience';

/**
 * Bannière du Whiteboard quand la box a au moins un abonnement Marketplace
 * actif : dit ce qui va se passer (ou pas) sans que le gérant aille le chercher.
 *
 * - offre vide → rien ne se posera, la box éditrice doit la remplir ;
 * - application automatique → quelle semaine, quel dimanche 18h ;
 * - application automatique coupée → les semaines se posent à la main.
 *
 * « Appliquer maintenant » ouvre la modale Programmation présélectionnée sur
 * l'abonnement et la semaine due pour la semaine affichée.
 */
export interface BannerSubscription {
  subscriptionId: string;
  programmingId: string;
  title: string;
  publisherBoxName: string | null;
  weeksCount: number;
  autoApplyWeekly: boolean;
  color: string | null;
  weekAnchor: string | null;
  wodCounts: number[];
}

function frDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function SubscriptionBanner({
  subscriptions, displayedMonday, onApplyNow,
}: {
  subscriptions: BannerSubscription[];
  /** Lundi (ISO) de la semaine affichée : cible de « Appliquer maintenant ». */
  displayedMonday: string;
  onApplyNow: (subscriptionId: string, week: number) => void;
}) {
  if (subscriptions.length === 0) return null;
  const today = toLocalISO(new Date());
  const nextMonday = nextMondayISO(today);
  const nextSunday = addDaysISO(nextMonday, -1);

  return (
    <div className="space-y-2" data-testid="banniere-abonnements">
      {subscriptions.map(s => {
        const color = subscriptionColorHex(s.color);
        const empty = s.wodCounts.every(n => n === 0);
        const anchor = s.weekAnchor ?? nextMonday;
        const dueNext = weekNumberFor(anchor, nextMonday, s.weeksCount);
        const dueDisplayed = weekNumberFor(anchor, displayedMonday, s.weeksCount);
        const displayedEmpty = (s.wodCounts[dueDisplayed - 1] ?? 0) === 0;

        let icon = <Clock size={15} className="shrink-0 mt-0.5" style={{ color }} />;
        let text: React.ReactNode;
        if (empty) {
          icon = <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-400" />;
          text = <>« {s.title} » ne contient encore aucun WOD : rien ne se posera tant que {s.publisherBoxName ?? 'la box éditrice'} ne l&apos;a pas remplie.</>;
        } else if (s.autoApplyWeekly) {
          text = <>Prochaine semaine automatique de « {s.title} » : <span className="text-white font-semibold">semaine {dueNext}</span>, posée le {frDate(nextSunday)} à 18h.</>;
        } else {
          icon = <PauseCircle size={15} className="shrink-0 mt-0.5 text-gray-400" />;
          text = <>Application automatique désactivée pour « {s.title} » : pose les semaines depuis « Programmation » (Marketplace pour la réactiver).</>;
        }

        return (
          <div
            key={s.subscriptionId}
            className="flex items-start gap-3 rounded-xl border bg-white/[0.03] px-4 py-3"
            style={{ borderColor: `${color}55` }}
          >
            {icon}
            <p className="flex-1 text-sm text-gray-300">{text}</p>
            <button
              type="button"
              onClick={() => onApplyNow(s.subscriptionId, dueDisplayed)}
              disabled={empty}
              title={empty ? 'Offre vide' : displayedEmpty
                ? `La semaine ${dueDisplayed} est vide : la modale te laissera en choisir une autre`
                : `Poser la semaine ${dueDisplayed} sur la semaine affichée`}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-white/10 text-gray-300 hover:text-white hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <CalendarPlus size={13} /> Appliquer maintenant
            </button>
          </div>
        );
      })}
    </div>
  );
}
