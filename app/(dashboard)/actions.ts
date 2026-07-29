'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { ACTIVE_BOX_COOKIE, createClient, getOwnerBoxes } from '@/lib/supabase/server';

/**
 * Sets the active box for the multi-box back-office. Rejects any box the
 * current user does not administrate (guards against a forged cookie / IDOR).
 */
export async function setActiveBox(boxId: string): Promise<void> {
  const supabase = await createClient();
  const boxes = await getOwnerBoxes(supabase);
  if (!boxes.some((b) => b.id === boxId)) return;

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BOX_COOKIE, boxId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath('/', 'layout');
}
