import { decideMatchWinner } from '@/lib/tournamentScoring';

const validated = (score_value: string, capped: boolean | null = null) => ({
  score_value,
  capped,
  status: 'validated',
});

const A = (score_value: string, capped: boolean | null = null) => ({
  id: 'A' as const,
  submission: validated(score_value, capped),
});
const B = (score_value: string, capped: boolean | null = null) => ({
  id: 'B' as const,
  submission: validated(score_value, capped),
});

describe('decideMatchWinner — le duel de bracket suit l’ordre du serveur', () => {
  // Le piège de la copie supprimée : elle comparait deux nombres nus, donc un
  // cappé (des reps) affrontait un finisher (des secondes) sur la même échelle.
  it('un cappé perd contre un finisher, même avec un nombre plus petit', () => {
    expect(decideMatchWinner(A('120', true), B('570'), 'For Time')).toBe('B');
    expect(decideMatchWinner(A('570'), B('120', true), 'For Time')).toBe('A');

    // L’ancienne comparaison nue : 120 < 570 donc le cappé « gagnait » le For Time.
    expect(120 < 570).toBe(true);
  });

  it('entre deux cappés, le plus de reps gagne', () => {
    expect(decideMatchWinner(A('130', true), B('95', true), 'For Time')).toBe('A');
  });

  it('reconnaît l’encodage hérité DNF_BASE comme un cappé (130 reps > 95 reps)', () => {
    expect(decideMatchWinner(A('1000129'), B('1000095'), 'For Time')).toBe('A');
    // Comparés nus, ce sont deux « temps » et le plus petit gagnait : B, à 95 reps.
    expect(1000095 < 1000129).toBe(true);

    expect(decideMatchWinner(A('1000129'), B('600'), 'For Time')).toBe('B');
  });

  it('For Time : le temps le plus bas gagne ; AMRAP : le plus de reps', () => {
    expect(decideMatchWinner(A('525'), B('570'), 'For Time')).toBe('A');
    expect(decideMatchWinner(A('167'), B('177'), 'AMRAP')).toBe('B');
  });

  it('rend null quand le duel n’est pas décidable sans l’owner', () => {
    expect(decideMatchWinner(A('570'), B('570'), 'For Time')).toBeNull();
    expect(decideMatchWinner(A('570'), { id: 'B', submission: null }, 'For Time')).toBeNull();
    expect(
      decideMatchWinner(
        A('570'),
        { id: 'B', submission: { score_value: '525', capped: null, status: 'pending' } },
        'For Time',
      ),
    ).toBeNull();
    // Score illisible : l’owner tranche, on ne le déclare pas perdant en silence.
    expect(decideMatchWinner(A('DNF'), B('570'), 'For Time')).toBeNull();
  });

  it('un temps saisi en mm:ss est lu en secondes, pas par ses chiffres de tête', () => {
    expect(decideMatchWinner(A('9:30'), B('600'), 'For Time')).toBe('A');
    // « 9:30 » et « 570 » sont le même temps : le duel n’est pas décidable.
    expect(decideMatchWinner(A('9:30'), B('570'), 'For Time')).toBeNull();
    // parseFloat('9:30') vaut 9 : sans conversion, A gagnait pour la mauvaise raison.
    expect(parseFloat('9:30')).toBe(9);
  });
});
