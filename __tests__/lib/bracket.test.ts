import { computeBracketStandings, type BracketMatchRow } from '@/lib/bracket';

function m(round: number, p1: string, p2: string, winner: string): BracketMatchRow {
  return {
    round,
    side: 'winner',
    participant1_id: p1,
    participant2_id: p2,
    winner_id: winner,
    loser_id: winner === p1 ? p2 : p1,
    status: 'completed',
  };
}

describe('computeBracketStandings', () => {
  it('returns empty for no matches', () => {
    expect(computeBracketStandings([])).toEqual([]);
  });

  it('ranks a 4-player bracket: champion, finalist, two tied semis', () => {
    const matches: BracketMatchRow[] = [
      m(1, 'a', 'b', 'a'),
      m(1, 'c', 'd', 'c'),
      m(2, 'a', 'c', 'a'),
    ];
    const s = computeBracketStandings(matches);
    const byId = Object.fromEntries(s.map(x => [x.athlete_id, x]));
    expect(byId['a']).toMatchObject({ rank: 1, placement: 'Champion' });
    expect(byId['c']).toMatchObject({ rank: 2, placement: 'Finaliste' });
    expect(byId['b'].rank).toBe(3);
    expect(byId['d'].rank).toBe(3);
    expect(byId['b'].placement).toBe('Demi-finaliste');
  });

  it('assigns competition ranks (1-2-3-3-5-5-5-5) in an 8-player bracket', () => {
    const matches: BracketMatchRow[] = [
      m(1, 'a', 'b', 'a'), m(1, 'c', 'd', 'c'), m(1, 'e', 'f', 'e'), m(1, 'g', 'h', 'g'),
      m(2, 'a', 'c', 'a'), m(2, 'e', 'g', 'e'),
      m(3, 'a', 'e', 'a'),
    ];
    const s = computeBracketStandings(matches);
    const byId = Object.fromEntries(s.map(x => [x.athlete_id, x.rank]));
    expect(byId['a']).toBe(1);
    expect(byId['e']).toBe(2);
    expect(byId['c']).toBe(3);
    expect(byId['g']).toBe(3);
    // The four first-round losers are tied 5th.
    expect([byId['b'], byId['d'], byId['f'], byId['h']]).toEqual([5, 5, 5, 5]);
  });

  it('treats a not-yet-decided final as no champion', () => {
    const matches: BracketMatchRow[] = [
      m(1, 'a', 'b', 'a'),
      m(1, 'c', 'd', 'c'),
      { round: 2, side: 'winner', participant1_id: 'a', participant2_id: 'c', winner_id: null, loser_id: null, status: 'pending' },
    ];
    const s = computeBracketStandings(matches);
    expect(s.some(x => x.placement === 'Champion')).toBe(false);
  });
});

function wb(round: number, p1: string, p2: string, winner: string): BracketMatchRow {
  return { round, side: 'winner', participant1_id: p1, participant2_id: p2, winner_id: winner, loser_id: winner === p1 ? p2 : p1, status: 'completed' };
}
function lb(round: number, p1: string, p2: string, winner: string): BracketMatchRow {
  return { round, side: 'loser', participant1_id: p1, participant2_id: p2, winner_id: winner, loser_id: winner === p1 ? p2 : p1, status: 'completed' };
}
function gf(p1: string, p2: string, winner: string): BracketMatchRow {
  return { round: 99, side: 'grand_final', participant1_id: p1, participant2_id: p2, winner_id: winner, loser_id: winner === p1 ? p2 : p1, status: 'completed' };
}

describe('computeBracketStandings — double elimination (swiss)', () => {
  it('falls back to single-elim standings before the loser bracket exists', () => {
    // WB round 1 done, final still pending, no loser bracket generated yet:
    // no champion should be declared while the winner bracket is unresolved.
    const s = computeBracketStandings([
      wb(1, 'a', 'b', 'a'),
      wb(1, 'c', 'd', 'c'),
      { round: 2, side: 'winner', participant1_id: 'a', participant2_id: 'c', winner_id: null, loser_id: null, status: 'pending' },
    ], true);
    expect(s.length).toBe(4);
    expect(s.some(x => x.placement === 'Champion')).toBe(false);
  });

  it('ranks a 4-player double-elim: GF winner champion, GF loser 2nd, LB losers by round', () => {
    // WB: a>b, c>d ; a>c (a to GF). LB1: b vs d → d wins (b out, 4th).
    // LB2: c vs d → c wins (d out, 3rd). GF: a vs c → a champion, c runner-up.
    const matches: BracketMatchRow[] = [
      wb(1, 'a', 'b', 'a'),
      wb(1, 'c', 'd', 'c'),
      wb(2, 'a', 'c', 'a'),
      lb(1, 'b', 'd', 'd'),
      lb(2, 'c', 'd', 'c'),
      gf('a', 'c', 'a'),
    ];
    const s = computeBracketStandings(matches, true);
    const byId = Object.fromEntries(s.map(x => [x.athlete_id, x]));
    expect(byId['a']).toMatchObject({ rank: 1, placement: 'Champion' });
    expect(byId['c']).toMatchObject({ rank: 2, placement: 'Finaliste' });
    expect(byId['d'].rank).toBe(3);
    expect(byId['b'].rank).toBe(4);
  });

  it('lets a winner-bracket loser become champion via the grand final', () => {
    // c loses WB final to a, drops to LB, wins LB, then wins GF → champion.
    const matches: BracketMatchRow[] = [
      wb(1, 'a', 'b', 'a'),
      wb(1, 'c', 'd', 'c'),
      wb(2, 'a', 'c', 'a'),
      lb(1, 'b', 'd', 'b'),
      lb(2, 'c', 'b', 'c'),
      gf('a', 'c', 'c'),
    ];
    const s = computeBracketStandings(matches, true);
    const byId = Object.fromEntries(s.map(x => [x.athlete_id, x]));
    expect(byId['c']).toMatchObject({ rank: 1, placement: 'Champion' });
    expect(byId['a']).toMatchObject({ rank: 2, placement: 'Finaliste' });
    expect(byId['b'].rank).toBe(3);
    expect(byId['d'].rank).toBe(4);
  });

  it('shares a rank for athletes eliminated in the same loser-bracket round', () => {
    // Two LB round-1 losers tie for last.
    const matches: BracketMatchRow[] = [
      wb(1, 'a', 'b', 'a'),
      wb(1, 'c', 'd', 'c'),
      wb(1, 'e', 'f', 'e'),
      wb(1, 'g', 'h', 'g'),
      lb(1, 'b', 'd', 'b'),
      lb(1, 'f', 'h', 'f'),
    ];
    const s = computeBracketStandings(matches, true);
    const byId = Object.fromEntries(s.map(x => [x.athlete_id, x.rank]));
    // d and h both lost in LB round 1 → tied.
    expect(byId['d']).toBe(byId['h']);
  });

  it('treats a not-yet-decided grand final as no champion', () => {
    const matches: BracketMatchRow[] = [
      wb(1, 'a', 'b', 'a'),
      wb(1, 'c', 'd', 'c'),
      wb(2, 'a', 'c', 'a'),
      lb(1, 'b', 'd', 'd'),
      lb(2, 'c', 'd', 'c'),
      { round: 99, side: 'grand_final', participant1_id: 'a', participant2_id: 'c', winner_id: null, loser_id: null, status: 'pending' },
    ];
    const s = computeBracketStandings(matches, true);
    expect(s.some(x => x.placement === 'Champion')).toBe(false);
  });
});
