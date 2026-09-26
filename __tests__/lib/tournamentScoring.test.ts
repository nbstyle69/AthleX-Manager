import { parseScoreVal, isLowerWinsType } from '@/lib/tournamentScoring';

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
