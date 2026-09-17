import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { REVEAL_COLUMNS, validateAutoProgrammingPatch } from '@/lib/autoProgramming';

/**
 * Interrupteur de programmation automatique d'une box (lot J2).
 *
 * `boxes.auto_programming` et `auto_programming_tracks` sont fermés par le
 * trigger `boxes_auto_programming_guard` : seuls le backend (`service_role`)
 * et un profil `admin` / `super_admin` peuvent les changer. La route revérifie
 * le rôle **et** écrit en service role, comme `/api/admin/boxes`.
 *
 * Le refus du trigger (`42501`) n'est pas contourné : il est rendu tel quel,
 * avec son message, pour qu'une garde qui se referme se voie.
 */

async function checkAdmin() {
  const user = await getServerUser();
  if (!user) return null;
  const service = createServiceClient();
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) return null;
  return user;
}

/** La base ne connaît pas encore la colonne (migration non appliquée). */
function isMissingColumn(error: { code?: string | null } | null): boolean {
  return !!error && (error.code === '42703' || error.code === 'PGRST204');
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const { id } = await params;
  const { errors, patch } = validateAutoProgrammingPatch(await req.json().catch(() => null));
  if (errors.length) return NextResponse.json({ error: errors.join(' · ') }, { status: 400 });

  const supabase = createServiceClient();
  const columns = 'id, auto_programming, auto_programming_tracks';

  const write = (body: Record<string, unknown>) =>
    supabase.from('boxes').update(body).eq('id', id).select(columns).single();

  let { data, error } = await write(patch as Record<string, unknown>);

  // Le réglage de révélation arrive avec la migration `20261221` d'athlex-app.
  // Tant qu'elle n'est pas appliquée, on écrit quand même l'interrupteur et les
  // pistes, et on dit que la révélation n'a pas été enregistrée — plutôt que de
  // perdre tout le PATCH, ou de laisser croire que le réglage est pris.
  let revealSaved = REVEAL_COLUMNS.some((c) => c in patch);
  if (isMissingColumn(error)) {
    const withoutReveal = Object.fromEntries(
      Object.entries(patch).filter(([k]) => !(REVEAL_COLUMNS as readonly string[]).includes(k)),
    );
    revealSaved = false;
    if (Object.keys(withoutReveal).length === 0) {
      return NextResponse.json({
        error: "Le réglage de révélation n'existe pas encore sur cette base "
          + '(migration `20261221` non appliquée).',
      }, { status: 409 });
    }
    ({ data, error } = await write(withoutReveal));
  }

  if (error) {
    // `42501` = le trigger `boxes_auto_programming_guard` a refusé l'écriture.
    const guarded = error.code === '42501';
    return NextResponse.json({
      error: guarded
        ? `Refus du trigger boxes_auto_programming_guard : ${error.message}`
        : error.message,
    }, { status: guarded ? 403 : 500 });
  }
  if (!data) return NextResponse.json({ error: 'Box introuvable' }, { status: 404 });

  return NextResponse.json({ ...data, reveal_saved: revealSaved });
}
