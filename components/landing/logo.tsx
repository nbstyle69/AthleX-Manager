/**
 * Marque des pages publiques, identique à celle de la landing
 * (components/landing-gym/header.tsx, `Brand`) : pictogramme clair et
 * « ATHLEX » en police d'affichage. Les pages publiques sont toujours sombres.
 */
export function Logo() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/athex-mark-light.png" alt="" width={34} height={34} />
      <span>ATHLEX</span>
    </>
  );
}
