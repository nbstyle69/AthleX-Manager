// Public app store links for the AthleX athlete app.
// ascAppId = 6762889282 (App Store), Android package = com.athlex.app.
export const APP_STORE_URL =
  process.env.NEXT_PUBLIC_APP_STORE_URL ?? 'https://apps.apple.com/app/id6762889282';
export const PLAY_STORE_URL =
  process.env.NEXT_PUBLIC_PLAY_STORE_URL ??
  'https://play.google.com/store/apps/details?id=com.athlex.app';

// Les fiches ne sont pas encore publiées : les badges s'affichent, ne cliquent
// pas, et portent la mention « bientôt disponible ». Le jour de la validation
// boutique, passer ce booléen à true suffit — les URLs ci-dessus sont déjà les bonnes.
export const STORES_LIVE = false;
