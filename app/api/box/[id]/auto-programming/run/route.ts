import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerUser } from '@/lib/supabase/server';
import { isBoxStaff } from '@/lib/authz/boxStaff';
import { isTrack, type Track } from '@/lib/autoProgramming';

/**
 * Déclenche `generate-box-week` pour une box, depuis le Whiteboard.
 *
 * Jamais depuis le client : la fonction est fermée par `CRON_SECRET`
 * (fail-closed côté fonction), et ce secret n'a rien à faire dans un bundle
 * navigateur. La route porte donc trois choses que le client ne peut pas
 * porter : le contrôle owner/coach, le secret, et l'agrégation des appels.
 *
 *   mode `next`  → corps `{ box_id }` : la semaine ISO suivante, cette box.
 *   mode `regen` → un appel **par piste active**, corps
 *                  `{ regen: { box_id, track }, iso_year, iso_week }`.
 *                  La fonction ne régénère qu'une piste à la fois.
 *
 * Les jours déjà scorés ou modifiés à la main sont conservés par le moteur
 * (`runWeekGeneration` garde les dates dont la ligne a `edited_at` ou un
 * score) : la route ne le rejoue pas, elle le dit à l'utilisateur en amont.
 */

interface Outcome {
  box_id: string;
  track: string;
  iso_year: number;
  iso_week: number;
  status: 'done' | 'kept' | 'error' | 'running' | 'skipped';
  inserted?: number;
  kept_dates?: string[];
  error?: string;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { id } = await params;
  const service = createServiceClient();
  if (!(await isBoxStaff(service, user.id, id))) {
    return NextResponse.json({ error: 'Non autorisé pour cette box.' }, { status: 403 });
  }

  const cronSecret = process.env.CRON_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!cronSecret) {
    return NextResponse.json({
      error: "CRON_SECRET absente côté serveur : la génération est impossible. "
        + "Ajoute-la aux variables d'environnement du Manager.",
    }, { status: 500 });
  }
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: 'Configuration Supabase incomplète côté serveur.' }, { status: 500 });
  }

  const body = await req.json().catch(() => null) as
    { mode?: unknown; iso_year?: unknown; iso_week?: unknown } | null;
  const mode = body?.mode === 'regen' ? 'regen' : 'next';

  const { data: box } = await service
    .from('boxes')
    .select('auto_programming, auto_programming_tracks')
    .eq('id', id)
    .single();
  if (!box) return NextResponse.json({ error: 'Box introuvable' }, { status: 404 });
  if (box.auto_programming !== true) {
    return NextResponse.json({ error: "La programmation automatique est éteinte pour cette box." }, { status: 409 });
  }
  const tracks = ((box.auto_programming_tracks as string[] | null) ?? []).filter(isTrack) as Track[];
  if (tracks.length === 0) {
    return NextResponse.json({ error: 'Aucune piste active sur cette box.' }, { status: 409 });
  }

  // Un appel par piste en régénération, un seul appel sinon.
  let bodies: Record<string, unknown>[];
  if (mode === 'regen') {
    const iso_year = Number(body?.iso_year);
    const iso_week = Number(body?.iso_week);
    if (!Number.isInteger(iso_year) || !Number.isInteger(iso_week) || iso_week < 1 || iso_week > 53) {
      return NextResponse.json({ error: 'Semaine ISO invalide.' }, { status: 400 });
    }
    bodies = tracks.map((track) => ({ regen: { box_id: id, track }, iso_year, iso_week }));
  } else {
    bodies = [{ box_id: id }];
  }

  const url = `${supabaseUrl}/functions/v1/generate-box-week`;
  const outcomes: Outcome[] = [];
  const failures: string[] = [];

  for (const payload of bodies) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          'x-cron-secret': cronSecret,
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
      });
    } catch (e) {
      failures.push(e instanceof Error ? e.message : String(e));
      continue;
    }
    const json = await res.json().catch(() => ({})) as
      { error?: string; outcomes?: Outcome[] };
    if (!res.ok) {
      failures.push(json.error ?? `HTTP ${res.status}`);
      continue;
    }
    outcomes.push(...(json.outcomes ?? []));
  }

  // Un échec partiel reste un échec visible : on ne rend pas « ok » parce que
  // l'un des deux appels a réussi.
  const engineErrors = outcomes.filter((o) => o.status === 'error');
  const ok = failures.length === 0 && engineErrors.length === 0;

  return NextResponse.json({
    ok,
    mode,
    tracks,
    done: outcomes.filter((o) => o.status === 'done').length,
    kept: outcomes.filter((o) => o.status === 'kept').length,
    inserted: outcomes.reduce((n, o) => n + (o.inserted ?? 0), 0),
    kept_days: [...new Set(outcomes.flatMap((o) => o.kept_dates ?? []))].sort(),
    outcomes,
    errors: [...failures, ...engineErrors.map((o) => `${o.track} : ${o.error ?? 'erreur'}`)],
  }, { status: ok ? 200 : 502 });
}
