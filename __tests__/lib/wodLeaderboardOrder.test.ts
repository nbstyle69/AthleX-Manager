import { formatWodScore, normalizeWodScore, parseScoreVal } from '@/lib/tournamentScoring';

/**
 * Affichage des scores d'un WOD de tournoi. L'ordre et les rangs du classement
 * par WOD viennent de la base (`tournament_classique_wod_ranks`, athlex-app
 * #359) : le Manager ne les calcule plus, il met seulement les scores en forme.
 */

describe('affichage d’un score de WOD', () => {
  it("normalise l'encodage hérité DNF_BASE en un cappé à 130 reps", () => {
    expect(normalizeWodScore('1000129', null, true)).toEqual({ value: 130, capped: true });
    expect(formatWodScore('1000129', null, 'For Time')).toBe('CAP + 130 reps');
  });

  it('affiche un temps en mm:ss et un cappé comme un cappé', () => {
    expect(formatWodScore('525', false, 'For Time')).toBe('08:45');
    expect(formatWodScore('120', true, 'For Time')).toBe('CAP + 120 reps');
    // Sans cette distinction, « 120 » (reps au cap) se lit comme 2:00 de course.
    expect(formatWodScore('120', false, 'For Time')).toBe('02:00');
  });

  it('hors For Time : le nombre tel quel', () => {
    expect(formatWodScore('167', null, 'AMRAP')).toBe('167');
  });
});

describe('score_value reste canonique (secondes), jamais mm:ss', () => {
  it("l'ORDER BY serveur lit « 9:30 » comme 9, la saisie back-office doit donc le convertir", () => {
    // Miroir de substring(score_value from '^(-?[0-9]+(?:\.[0-9]+)?)')::numeric
    const commeLeServeur = (v: string) => {
      const m = /^-?[0-9]+(?:\.[0-9]+)?/.exec(v);
      return m ? parseFloat(m[0]) : null;
    };
    expect(commeLeServeur('9:30')).toBe(9);
    expect(parseScoreVal('9:30')).toBe(570);
    // Après conversion à l'écriture, les deux lectures coïncident.
    expect(commeLeServeur(String(parseScoreVal('9:30')))).toBe(570);
  });
});
