/**
 * Plafond par adresse IP pour le tunnel Essai public.
 *
 * Pourquoi ici et pas en base : la base ne voit pas l'adresse du visiteur.
 * `inet_client_addr()` rend l'adresse du client PostgreSQL (PostgREST), et
 * `request.headers` n'est pas mesurable depuis SQL sans déployer. Le plafond
 * par e-mail, lui, vit en base — il est prouvable, celui-ci ne l'est pas de la
 * même façon.
 *
 * Sa limite, nommée plutôt que supposée : le compteur est en mémoire, donc
 * propre à l'instance qui sert la requête. Sur plusieurs instances, une rafale
 * répartie passe plus de coups que le plafond nominal. C'est un ralentisseur,
 * pas une serrure — la serrure est le dédoublonnage et le plafond par e-mail
 * en base, qui sont eux inévitables.
 */

const hits = new Map<string, number[]>();

/** Purge paresseuse : sans elle la Map grossit à chaque IP jamais revue. */
function prune(now: number, windowMs: number) {
  for (const [key, stamps] of hits) {
    const kept = stamps.filter((t) => now - t < windowMs);
    if (kept.length === 0) hits.delete(key);
    else hits.set(key, kept);
  }
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    // Le premier maillon est le client ; les suivants sont les proxys.
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip')?.trim() || 'inconnue';
}

export interface RateVerdict {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function takeToken(
  bucket: string,
  ip: string,
  max: number,
  windowMs: number,
): RateVerdict {
  const now = Date.now();
  prune(now, windowMs);

  const key = `${bucket}:${ip}`;
  const stamps = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

  if (stamps.length >= max) {
    const oldest = Math.min(...stamps);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }

  stamps.push(now);
  hits.set(key, stamps);
  return { allowed: true, retryAfterSeconds: 0 };
}
