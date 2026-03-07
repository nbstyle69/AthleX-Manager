const CF_GAMES_POINTS = [
  100,97,95,93,91,89,87,85,83,81,
  79,77,75,73,71,69,67,65,63,61,
  60,59,58,57,56,55,54,53,52,51,
  50,49,48,47,46,45,44,43,42,41,
  40,39,38,37,36,35,34,33,32,31,
];

export function cfPoints(rank: number): number {
  return CF_GAMES_POINTS[rank - 1] ?? Math.max(1, 30 - (rank - 51));
}

export function rankWODScores(scores: any[], wodType: string) {
  const sorted = [...scores].sort((a, b) => {
    const av = parseFloat(a.score_value) || 0;
    const bv = parseFloat(b.score_value) || 0;
    return wodType === 'For Time' ? av - bv : bv - av;
  });
  let rank = 1;
  return sorted.map((s, i) => {
    if (i > 0) {
      const prev = sorted[i - 1];
      if (s.score_value !== prev.score_value || s.tiebreak_value !== prev.tiebreak_value)
        rank = i + 1;
    }
    return { ...s, rank, cfPoints: cfPoints(rank) };
  });
}

export function calcTournamentElo(
  athleteElo: number, finalRank: number,
  totalParticipants: number, avgOpponentElo: number, k = 48
): number {
  if (totalParticipants <= 1) return 0;
  const actual   = (totalParticipants - finalRank) / (totalParticipants - 1);
  const expected = 1 / (1 + Math.pow(10, (avgOpponentElo - athleteElo) / 400));
  return Math.round(k * (actual - expected));
}
