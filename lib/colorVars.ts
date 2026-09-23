// ── Couleurs déclinées par thème, en variables CSS ──────────────────────────
//
// Le Whiteboard est écrit en dur en sombre, et le mode clair est obtenu par des
// surcharges CSS globales (`html.light .text-white { … }` dans `globals.css`).
// Ces surcharges portent sur des CLASSES : une couleur posée en `style={{ }}`
// leur échappe complètement.
//
// C'est le défaut qu'avaient les cartes reçues du Marketplace : leur teinte
// était un hex sombre en style en ligne, donc identique en clair, où elle ne
// tient pas le contraste. Les couleurs de piste auraient hérité du même défaut.
//
// La réponse est une variable CSS par couleur, déclarée deux fois dans
// `globals.css` (`:root` et `html.light`). `style={{ borderColor: 'var(--x)' }}`
// est valide, donc les appelants ne changent pas de forme — seule la valeur
// rendue change, et elle suit le thème.
//
// Les valeurs sombres sont celles de l'app athlète (`src/theme/hues.ts`) : deux
// palettes pour la même piste donneraient deux couleurs au même objet selon
// l'écran. Les valeurs claires sont leur équivalent assombri, qui tient sur
// fond blanc.

import type { Track } from '@/lib/autoProgramming';

/** Couleurs de piste. Clés alignées sur `TRACKS`. */
export const TRACK_COLOR_DARK: Record<Track, string> = {
  functional: '#10B981',
  hybrid: '#F97316',
  musculation: '#3B82F6',
};

export const TRACK_COLOR_LIGHT: Record<Track, string> = {
  functional: '#047857',
  hybrid: '#C2410C',
  musculation: '#1D4ED8',
};

/** Couleurs d'abonnement Marketplace, choisies par la box abonnée. */
export const SUB_COLOR_DARK = {
  sky: '#38BDF8',
  violet: '#8B5CF6',
  amber: '#F59E0B',
  rose: '#F43F5E',
  teal: '#14B8A6',
  orange: '#F97316',
  lime: '#84CC16',
  fuchsia: '#D946EF',
} as const;

export const SUB_COLOR_LIGHT: Record<keyof typeof SUB_COLOR_DARK, string> = {
  sky: '#0369A1',
  violet: '#6D28D9',
  amber: '#B45309',
  rose: '#BE123C',
  teal: '#0F766E',
  orange: '#C2410C',
  lime: '#4D7C0F',
  fuchsia: '#A21CAF',
};

/** `var(--track-functional)` — à poser tel quel dans un style en ligne. */
export function trackColorVar(track: Track, usage: 'marker' | 'text' = 'marker'): string {
  return usage === 'text' ? `var(--ax-track-${track}-text)` : `var(--track-${track})`;
}

/** Fond atténué de la même teinte, sans concaténer un alpha à un `var()`. */
export function softVar(cssVar: string, opacity = 0.16): string {
  return `color-mix(in srgb, ${cssVar} ${opacity * 100}%, transparent)`;
}

export function subColorVar(color: string | null | undefined, usage: 'marker' | 'text' = 'marker'): string {
  const key = (color ?? '') in SUB_COLOR_DARK ? (color as keyof typeof SUB_COLOR_DARK) : 'sky';
  return usage === 'text' ? `var(--ax-sub-${key}-text)` : `var(--sub-${key})`;
}
