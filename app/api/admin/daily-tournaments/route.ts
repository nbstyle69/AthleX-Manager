import { NextRequest, NextResponse } from 'next/server';
import { getServerUser, createServiceClient } from '@/lib/supabase/server';
import { K_PAIRWISE } from '@/lib/elo';

async function checkAdmin() {
  const user = await getServerUser();
  if (!user) return null;
  const service = createServiceClient();
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) return null;
  return user;
}

// PATCH — update tournament status or score
export async function PATCH(req: NextRequest) {
  const user = await checkAdmin();
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const body = await req.json();
  const { action, tournament_id, score_id, score_value, status: newStatus } = body;
  const service = createServiceClient();

  if (action === 'close') {
    // 1. Get tournament info
    const { data: tourney } = await service
      .from('daily_tournaments')
      .select('id, score_mode, elo_reward')
      .eq('id', tournament_id)
      .single();
    if (!tourney) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });

    // 2. Get all scores sorted by score_value
    const { data: allScores } = await service
      .from('daily_tournament_scores')
      .select('user_id, score_value')
      .eq('tournament_id', tournament_id)
      .order('score_value', { ascending: tourney.score_mode === 'time' });

    // 3. Calculate & apply ELO if at least 2 scores
    if (allScores && allScores.length >= 2) {
      const K = K_PAIRWISE;
      const userIds = allScores.map((s: any) => s.user_id);
      const { data: profiles } = await service
        .from('profiles')
        .select('id, elo, wins, total_matches')
        .in('id', userIds);

      if (profiles) {
        const profileMap: Record<string, { elo: number; wins: number; total_matches: number }> = {};
        for (const p of profiles) {
          profileMap[p.id] = { elo: p.elo ?? 1000, wins: p.wins ?? 0, total_matches: p.total_matches ?? 0 };
        }

        // Assign ranks (handle ties)
        const ranked: { user_id: string; elo: number; rank: number }[] = [];
        for (let i = 0; i < allScores.length; i++) {
          let rank = i + 1;
          if (i > 0 && allScores[i].score_value === allScores[i - 1].score_value) {
            rank = ranked[i - 1]?.rank ?? rank;
          }
          ranked.push({
            user_id: allScores[i].user_id,
            elo: profileMap[allScores[i].user_id]?.elo ?? 1000,
            rank,
          });
        }

        // Calculate ELO deltas (pairwise expected vs actual)
        const n = ranked.length;
        const deltas = ranked.map(player => {
          let expectedScore = 0;
          let actualScore = 0;
          for (const opp of ranked) {
            if (opp.user_id === player.user_id) continue;
            expectedScore += 1 / (1 + Math.pow(10, (opp.elo - player.elo) / 400));
            if (player.rank < opp.rank) actualScore += 1;
            else if (player.rank === opp.rank) actualScore += 0.5;
          }
          const delta = Math.round((K / (n - 1)) * (actualScore - expectedScore));
          return { ...player, delta };
        });

        // Update profiles + write ELO history
        const historyRows = [];
        for (const d of deltas) {
          const pm = profileMap[d.user_id];
          if (!pm) continue;
          const newElo = pm.elo + d.delta;
          const updatePayload: Record<string, number> = {
            elo: newElo,
            total_matches: pm.total_matches + 1,
          };
          if (d.rank === 1) updatePayload.wins = pm.wins + 1;
          await service.from('profiles').update(updatePayload).eq('id', d.user_id);

          historyRows.push({
            tournament_id,
            user_id: d.user_id,
            elo_before: pm.elo,
            elo_after: newElo,
            elo_delta: d.delta,
            final_rank: d.rank,
          });
        }

        if (historyRows.length > 0) {
          await service.from('daily_tournament_elo_history').upsert(historyRows, {
            onConflict: 'tournament_id,user_id',
          });
        }
      }
    }

    // 4. Mark tournament completed
    const { error } = await service.from('daily_tournaments').update({ status: 'completed' }).eq('id', tournament_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'cancel') {
    const { error } = await service.from('daily_tournaments').update({ status: 'cancelled' }).eq('id', tournament_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'reopen') {
    // Revert ELO changes if they were applied
    const { data: history } = await service
      .from('daily_tournament_elo_history')
      .select('user_id, elo_before, elo_delta, final_rank')
      .eq('tournament_id', tournament_id);

    if (history && history.length > 0) {
      for (const h of history) {
        const { data: prof } = await service.from('profiles').select('elo, wins, total_matches').eq('id', h.user_id).single();
        if (!prof) continue;
        const revert: Record<string, number> = {
          elo: prof.elo - h.elo_delta,
          total_matches: Math.max(0, (prof.total_matches ?? 1) - 1),
        };
        if (h.final_rank === 1) revert.wins = Math.max(0, (prof.wins ?? 1) - 1);
        await service.from('profiles').update(revert).eq('id', h.user_id);
      }
      await service.from('daily_tournament_elo_history').delete().eq('tournament_id', tournament_id);
    }

    const { error } = await service.from('daily_tournaments').update({ status: 'open' }).eq('id', tournament_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'update_score_status') {
    if (!score_id || !newStatus) return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    const { error } = await service.from('daily_tournament_scores').update({ status: newStatus }).eq('id', score_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'update_score_value') {
    if (!score_id || score_value === undefined) return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    const { error } = await service.from('daily_tournament_scores').update({ score_value: Number(score_value) }).eq('id', score_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'delete_score') {
    if (!score_id) return NextResponse.json({ error: 'Missing score_id' }, { status: 400 });
    const { error } = await service.from('daily_tournament_scores').delete().eq('id', score_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
}

// DELETE — delete a tournament entirely
export async function DELETE(req: NextRequest) {
  const user = await checkAdmin();
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const service = createServiceClient();
  const { error } = await service.from('daily_tournaments').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
