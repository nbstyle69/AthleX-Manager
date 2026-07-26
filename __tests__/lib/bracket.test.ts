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
