'use client';

/**
 * Les restrictions d'un WOD, dites en toutes lettres.
 *
 * Trois règles, chacune répare un défaut mesuré du rendu précédent :
 *
 * 1. Le badge se nomme (`Groupe : Muscu`, `Programme : Force 6`). Un badge nu
 *    ne disait pas de quelle nature était la restriction, alors que les deux
 *    n'ont ni le même effet ni la même table.
 * 2. La visibilité dans la box se lit dans la colonne `audience`, jamais
 *    déduite de l'absence de groupe : « Visible par toute la box », « Visible
 *    par K+ Perf, Hyrox » ou « Visible par personne » (atténué). Sans
 *    `audience` (contexte sans colonne), l'ancien rendu par restrictions reste.
 * 3. Une restriction dont le groupe ou le programme est introuvable dans la
 *    liste chargée n'est plus effacée. Elle existe en base : l'effacer faisait
 *    afficher « visible par tous » à un WOD réservé.
 */

import { Audience, audienceBadgeLabel } from '@/lib/audience';

export type RestrictionRef = { id: string; name: string; color: string };

const COULEUR_INCONNUE = '#F59E0B';
const COULEUR_LIBRE = '#6B7280';
const COULEUR_PERSONNE = '#4B5563';

/** Couleur d'un programme selon son type, comme sur la page Programmes. */
export function programColor(type: string): string {
  return type === 'fixed' ? '#3B82F6' : '#8B5CF6';
}

function Badge({
  label, color, compact, title,
}: { label: string; color: string; compact: boolean; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-0.5 font-bold rounded-full ${
        compact ? 'text-[8px] px-1.5 py-0.5' : 'text-[9px] px-1.5 py-0.5'
      }`}
      style={{ backgroundColor: `${color}20`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

export function RestrictionBadges({
  audience, groupIds, programIds, groups, programs, compact = false, showFree = true,
}: {
  /** Colonne `box_wods.audience` ; absente dans les contextes qui ne la portent pas. */
  audience?: Audience;
  groupIds: string[];
  programIds: string[];
  groups: RestrictionRef[];
  programs: RestrictionRef[];
  compact?: boolean;
  /** Afficher « Visible par toute la box » quand il n'y a aucune restriction. */
  showFree?: boolean;
}) {
  if (audience) {
    const named = groupIds.map(id => groups.find(x => x.id === id));
    const groupNames = named.map((g, i) => g?.name ?? `groupe inconnu (${groupIds[i].slice(0, 8)})`);
    const color = audience === 'all' ? COULEUR_LIBRE
      : audience === 'none' ? COULEUR_PERSONNE
      : (named.find(g => g)?.color ?? COULEUR_INCONNUE);
    return (
      <div className="flex flex-wrap gap-1">
        <Badge
          label={audienceBadgeLabel(audience, audience === 'groups' ? groupNames : [])}
          color={color}
          compact={compact}
          title={audience === 'none' ? 'Aucun membre de la box ne voit ce WOD dans l\u2019app.' : undefined}
        />
        {programIds.map(id => {
          const p = programs.find(x => x.id === id);
          return (
            <Badge
              key={id}
              label={p ? `Programme : ${p.name}` : 'Programme : restriction inconnue'}
              color={p ? p.color : COULEUR_INCONNUE}
              compact={compact}
            />
          );
        })}
      </div>
    );
  }

  if (groupIds.length === 0 && programIds.length === 0) {
    if (!showFree) return null;
    return (
      <div className="flex flex-wrap gap-1">
        <Badge label="Visible par toute la box" color={COULEUR_LIBRE} compact={compact} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {groupIds.map(id => {
        const g = groups.find(x => x.id === id);
        return g
          ? <Badge key={id} label={`Groupe : ${g.name}`} color={g.color} compact={compact} />
          : (
            <Badge
              key={id}
              label="Groupe : restriction inconnue"
              color={COULEUR_INCONNUE}
              compact={compact}
              title={`Restriction de groupe ${id} : le groupe n'est pas dans la liste chargée (supprimé, ou hors de cette box).`}
            />
          );
      })}
      {programIds.map(id => {
        const p = programs.find(x => x.id === id);
        return p
          ? <Badge key={id} label={`Programme : ${p.name}`} color={p.color} compact={compact} />
          : (
            <Badge
              key={id}
              label="Programme : restriction inconnue"
              color={COULEUR_INCONNUE}
              compact={compact}
              title={`Restriction de programme ${id} : le programme n'est pas dans la liste chargée (supprimé, ou hors de cette box).`}
            />
          );
      })}
    </div>
  );
}
