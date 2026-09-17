'use client';

import { TAB_LABEL, TRACK_LABEL, isTrack, trackOf, type TrackTab } from '@/lib/autoProgramming';
import { trackColorVar } from '@/lib/colorVars';

/**
 * Barre d'onglets de piste du Whiteboard.
 *
 * Rien à afficher quand `tabs` est vide : c'est le cas d'une box sans
 * programmation automatique, où un filtre ne filtrerait rien. L'appelant n'a
 * donc pas à se poser la question, le composant se tait.
 *
 * L'onglet actif prend la teinte de sa piste ; « Box » et « Tout » restent
 * neutres — ce ne sont pas des pistes, et leur donner une couleur laisserait
 * croire le contraire.
 */
export default function TrackTabs({
  tabs, active, counts, onSelect,
}: {
  tabs: readonly TrackTab[];
  active: TrackTab;
  /** Nombre de cartes par onglet, affiché à côté du libellé. */
  counts: Record<string, number>;
  onSelect: (tab: TrackTab) => void;
}) {
  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto" role="tablist" aria-label="Piste" data-testid="onglets-piste">
      {tabs.map(tab => {
        const on = tab === active;
        const accent = isTrack(tab) ? trackColorVar(tab) : undefined;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={on}
            data-testid={`onglet-${tab}`}
            onClick={() => onSelect(tab)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border transition-colors ${
              on ? 'font-black text-white' : 'font-bold text-gray-400 border-white/10 hover:text-white hover:border-white/20'}`}
            style={on
              ? accent
                ? { borderColor: accent, backgroundColor: `color-mix(in srgb, ${accent} 18%, transparent)`, color: accent }
                : { borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.10)' }
              : undefined}
          >
            {accent && !on && (
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accent }} />
            )}
            {TAB_LABEL[tab]}
            <span className="opacity-60">{counts[tab] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Marque de piste sur une carte du Whiteboard : un liseré et un badge à la
 * teinte de la piste. Rien pour une carte saisie à la main — l'absence de
 * marque EST l'information « c'est la box qui l'a écrite ».
 *
 * Utile surtout en vue « Tout », où les trois pistes se côtoient ; laissée
 * partout, elle évite qu'un onglet change le contenu des cartes.
 */
export function TrackBadge({ wod }: { wod: { track?: string | null } }) {
  const track = trackOf(wod);
  if (!track) return null;
  const accent = trackColorVar(track);
  return (
    <span
      data-testid={`badge-piste-${track}`}
      title={`Piste ${TRACK_LABEL[track]}`}
      className="text-[8px] font-black tracking-wider px-1 py-0.5 rounded shrink-0"
      style={{ color: accent, backgroundColor: `color-mix(in srgb, ${accent} 16%, transparent)` }}
    >
      {TRACK_LABEL[track].toUpperCase()}
    </span>
  );
}

/** Liseré gauche coloré, ou `undefined` pour laisser la carte telle quelle. */
export function trackAccent(wod: { track?: string | null }): string | undefined {
  const track = trackOf(wod);
  return track ? trackColorVar(track) : undefined;
}
