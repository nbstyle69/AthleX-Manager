import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';

/**
 * Comparaison d'un chiffre avec la période précédente.
 *
 * `goodWhenUp = false` pour les chiffres qu'on veut voir baisser (impayés,
 * résiliations) : la flèche garde son sens (le chiffre monte), mais la couleur
 * suit l'intérêt du gérant, pas l'arithmétique.
 *
 * Un passage de 0 à quelque chose n'a pas de pourcentage : on affiche la
 * variation brute plutôt qu'un « +∞ % » qui ne veut rien dire.
 */
export default function Delta({
  current,
  previous,
  goodWhenUp = true,
  suffix = '',
}: {
  current: number;
  previous: number;
  goodWhenUp?: boolean;
  suffix?: string;
}) {
  const diff = current - previous;

  if (diff === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500">
        <ArrowRight size={12} />
        stable
      </span>
    );
  }

  const up = diff > 0;
  const good = up === goodWhenUp;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const label = previous === 0
    ? `${up ? '+' : ''}${diff}${suffix}`
    : `${up ? '+' : ''}${Math.round((diff / Math.abs(previous)) * 100)} %`;

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${good ? 'text-emerald-400' : 'text-red-400'}`}>
      <Icon size={12} />
      {label}
    </span>
  );
}
