// Public app store links for the AthleX athlete app.
// ascAppId = 6762889282 (App Store), Android package = com.athlex.app.
export const APP_STORE_URL =
  process.env.NEXT_PUBLIC_APP_STORE_URL ?? 'https://apps.apple.com/app/id6762889282';
export const PLAY_STORE_URL =
  process.env.NEXT_PUBLIC_PLAY_STORE_URL ??
  'https://play.google.com/store/apps/details?id=com.athlex.app';

// Fiches publiées : les badges des pages publiques (/signup, /box/[slug],
// /rejoindre) sont des liens actifs vers les URLs ci-dessus. À false, ils
// redeviennent inertes avec la mention « bientôt disponible ».
export const STORES_LIVE = true;
