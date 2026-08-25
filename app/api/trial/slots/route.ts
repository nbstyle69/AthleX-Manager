import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { clientIp, takeToken } from '@/lib/trialRateLimit';

/**
 * Calendrier public des créneaux ouverts à l'essai.
 *
 * La clé utilisée est la clé **publique** : aucun privilège de service n'entre
 * dans ce tunnel. `anon` ne peut lire ni `class_schedules` ni
 * `class_reservations` — la lecture passe donc par `list_public_trial_slots()`,
 * qui décide seule ce qui sort (créneaux à venir, non complets, aucune donnée
 * d'adhérent).
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  const verdict = takeToken('trial-slots', ip, 30, 10 * 60 * 1000);
  if (!verdict.allowed) {
    return NextResponse.json(
      { ok: false, reason: 'trop_de_requetes' },
      { status: 429, headers: { 'Retry-After': String(verdict.retryAfterSeconds) } },
    );
  }

  const body = await req.json().catch(() => null);
  const boxId = typeof body?.box_id === 'string' ? body.box_id : '';
  if (!boxId) {
    return NextResponse.json({ ok: false, reason: 'box_absente' }, { status: 400 });
  }

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );

  const { data, error } = await supabase.rpc('list_public_trial_slots', {
    p_box_id: boxId,
    p_days: 21,
  });

  // Une panne de lecture ne se déguise pas en « aucun créneau » : un calendrier
  // vide et un calendrier inaccessible ne disent pas la même chose au visiteur.
  if (error) {
    console.error('list_public_trial_slots', error.message);
    return NextResponse.json({ ok: false, reason: 'lecture_impossible' }, { status: 502 });
  }

  return NextResponse.json(data);
}
