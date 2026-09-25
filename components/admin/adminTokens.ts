/**
 * Couleurs du super-admin qui n'ont pas de classe `ax-*` toute faite
 * (lot 7a). Toutes viennent des jetons de `globals.css`, avec leur variante
 * claire : le sens reste le même dans les deux thèmes.
 */

/** Fond doux violet, au même dosage que les autres `--ax-*-soft`. */
export const PURPLE_SOFT = 'bg-[color-mix(in_srgb,var(--ax-purple)_12%,var(--ax-surface))]';
/** Orange (boxs) : texte et fond doux. */
export const SUB_ORANGE_TEXT = 'text-[color:var(--ax-sub-orange-text)]';
export const SUB_ORANGE_SOFT = 'bg-[color-mix(in_srgb,var(--ax-sub-orange-text)_12%,var(--ax-surface))]';

/**
 * Niveaux : les couleurs de niveau de l'application (`--ax-level-*`), comme
 * la page Statistiques du dashboard depuis le lot 6b.
 */
export const ADMIN_LEVEL_COLOR: Record<string, string> = {
  pro: 'var(--ax-level-pro)',
  gx: 'var(--ax-level-gx)',
  'rx+': 'var(--ax-level-rx-plus)',
  rx: 'var(--ax-level-rx)',
  inter: 'var(--ax-level-inter)',
  scaled: 'var(--ax-level-scaled)',
};

/** Pastille de filtre ou d'onglet, choisie ou non. */
export const chipClass = (on: boolean) =>
  `rounded-ax-control border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus motion-reduce:transition-none ${
    on
      ? 'border-ax-accent-text bg-ax-accent-soft text-ax-accent-text'
      : 'border-ax-border bg-transparent text-ax-text-secondary hover:bg-ax-hover hover:text-ax-text'
  }`;
