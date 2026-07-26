export interface BracketMatchRow {
  round: number;
  side: string | null;
  participant1_id: string | null;
  participant2_id: string | null;
  winner_id: string | null;
  loser_id: string | null;
  status: string;
}

export interface BracketStanding {
  athlete_id: string;
  rank: number;
  eliminatedRound: number | null; // null = champion (never lost)
  placement: string;
}

const DISTANCE_LABEL = ['Finaliste', 'Demi-finaliste', 'Quart de finaliste', '8e de finale', '16e de finale', '32e de finale'];

function placementLabel(eliminatedRound: number | null, maxRound: number, isChampion: boolean): string {
  if (isChampion) return 'Champion';
  if (eliminatedRound === null) return 'En lice'; // still competing (bracket not finished)
  const distance = maxRound - eliminatedRound;
  return DISTANCE_LABEL[distance] ?? `Round ${eliminatedRound}`;
}

/**
 * Derive the final standings of a single-elimination bracket from its matches.
 *
 * Placement follows competition ranking: the champion is 1st, the finalist 2nd,
 * both semi-final losers share 3rd, the four quarter-final losers share 5th, etc.
 * Athletes eliminated in the same round get the same rank (1-2-3-3-5-5-5-5…),
 * which keeps ELO fair for tied placements.
 *
 * Only winner-side matches are considered (loser bracket / grand final ignored),
 * so it targets the `bracket` (direct elimination) format.
 */
export function computeBracketStandings(matches: BracketMatchRow[]): BracketStanding[] {
  const wb = matches.filter(m => m.side == null || m.side === 'winner');
  if (wb.length === 0) return [];

  const maxRound = Math.max(...wb.map(m => m.round));

  const participants = new Set<string>();
  for (const m of wb) {
    if (m.participant1_id) participants.add(m.participant1_id);
    if (m.participant2_id) participants.add(m.participant2_id);
  }

  // Round in which each athlete was eliminated (lost a match).
  const eliminatedRound = new Map<string, number>();
  for (const m of wb) {
    if (m.loser_id) {
      const prev = eliminatedRound.get(m.loser_id);
      // Keep the latest round they lost in (they can only lose once, but be safe).
      if (prev == null || m.round > prev) eliminatedRound.set(m.loser_id, m.round);
    }
  }

  // Champion = winner of the final (highest-round decided match) who never lost.
  const finalMatch = wb.find(m => m.round === maxRound && m.winner_id);
  const championId = finalMatch && !eliminatedRound.has(finalMatch.winner_id!) ? finalMatch.winner_id! : null;

  const standings = [...participants].map(id => ({
    athlete_id: id,
    isChampion: id === championId,
    eliminatedRound: eliminatedRound.get(id) ?? null,
  }));

  // Sort: champion first, then any still-in athlete (no loss yet, bracket running),
  // then by latest elimination round first.
  const rankKey = (s: { isChampion: boolean; eliminatedRound: number | null }) =>
    s.isChampion ? Number.POSITIVE_INFINITY
      : s.eliminatedRound === null ? maxRound + 0.5
      : s.eliminatedRound;
  standings.sort((a, b) => rankKey(b) - rankKey(a));

  // Assign competition ranks (ties share a rank; next block skips accordingly).
  const result: BracketStanding[] = [];
  let processed = 0;
  let i = 0;
  while (i < standings.length) {
    let j = i;
    while (j < standings.length && rankKey(standings[j]) === rankKey(standings[i])) j++;
    const rank = processed + 1;
    for (let k = i; k < j; k++) {
      result.push({
        athlete_id: standings[k].athlete_id,
        rank,
        eliminatedRound: standings[k].eliminatedRound,
        placement: placementLabel(standings[k].eliminatedRound, maxRound, standings[k].isChampion),
      });
    }
    processed += j - i;
    i = j;
  }

  return result;
}
