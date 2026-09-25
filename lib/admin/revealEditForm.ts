/**
 * Catalogue des mouvements, sous 1280 px (lot 7b) : la fiche d'édition est
 * au-dessus du tableau. Toucher une ligne basse ouvrait la fiche hors de la
 * vue ; on y fait défiler la page et on met le focus sur son premier champ.
 * Au-dessus de 1280 px, la fiche est à côté du tableau : rien ne change.
 */

/** Même seuil que la classe `xl:` de Tailwind qui met la fiche à côté. */
export const SIDE_BY_SIDE_QUERY = '(min-width: 1280px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

type MatchMedia = (query: string) => { matches: boolean };

export interface RevealTarget {
  scrollIntoView(options: ScrollIntoViewOptions): void;
  querySelector(selector: string): { focus(options?: FocusOptions): void } | null;
}

/** Vrai si la fiche a été amenée à l'écran (sous 1280 px), faux sinon. */
export function revealEditForm(form: RevealTarget | null, matchMedia: MatchMedia): boolean {
  if (!form || matchMedia(SIDE_BY_SIDE_QUERY).matches) return false;
  form.scrollIntoView({ block: 'start', behavior: matchMedia(REDUCED_MOTION_QUERY).matches ? 'auto' : 'smooth' });
  // Le défilement est déjà fait : le focus ne doit pas en relancer un.
  form.querySelector('input, select, textarea')?.focus({ preventScroll: true });
  return true;
}
