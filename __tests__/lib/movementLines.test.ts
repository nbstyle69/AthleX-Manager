// Tests pour lib/tournaments/movementLines.ts et editMovementLine (lib/movements.ts).
//
// `movement_lines` est ce que la base lit pour créditer les cumuls de
// mouvement à la validation d'un score de tournoi. Une ligne mal construite
// crédite de travers ; une ligne refusée par la base (23514) bloque
// l'enregistrement. Catalogue : le snapshot embarqué, comme au démarrage.

import { buildMovementLines, generatedForTimeRounds, parseForTimeRounds } from '@/lib/tournaments/movementLines';
import { editMovementLine, parseMovementRow, serializeMovement } from '@/lib/movements';

const one = (line: string) => buildMovementLines([line]);

describe('buildMovementLines — chaque unité', () => {
  it('reps, charges ignorées', () => {
    expect(one('21 Thruster (43/30 kg)')).toEqual([{ movement: 'thruster', unit: 'reps', qty_male: 21 }]);
    expect(one('7 reps — Cluster @ 60/42.5 kg')).toEqual([{ movement: 'cluster', unit: 'reps', qty_male: 7 }]);
  });

  it('mètres et calories explicites', () => {
    expect(one('500 m Run')).toEqual([{ movement: 'run', unit: 'm', qty_male: 500 }]);
    expect(one('20 cal Row')).toEqual([{ movement: 'row', unit: 'cal', qty_male: 20 }]);
  });

  it('nombre nu : unité par défaut du catalogue, comme dans l’éditeur', () => {
    expect(one('20 Row')).toEqual([{ movement: 'row', unit: 'cal', qty_male: 20 }]);
    expect(one('800 Run')).toEqual([{ movement: 'run', unit: 'm', qty_male: 800 }]);
  });

  it('format du générateur, séparateur compris', () => {
    expect(one('200m — Run')).toEqual([{ movement: 'run', unit: 'm', qty_male: 200 }]);
    expect(one('24 reps — Double-unders')).toEqual([{ movement: 'double_under', unit: 'reps', qty_male: 24 }]);
    expect(one('12 cal — Bike Erg')).toEqual([{ movement: 'bike_erg', unit: 'cal', qty_male: 12 }]);
  });
});

describe('buildMovementLines — split ♂/♀', () => {
  it('deux valeurs : qty_male et qty_female', () => {
    expect(one('20/15 cal Row')).toEqual([{ movement: 'row', unit: 'cal', qty_male: 20, qty_female: 15 }]);
    expect(one('21/15 Thruster (43/30 kg)')).toEqual([{ movement: 'thruster', unit: 'reps', qty_male: 21, qty_female: 15 }]);
  });

  it('une valeur : qty_male seul, sans clé qty_female', () => {
    const [line] = one('12 Pull-ups')!;
    expect(line).toEqual({ movement: 'pull_up', unit: 'reps', qty_male: 12 });
    expect('qty_female' in line).toBe(false);
  });
});

describe('buildMovementLines — exclusions', () => {
  it.each([
    ['durée', '30 s Plank Hold'],
    ['durée, autre graphie', '30 sec Plank Hold'],
    ['sans quantité', 'Thruster'],
    ['texte libre hors catalogue', '12 Pompes du coach'],
    ['en-tête de tours', '5 rounds for time'],
    ['schéma de reps', '27-21-15-9 reps — DB Clean & Jerk'],
    ['décimal', '12.5 cal Row'],
    ['décimal à la virgule', '12,5 cal Row'],
    ['décimal côté ♀', '20/12.5 cal Row'],
    ['quantité nulle', '0 Thruster'],
    ['quantité ♀ nulle', '20/0 cal Row'],
    ['unité non permise : Echo Bike en mètres', '500 m Echo Bike'],
    ['unité non permise : Run en calories', '20 cal Run'],
    ['unité non permise : km sur un mouvement en reps', '1 km Thruster'],
    ['ligne vide', ''],
  ])('%s — « %s »', (_label, line) => {
    expect(one(line)).toBeNull();
  });
});

describe('buildMovementLines — kilomètres', () => {
  it('convertit en mètres', () => {
    expect(one('1 km Run')).toEqual([{ movement: 'run', unit: 'm', qty_male: 1000 }]);
    expect(one('1km — Run')).toEqual([{ movement: 'run', unit: 'm', qty_male: 1000 }]);
  });

  it('1,5 km donne 1 500 m : conversion exacte, pas un arrondi', () => {
    expect(one('1.5 km Run')).toEqual([{ movement: 'run', unit: 'm', qty_male: 1500 }]);
    expect(one('1,5 km Run')).toEqual([{ movement: 'run', unit: 'm', qty_male: 1500 }]);
    expect(one('1.1 km Row')).toEqual([{ movement: 'row', unit: 'm', qty_male: 1100 }]);
  });

  it('split en km', () => {
    expect(one('2/1.5 km Run')).toEqual([{ movement: 'run', unit: 'm', qty_male: 2000, qty_female: 1500 }]);
  });

  it('un résultat non entier en mètres est exclu, jamais arrondi', () => {
    expect(one('0.0005 km Run')).toBeNull();
    expect(one('1.2345 km Run')).toBeNull();
  });
});

describe('buildMovementLines — WOD entier', () => {
  it('garde l’ordre des lignes et saute les lignes exclues', () => {
    expect(buildMovementLines([
      '21/15 Thruster (43/30 kg)',
      'Repos 1 min',
      '500 m Run',
      '30 s Plank Hold',
      '12 Pull-ups',
    ])).toEqual([
      { movement: 'thruster', unit: 'reps', qty_male: 21, qty_female: 15 },
      { movement: 'run', unit: 'm', qty_male: 500 },
      { movement: 'pull_up', unit: 'reps', qty_male: 12 },
    ]);
  });

  it('aucune ligne exploitable : null, pas un tableau vide', () => {
    expect(buildMovementLines(['5 rounds for time', 'Thruster', '30 s Plank Hold', ''])).toBeNull();
    expect(buildMovementLines([])).toBeNull();
  });

  it('For Time en tours : les tours vont dans rounds, l’en-tête ne crédite rien', () => {
    const lines = ['5 rounds for time', '200m — Run', '6 reps — Cluster @ 60/42.5 kg'];
    expect(generatedForTimeRounds(lines)).toBe('5');
    expect(parseForTimeRounds(generatedForTimeRounds(lines))).toEqual({ ok: true, value: 5 });
    expect(buildMovementLines(lines)).toEqual([
      { movement: 'run', unit: 'm', qty_male: 200 },
      { movement: 'cluster', unit: 'reps', qty_male: 6 },
    ]);
  });
});

describe('nombre de tours d’un For Time', () => {
  it('vide : null, lu comme un seul tour par la base', () => {
    expect(parseForTimeRounds('')).toEqual({ ok: true, value: null });
    expect(parseForTimeRounds('  ')).toEqual({ ok: true, value: null });
  });

  it('entier ≥ 1 : enregistré tel quel', () => {
    expect(parseForTimeRounds('1')).toEqual({ ok: true, value: 1 });
    expect(parseForTimeRounds('3')).toEqual({ ok: true, value: 3 });
  });

  it('refuse plutôt qu’arrondir', () => {
    for (const v of ['0', '-2', '2.5', 'trois']) expect(parseForTimeRounds(v)).toEqual({ ok: false });
  });

  it('préremplissage : seulement « N rounds for time »', () => {
    expect(generatedForTimeRounds(['3 rounds for time — run + reps courtes'])).toBe('3');
    expect(generatedForTimeRounds(['1 round for time'])).toBe('1');
    expect(generatedForTimeRounds(['5 rounds — focus station'])).toBe('');
    expect(generatedForTimeRounds(['12 min AMRAP', '10 Thruster'])).toBe('');
  });
});

describe('editMovementLine — une ligne modifiée garde son unité et son ♀', () => {
  const same = (line: string, patch: Partial<Parameters<typeof editMovementLine>[1]> = {}) => {
    const p = parseMovementRow(line);
    return editMovementLine(line, { reps: p.reps, name: p.name, weightKg: p.weightKg, weightKgWomen: p.weightKgWomen, ...patch });
  };

  it('« 500 m Row » reste en mètres quand on touche à la ligne', () => {
    const edited = same('500 m Row', { reps: 600 });
    expect(edited).toBe('600 m Row');
    expect(buildMovementLines([edited])).toEqual([{ movement: 'row', unit: 'm', qty_male: 600 }]);
  });

  it('le défaut corrigé : l’ancienne réécriture relisait 500 m de Row en 500 cal', () => {
    const before = serializeMovement(500, 'Row');
    expect(buildMovementLines([before])).toEqual([{ movement: 'row', unit: 'cal', qty_male: 500 }]);
  });

  it('le split ♀ survit à une modification de la charge ou des reps ♂', () => {
    expect(same('21/15 Thruster (43/30 kg)', { weightKg: 50 })).toBe('21/15 Thruster (50/30 kg)');
    expect(same('20/15 cal Row', { reps: 25 })).toBe('25/15 cal Row');
    expect(buildMovementLines([same('20/15 cal Row', { reps: 25 })])).toEqual([
      { movement: 'row', unit: 'cal', qty_male: 25, qty_female: 15 },
    ]);
  });

  it('nouveau nom : l’unité reste si le mouvement la permet, sinon son défaut', () => {
    expect(same('500 m Row', { name: 'SkiErg' })).toBe('500 m SkiErg');
    expect(same('500 m Row', { name: 'Thruster' })).toBe('500 Thruster');
    expect(same('20 Row', { name: 'Run' })).toBe('20 m Run');
  });

  it('sans nom ou sans quantité, la ligne ne porte pas d’unité', () => {
    expect(same('500 m Row', { name: '' })).toBe('500');
    expect(same('500 m Row', { reps: null })).toBe('Row');
  });

  it('une durée reste une durée', () => {
    expect(same('30 s Plank Hold', { reps: 45 })).toBe('45 s Plank Hold');
  });
});
