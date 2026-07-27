import { parseScoreVal, isLowerWinsType, rankClassique, type RawScore } from '@/lib/tournamentScoring';

describe('parseScoreVal', () => {
  it('parses mm:ss into total seconds (secondes non perdues)', () => {
    expect(parseScoreVal('8:30')).toBe(510);
    expect(parseScoreVal('0:45')).toBe(45);
    expect(parseScoreVal('10:00')).toBe(600);
  });

  it('parses hh:mm:ss', () => {
    expect(parseScoreVal('1:02:03')).toBe(3723);
  });

  it('parses plain numbers and comma decimals', () => {
    expect(parseScoreVal('123')).toBe(123);
    expect(parseScoreVal('42,5')).toBe(42.5);
    expect(parseScoreVal('80 kg')).toBe(80);
  });

  it('returns null for empty/invalid', () => {
    expect(parseScoreVal('')).toBeNull();
    expect(parseScoreVal(null)).toBeNull();
    expect(parseScoreVal('abc')).toBeNull();
  });
});

describe('isLowerWinsType', () => {
  it('is true only for For Time', () => {
    expect(isLowerWinsType('For Time')).toBe(true);
    expect(isLowerWinsType('AMRAP')).toBe(false);
    expect(isLowerWinsType('Max Reps')).toBe(false);
    expect(isLowerWinsType('Strength')).toBe(false);
    expect(isLowerWinsType(null)).toBe(false);
  });
});

describe('rankClassique', () => {
  it('For Time: le temps le plus BAS gagne (tri croissant, mm:ss)', () => {
    const scores: RawScore[] = [
      { athlete_id: 'fast', score_value: '8:30', tournament_wod_id: 'w1', wod_type: 'For Time' },
      { athlete_id: 'mid', score_value: '9:15', tournament_wod_id: 'w1', wod_type: 'For Time' },
      { athlete_id: 'slow', score_value: '12:00', tournament_wod_id: 'w1', wod_type: 'For Time' },
    ];
    const pts = rankClassique(scores);
    // fast (510s) = 100, mid (555s) = 97, slow (720s) = 94
    expect(pts.fast).toBe(100);
    expect(pts.mid).toBe(97);
    expect(pts.slow).toBe(94);
    expect(pts.fast).toBeGreaterThan(pts.slow);
  });

  it('AMRAP/Max Reps: le score le plus HAUT gagne (tri décroissant)', () => {
    const scores: RawScore[] = [
      { athlete_id: 'a', score_value: '250', tournament_wod_id: 'w1', wod_type: 'AMRAP' },
      { athlete_id: 'b', score_value: '180', tournament_wod_id: 'w1', wod_type: 'AMRAP' },
      { athlete_id: 'c', score_value: '120', tournament_wod_id: 'w1', wod_type: 'AMRAP' },
    ];
    const pts = rankClassique(scores);
    expect(pts.a).toBe(100);
    expect(pts.b).toBe(97);
    expect(pts.c).toBe(94);
  });

  it('cumule les points sur plusieurs WOD de types différents', () => {
    const scores: RawScore[] = [
      // WOD For Time : x gagne (temps plus bas)
      { athlete_id: 'x', score_value: '5:00', tournament_wod_id: 'ft', wod_type: 'For Time' },
      { athlete_id: 'y', score_value: '6:00', tournament_wod_id: 'ft', wod_type: 'For Time' },
      // WOD AMRAP : y gagne (reps plus hautes)
      { athlete_id: 'x', score_value: '100', tournament_wod_id: 'amrap', wod_type: 'AMRAP' },
      { athlete_id: 'y', score_value: '150', tournament_wod_id: 'amrap', wod_type: 'AMRAP' },
    ];
    const pts = rankClassique(scores);
    // x: 100 (ft 1er) + 97 (amrap 2e) = 197 ; y: 97 + 100 = 197
    expect(pts.x).toBe(197);
    expect(pts.y).toBe(197);
  });

  it('ignore les scores non parsables', () => {
    const scores: RawScore[] = [
      { athlete_id: 'a', score_value: '100', tournament_wod_id: 'w1', wod_type: 'AMRAP' },
      { athlete_id: 'b', score_value: 'DNF', tournament_wod_id: 'w1', wod_type: 'AMRAP' },
    ];
    const pts = rankClassique(scores);
    expect(pts.a).toBe(100);
    expect(pts.b).toBeUndefined();
  });
});
