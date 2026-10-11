import type { NextRequest } from 'next/server';
import { getServerUser, userFromAccessToken } from '@/lib/supabase/server';

/**
 * L'appelant d'une route membre : la session cookie du site, ou l'en-tête
 * `Authorization: Bearer <jeton de session Supabase>` de l'app mobile (qui n'a
 * pas de cookie). Le jeton est vérifié par GoTrue (`/auth/v1/user`) exactement
 * comme le cookie. Un en-tête présent fait seul foi : un jeton invalide n'est
 * pas rattrapé par un cookie. Aucun identifiant n'est jamais lu dans le corps.
 *
 * Réservé aux routes membres du changement de formule et de son portail.
 */
export async function getRequestUser(req: NextRequest): Promise<{ id: string; email?: string } | null> {
  const header = req.headers.get('authorization');
  if (header != null) {
    const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
    return m ? userFromAccessToken(m[1]) : null;
  }
  return getServerUser();
}
