'use client';

import { fixedUnitFor, unitChoicesFor, type MovementUnit } from '@/lib/movements';

/**
 * Unité d'une ligne de mouvement du catalogue, toujours visible. Sélecteur
 * pour un mouvement qui en a plusieurs (Row, SkiErg, Bike Erg : cal ou m) ;
 * sinon l'unité fixe en texte discret, à la même place (« m » pour Run,
 * « reps » pour Thruster). Rien hors catalogue. Partagé par l'éditeur de WOD
 * de tournoi et celui du Whiteboard.
 */
export default function MovementUnitSelect({
  name,
  unit,
  disabled,
  onChange,
  className,
}: {
  /** Nom du mouvement de la ligne. */
  name: string;
  /** Unité actuelle de la ligne (l'unité par défaut du catalogue pour un nombre nu). */
  unit: MovementUnit;
  /** Sans quantité, une unité n'a pas de sens : le choix est désactivé. */
  disabled?: boolean;
  onChange: (unit: MovementUnit) => void;
  className?: string;
}) {
  const choices = unitChoicesFor(name);
  if (choices.length === 0) {
    const fixed = fixedUnitFor(name);
    if (!fixed) return null;
    // Sans quantité, l'unité qu'aura la ligne : celle du catalogue.
    return (
      <span title="Unité" className="w-20 shrink-0 px-2 text-center text-xs text-ax-text-muted">
        {disabled ? fixed : unit}
      </span>
    );
  }
  return (
    <select
      aria-label="Unité"
      title={disabled ? 'Saisis d’abord une quantité' : 'Unité'}
      className={className}
      value={choices.includes(unit) ? unit : choices[0]}
      disabled={disabled}
      onChange={e => onChange(e.target.value as MovementUnit)}
    >
      {choices.map(u => (
        <option key={u} value={u} className="text-ax-text bg-ax-surface">{u}</option>
      ))}
    </select>
  );
}
