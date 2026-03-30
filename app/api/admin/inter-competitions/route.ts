import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { calculatePairwiseDeltas } from '@/lib/elo';

async function checkAdmin() {
  const user = await getServerUser();
  if (!user) return null;
  const service = createServiceClient();
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) return null;
  return user;
}

// PATCH — advance status or close with ELO
export async function PATCH(req: NextRequest) {
  const user = await checkAdmin();
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const body = await req.json();
  const { action, competition_id } = body;
  const service = createServiceClient();

  if (action === 'advance') {
    const { data: comp } = await service
      .from('inter_competitions')
      .select('id, status')
      .eq('id', competition_id)
      .single();
    if (!comp) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const STATUS_NEXT: Record<string, string> = {
      draft: 'open', open: 'active', active: 'closed', closed: 'closed',
    };
    const next = STATUS_NEXT[comp.status] ?? comp.status;
    if (next === comp.status) return NextResponse.json({ error: 'Already at final status' }, { status: 400 });

    // If closing (active → closed), calculate ELO
    if (comp.status === 'active' && next === 'closed') {
      // Get all validated scores for this competition
      const { data: allScores } = await service
        .from('inter_scores')
        .select('athlete_id, wod_id, score_value')
        .eq('competition_id', competition_id)
        .eq('status', 'validated');

      if (allScores && allScores.length > 0) {
        // Get unique WODs
        const wodIds = [...new Set(allScores.map((s: any) => s.wod_id))];

        // Calculate ranking points per athlete across all WODs
        // For each WOD: rank athletes, assign points (1st = 100, 2nd = 95, etc.)
        const athletePoints: Record<string, number> = {};
        const athleteWodCount: Record<string, number> = {};

        for (const wodId of wodIds) {
          const wodScores = allScores
            .filter((s: any) => s.wod_id === wodId)
            .sort((a: any, b: any) => b.score_value - a.score_value);

          for (let i = 0; i < wodScores.length; i++) {
            const aid = wodScores[i].athlete_id;
            // Handle ties
            let rank = i + 1;
            if (i > 0 && wodScores[i].score_value === wodScores[i - 1].score_value) {
              // Find the first athlete with the same score
              let j = i - 1;
              while (j >= 0 && wodScores[j].score_value === wodScores[i].score_value) j--;
              rank = j + 2;
            }
            const points = Math.max(0, 100 - (rank - 1) * 5);
            athletePoints[aid] = (athletePoints[aid] ?? 0) + points;
            athleteWodCount[aid] = (athleteWodCount[aid] ?? 0) + 1;
          }
        }

        // Build overall ranking from total points
        const overallRanking = Object.entries(athletePoints)
          .map(([athlete_id, points]) => ({ athlete_id, points }))
          .sort((a, b) => b.points - a.points);

        // Assign overall ranks (handle ties)
        const ranked: { athlete_id: string; rank: number; elo: number }[] = [];
        for (let i = 0; i < overallRanking.length; i++) {
          let rank = i + 1;
          if (i > 0 && overallRanking[i].points === overallRanking[i - 1].points) {
            rank = ranked[i - 1]?.rank ?? rank;
          }
          ranked.push({ athlete_id: overallRanking[i].athlete_id, rank, elo: 0 });
        }

        if (ranked.length >= 2) {
          // Fetch current ELO
          const athleteIds = ranked.map(r => r.athlete_id);
          const { data: profiles } = await service
            .from('profiles')
            .select('id, elo, wins, total_matches')
            .in('id', athleteIds);

          if (profiles) {
            const profileMap: Record<string, { elo: number; wins: number; total_matches: number }> = {};
            for (const p of profiles) {
              profileMap[p.id] = { elo: p.elo ?? 1000, wins: p.wins ?? 0, total_matches: p.total_matches ?? 0 };
            }

            // Build players array for shared utility
            const players = ranked.map(r => ({
              id: r.athlete_id,
              elo: profileMap[r.athlete_id]?.elo ?? 1000,
              rank: r.rank,
            }));

            const deltas = calculatePairwiseDeltas(players);

            // Apply ELO updates
            for (const d of deltas) {
              const pm = profileMap[d.id];
              if (!pm) continue;
              const newElo = pm.elo + d.delta;
              await service.from('profiles').update({
                elo: newElo,
                total_matches: pm.total_matches + 1,
                ...(d.rank === 1 ? { wins: pm.wins + 1 } : {}),
              }).eq('id', d.id);
            }
          }
        }
      }
    }

    // Update status
    const { error } = await service.from('inter_competitions').update({ status: next }).eq('id', competition_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, newStatus: next });
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
}
