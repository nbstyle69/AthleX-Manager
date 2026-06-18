// ── Shared ELO Calculation Utilities (Admin BO mirror) ───────────────────────
// Mirrored from mobile app src/utils/elo.ts — keep in sync.

export const K_PAIRWISE = 64;
export const K_TOURNAMENT = 48;
export const ELO_FLOOR = 100;

export interface RankedPlayer {
  id: string;
  elo: number;
  rank: number;
}

export interface EloResult extends RankedPlayer {
  delta: number;
}

export function calculatePairwiseDeltas(
  players: RankedPlayer[],
  k: number = K_PAIRWISE,
): EloResult[] {
  const n = players.length;
  if (n < 2) return players.map(p => ({ ...p, delta: 0 }));

  return players.map(player => {
    let expectedScore = 0;
    let actualScore = 0;

    for (const opponent of players) {
      if (opponent.id === player.id) continue;
      expectedScore += 1 / (1 + Math.pow(10, (opponent.elo - player.elo) / 400));
      if (player.rank < opponent.rank) actualScore += 1;
      else if (player.rank === opponent.rank) actualScore += 0.5;
    }

    const delta = Math.round((k / (n - 1)) * (actualScore - expectedScore));
    return { ...player, delta };
  });
}

export function clampElo(elo: number): number {
  return Math.max(ELO_FLOOR, elo);
}
