'use client';

import { CalendarPlus, AlertTriangle, Clock, PauseCircle } from 'lucide-react';
import { addDaysISO, nextMondayISO, toLocalISO, weekNumberFor } from '@/lib/audience';
import { softVar, subColorVar } from '@/lib/colorVars';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

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
        const color = subColorVar(s.color, 'text');
        const empty = s.wodCounts.every(n => n === 0);
        const anchor = s.weekAnchor ?? nextMonday;
        const dueNext = weekNumberFor(anchor, nextMonday, s.weeksCount);
        const dueDisplayed = weekNumberFor(anchor, displayedMonday, s.weeksCount);
        const displayedEmpty = (s.wodCounts[dueDisplayed - 1] ?? 0) === 0;

        let icon = <Clock size={15} className="shrink-0 mt-0.5" style={{ color }} />;
        let text: React.ReactNode;
        if (empty) {
          icon = <AlertTriangle size={15} className="shrink-0 mt-0.5 text-ax-warning" />;
          text = <>« {s.title} » ne contient encore aucun WOD : rien ne se posera tant que {s.publisherBoxName ?? 'la box éditrice'} ne l&apos;a pas remplie.</>;
        } else if (s.autoApplyWeekly) {
          text = <>Prochaine semaine automatique de « {s.title} » : <span className="text-ax-text font-semibold">semaine {dueNext}</span>, posée le {frDate(nextSunday)} à 18h.</>;
        } else {
          icon = <PauseCircle size={15} className="shrink-0 mt-0.5 text-ax-text-secondary" />;
          text = <>Application automatique désactivée pour « {s.title} » : pose les semaines depuis « Programmation » (Marketplace pour la réactiver).</>;
        }

        return (
          <Card
            key={s.subscriptionId}
            className="flex flex-wrap items-start gap-3 px-4 py-3"
            style={{ borderColor: softVar(color, 85 / 255) }}
          >
            {icon}
            <p className="flex-1 text-sm text-ax-text-secondary">{text}</p>
            <Button
              variant="ax-outline"
              type="button"
              onClick={() => onApplyNow(s.subscriptionId, dueDisplayed)}
              disabled={empty}
              title={empty ? 'Offre vide' : displayedEmpty
                ? `La semaine ${dueDisplayed} est vide : la modale te laissera en choisir une autre`
                : `Poser la semaine ${dueDisplayed} sur la semaine affichée`}
              className="shrink-0 gap-1.5 text-xs"
            >
              <CalendarPlus size={13} /> Appliquer maintenant
            </Button>
          </Card>
        );
      })}
    </div>
  );
}
