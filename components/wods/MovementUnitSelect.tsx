'use client';

import { unitChoicesFor, type MovementUnit } from '@/lib/movements';

/**
 * Choix de l'unité d'une ligne de mouvement, parmi les unités permises au
 * catalogue. N'apparaît que pour un mouvement qui en a plusieurs (Row, SkiErg,
 * Bike Erg : cal ou m) : ailleurs il n'y a rien à choisir, et le sélecteur
 * encombrerait la ligne. Partagé par l'éditeur de WOD de tournoi et celui du
 * Whiteboard.
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
  if (choices.length === 0) return null;
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
        <option key={u} value={u} className="text-black">{u}</option>
      ))}
    </select>
  );
}
