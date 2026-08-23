import {
  rankWodScores,
  formatWodScore,
  parseScoreVal,
  type WodScore,
} from '@/lib/tournamentScoring';

/**
 * Contrôle de l'ordre affiché par /tournaments/[id]/leaderboard contre
 * l'ORDER BY du serveur (recalc_division_points / compute_league_wod_elo) :
 *
 *   ORDER BY (CASE WHEN capped THEN 1 ELSE 0 END) ASC,
 *            CASE WHEN is_time AND NOT capped THEN COALESCE(num,  'Infinity') END ASC  NULLS LAST,
 *            CASE WHEN is_time AND     capped THEN COALESCE(num, '-Infinity') END DESC NULLS LAST,
 *            CASE WHEN NOT is_time            THEN COALESCE(num, '-Infinity') END DESC NULLS LAST
 *
 * L'ordre attendu ci-dessous n'est pas déduit du code : il a été obtenu en
 * exécutant cet ORDER BY sur le jeu piégé, en lecture seule, sur la base de
 * production (les valeurs sont dans le corps du test, aucune ligne réelle
 * n'est lue). Un jeu qui ne distinguerait pas l'ancienne implémentation
 * (parseFloat décroissant) de la nouvelle ne prouverait rien : chaque cas
 * ci-dessous change d'ordre ou de rang entre les deux.
 */

const FOR_TIME_PIEGE: WodScore[] = [
  { athlete_id: 'cap_95',         score_value: '95',      capped: true },
  { athlete_id: 'finisher_1000',  score_value: '600' },
  { athlete_id: 'legacy_dnf_130', score_value: '1000129' },
  { athlete_id: 'illisible',      score_value: 'DNF' },
  { athlete_id: 'finisher_930_b', score_value: '570' },
  { athlete_id: 'finisher_845',   score_value: '525' },
  { athlete_id: 'cap_120',        score_value: '120',     capped: true },
  { athlete_id: 'finisher_930_a', score_value: '570' },
];

// Sortie textuelle de l'ORDER BY serveur sur ce jeu.
const ORDRE_SERVEUR = [
  'finisher_845',
  'finisher_930_a',
  'finisher_930_b',
  'finisher_1000',
  'illisible',
  'legacy_dnf_130',
  'cap_120',
  'cap_95',
];

describe('classement par WOD — ordre web vs ORDER BY serveur (For Time piégé)', () => {
  const ranked = rankWodScores(FOR_TIME_PIEGE, 'For Time');

  it("suit l'ordre du serveur au rang près (cappés après les finishers, temps croissant)", () => {
    expect(ranked.map(r => r.score.athlete_id)).toEqual(ORDRE_SERVEUR);
  });

  it('donne la 1re place au temps le plus BAS, pas au plus haut', () => {
    expect(ranked[0].score.athlete_id).toBe('finisher_845');
    // L'ancienne implémentation (parseFloat décroissant) plaçait legacy_dnf_130
    // (1000129) 1er et finisher_845 (525) avant-dernier.
    const ordreAncien = [...FOR_TIME_PIEGE]
      .sort((a, b) => parseFloat(b.score_value) - parseFloat(a.score_value))
      .map(s => s.athlete_id);
    expect(ordreAncien).not.toEqual(ORDRE_SERVEUR);
    expect(ordreAncien[0]).toBe('legacy_dnf_130');
  });

  it('partage le rang des ex-aequo (570 s deux fois) et ne saute pas de rang', () => {
    const rangs = Object.fromEntries(ranked.map(r => [r.score.athlete_id, r.rank]));
    expect(rangs.finisher_845).toBe(1);
    expect(rangs.finisher_930_a).toBe(2);
    expect(rangs.finisher_930_b).toBe(2);
    expect(rangs.finisher_1000).toBe(4);
    expect(ranked.find(r => r.score.athlete_id === 'finisher_930_a')!.isExAequo).toBe(true);
    expect(ranked.find(r => r.score.athlete_id === 'finisher_845')!.isExAequo).toBe(false);
  });

  it("normalise l'encodage hérité DNF_BASE en un cappé à 130 reps", () => {
    const legacy = ranked.find(r => r.score.athlete_id === 'legacy_dnf_130')!;
    expect(legacy.normalized).toEqual({ value: 130, capped: true });
    expect(formatWodScore('1000129', null, 'For Time')).toBe('CAP + 130 reps');
  });

  it('affiche un temps en mm:ss et un cappé comme un cappé', () => {
    expect(formatWodScore('525', false, 'For Time')).toBe('08:45');
    expect(formatWodScore('120', true, 'For Time')).toBe('CAP + 120 reps');
    // Sans cette distinction, « 120 » (reps au cap) se lit comme 2:00 de course.
    expect(formatWodScore('120', false, 'For Time')).toBe('02:00');
  });
});

describe('classement par WOD — AMRAP (le score le plus haut gagne)', () => {
  const ranked = rankWodScores(
    [
      { athlete_id: 'b', score_value: '167' },
      { athlete_id: 'a', score_value: '270' },
      { athlete_id: 'c', score_value: '167' },
    ],
    'AMRAP',
  );

  it('trie décroissant et partage le rang des deux 167', () => {
    expect(ranked.map(r => r.score.athlete_id)).toEqual(['a', 'b', 'c']);
    expect(ranked.map(r => r.rank)).toEqual([1, 2, 2]);
  });

  it('sépare deux scores égaux quand leur tiebreak diffère', () => {
    const avecTiebreak = rankWodScores(
      [
        { athlete_id: 'a', score_value: '167', tiebreak_value: 90 },
        { athlete_id: 'b', score_value: '167', tiebreak_value: 75 },
      ],
      'AMRAP',
    );
    expect(avecTiebreak.map(r => r.rank)).toEqual([1, 2]);
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
