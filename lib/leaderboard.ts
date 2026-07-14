import { createServiceClient } from '@/lib/supabase/server';
import type { AthleteRow, BoxRow } from '@/components/landing/leaderboard';

const ATHLETE_LIMIT = 10;
const BOX_LIMIT = 10;

export async function getLeaderboards(): Promise<{
  athletes: AthleteRow[];
  boxes: BoxRow[];
}> {
  try {
    return await fetchLeaderboards();
  } catch {
    return { athletes: [], boxes: [] };
  }
}

async function fetchLeaderboards(): Promise<{
  athletes: AthleteRow[];
  boxes: BoxRow[];
}> {
  const supabase = createServiceClient();

  const [{ data: profiles }, { data: memberships }, { data: boxes }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, level, avatar_url, elo')
      .eq('role', 'member')
      .order('elo', { ascending: false })
      .limit(ATHLETE_LIMIT),
    supabase
      .from('box_members')
      .select('box_id, profiles(elo)')
      .eq('status', 'active'),
    supabase
      .from('boxes')
      .select('id, name, slug, city')
      .eq('is_active', true),
  ]);

  const athletes: AthleteRow[] = (profiles ?? []).map((p) => ({
    username: p.username ?? 'Athlète',
    level: p.level ?? null,
    avatar_url: p.avatar_url ?? null,
    elo: p.elo ?? 1000,
  }));

  // Aggregate average global ELO per box from active members.
  const agg = new Map<string, { sum: number; count: number }>();
  for (const m of memberships ?? []) {
    const boxId = (m as { box_id: string }).box_id;
    const prof = (m as { profiles: { elo: number } | { elo: number }[] | null }).profiles;
    const p = Array.isArray(prof) ? prof[0] : prof;
    const elo = p?.elo ?? 1000;
    const cur = agg.get(boxId) ?? { sum: 0, count: 0 };
    cur.sum += elo;
    cur.count += 1;
    agg.set(boxId, cur);
  }

  const boxRows: BoxRow[] = (boxes ?? [])
    .map((b) => {
      const a = agg.get(b.id);
      if (!a || a.count === 0) return null;
      return {
        name: b.name,
        city: b.city ?? null,
        slug: b.slug,
        avgElo: Math.round(a.sum / a.count),
        members: a.count,
      } satisfies BoxRow;
    })
    .filter((b): b is BoxRow => b !== null)
    .sort((a, b) => b.avgElo - a.avgElo)
    .slice(0, BOX_LIMIT);

  return { athletes, boxes: boxRows };
}
