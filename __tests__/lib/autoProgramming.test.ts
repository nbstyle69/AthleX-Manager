import {
  DEFAULT_REVEAL, REGEN_CONFIRM_WORD, TRACKS, TRACK_LABEL, everyTrackDone, isoWeekOf,
  isTrack, normalizeTime, revealFromRow, revealLabel, trackListLabel,
  validateAutoProgrammingPatch, weekDayLabel, type AutoRun,
} from '@/lib/autoProgramming';

describe('semaine ISO', () => {
  it('donne la même semaine que le moteur sur des dates connues', () => {
    // Semaine 39 de 2026 : celle des deux runs déjà en production.
    expect(isoWeekOf('2026-09-21')).toEqual({ iso_year: 2026, iso_week: 39 });
    expect(isoWeekOf('2026-09-27')).toEqual({ iso_year: 2026, iso_week: 39 });
    expect(isoWeekOf('2026-09-28')).toEqual({ iso_year: 2026, iso_week: 40 });
  });

  it('rattache le début janvier à l’année ISO que décide le jeudi', () => {
    // 1er janvier 2027 est un vendredi : semaine 53 de 2026.
    expect(isoWeekOf('2027-01-01')).toEqual({ iso_year: 2026, iso_week: 53 });
    expect(isoWeekOf('2027-01-04')).toEqual({ iso_year: 2027, iso_week: 1 });
  });
});

describe('réglage de révélation', () => {
  it('accepte `HH:MM` et le `time` de Postgres', () => {
    expect(normalizeTime('18:00')).toBe('18:00');
    expect(normalizeTime('18:00:00')).toBe('18:00');
    expect(normalizeTime('25:00')).toBeNull();
    expect(normalizeTime(null)).toBeNull();
  });

  it('retombe sur dimanche 18:00 quand les colonnes sont absentes', () => {
    // Base sans la migration `20261221` : la ligne n’a aucune colonne reveal.
    expect(revealFromRow({ id: 'box-1', auto_programming: true })).toEqual(DEFAULT_REVEAL);
    expect(revealLabel(DEFAULT_REVEAL)).toBe('le dimanche à 18:00');
  });

  it('lit le réglage quand les colonnes existent', () => {
    const r = revealFromRow({
      auto_programming_reveal_mode: 'daily',
      auto_programming_reveal_dow: 3,
      auto_programming_reveal_time: '07:30:00',
    });
    expect(r).toEqual({ mode: 'daily', dow: 3, time: '07:30' });
    expect(revealLabel(r)).toBe('chaque jour à 07:30');
    expect(revealLabel({ mode: 'weekly', dow: 6, time: '20:00' })).toBe('le samedi à 20:00');
  });
});

describe('everyTrackDone', () => {
  const week = { iso_year: 2026, iso_week: 39 };
  const run = (track: string, status: string, iso_week = 39): AutoRun => ({
    id: `r-${track}-${iso_week}`, box_id: 'box-1', track: track as AutoRun['track'],
    iso_year: 2026, iso_week, status: status as AutoRun['status'],
    regen_counter: 0, error: null, wod_ids: [], generated_at: '2026-09-16T20:26:13Z',
  });

  it('vrai seulement si chaque piste active a une run terminée sur cette semaine', () => {
    const runs = [run('functional', 'done'), run('musculation', 'done')];
    expect(everyTrackDone(runs, ['functional', 'musculation'], week)).toBe(true);
    expect(everyTrackDone([run('functional', 'done')], ['functional', 'musculation'], week)).toBe(false);
  });

  it('une run en erreur ou sur une autre semaine ne compte pas', () => {
    expect(everyTrackDone([run('functional', 'error')], ['functional'], week)).toBe(false);
    expect(everyTrackDone([run('functional', 'done', 38)], ['functional'], week)).toBe(false);
  });

  it('sans piste active, rien n’est « déjà fait » — le bouton reste ouvert', () => {
    expect(everyTrackDone([run('functional', 'done')], [], week)).toBe(false);
  });
});

describe('validateAutoProgrammingPatch', () => {
  it('accepte l’interrupteur et les trois pistes', () => {
    const { errors, patch } = validateAutoProgrammingPatch({
      auto_programming: true, tracks: ['functional', 'hybrid', 'musculation'],
    });
    expect(errors).toEqual([]);
    expect(patch.auto_programming).toBe(true);
    expect(patch.auto_programming_tracks).toEqual(['functional', 'hybrid', 'musculation']);
  });

  it('accepte Hybrid seule', () => {
    // Une box peut n’activer que Hybrid : ce n’est pas un complément de
    // Functional, c’est une piste à part entière.
    const { errors, patch } = validateAutoProgrammingPatch({
      auto_programming: true, tracks: ['hybrid'],
    });
    expect(errors).toEqual([]);
    expect(patch.auto_programming_tracks).toEqual(['hybrid']);
  });

  it('refuse une piste inconnue', () => {
    // `crossfit` et `hyrox` sont des valeurs de discipline du Marketplace,
    // jamais des clés de piste : elles ne doivent pas passer.
    for (const pas of ['crossfit', 'hyrox']) {
      const { errors } = validateAutoProgrammingPatch({ tracks: [pas] });
      expect(errors).toEqual(['pistes connues : functional, hybrid, musculation']);
    }
  });

  it('refuse d’allumer une box sans aucune piste', () => {
    const { errors } = validateAutoProgrammingPatch({ auto_programming: true, tracks: [] });
    expect(errors).toContain('une box allumée doit avoir au moins une piste');
  });

  it('éteindre une box sans piste reste permis', () => {
    const { errors } = validateAutoProgrammingPatch({ auto_programming: false, tracks: [] });
    expect(errors).toEqual([]);
  });

  it('valide le réglage de révélation', () => {
    const ok = validateAutoProgrammingPatch({ reveal_mode: 'weekly', reveal_dow: 0, reveal_time: '18:00' });
    expect(ok.errors).toEqual([]);
    expect(ok.patch.auto_programming_reveal_time).toBe('18:00');

    const ko = validateAutoProgrammingPatch({ reveal_mode: 'parfois', reveal_dow: 9, reveal_time: '99:99' });
    expect(ko.errors).toHaveLength(3);
  });

  it('refuse un corps vide', () => {
    expect(validateAutoProgrammingPatch({}).errors).toEqual(['rien à modifier']);
    expect(validateAutoProgrammingPatch(null).errors).toEqual(['corps JSON attendu']);
  });
});

describe('libellés de semaine', () => {
  it('nomme la semaine par la date de son lundi', () => {
    // Ce sont ces libellés que portent les boutons : « Générer la semaine du
    // 5 octobre » doit désigner la semaine affichée, pas une autre.
    expect(weekDayLabel('2026-10-05')).toBe('5 octobre');
    expect(weekDayLabel('2026-09-21')).toBe('21 septembre');
  });

  it('ne décale pas la date selon le fuseau de la machine', () => {
    // Un `new Date('2026-01-01')` lu en heure locale bascule au 31 décembre à
    // l'ouest de Greenwich : la date est un jour civil, pas un instant.
    expect(weekDayLabel('2026-01-01')).toBe('1 janvier');
  });

  it('le mot de confirmation est sans accent ni espace', () => {
    // Il doit être recopiable tel quel sur tout clavier.
    expect(REGEN_CONFIRM_WORD).toBe('REGENERER');
    expect(REGEN_CONFIRM_WORD).toMatch(/^[A-Z]+$/);
  });
});

describe('semaine affichée et bouton « Générer »', () => {
  const run = (track: string, iso_week: number): AutoRun => ({
    id: `r-${track}-${iso_week}`, box_id: 'box-1', track: track as AutoRun['track'],
    iso_year: 2026, iso_week, status: 'done',
    regen_counter: 0, error: null, wod_ids: [], generated_at: '2026-09-16T20:26:13Z',
  });

  it('une semaine lointaine et vide laisse le bouton actif', () => {
    // Le défaut corrigé : la semaine 39 est générée, la 41 ne l'est pas ; en
    // se basant sur « la semaine suivante » le bouton restait grisé sur la 41.
    const runs = [run('functional', 39), run('musculation', 39)];
    const semaine41 = isoWeekOf('2026-10-05');
    expect(semaine41).toEqual({ iso_year: 2026, iso_week: 41 });
    expect(everyTrackDone(runs, ['functional', 'musculation'], semaine41)).toBe(false);
    expect(everyTrackDone(runs, ['functional', 'musculation'], isoWeekOf('2026-09-21'))).toBe(true);
  });
});

describe('les trois pistes', () => {
  it('garde les clés internes attendues par la base, dans l’ordre du moteur', () => {
    // Le CHECK de `boxes.auto_programming_tracks` (migration `20261222`) et
    // `TRACKS` du moteur portent exactement ces trois valeurs.
    expect(TRACKS).toEqual(['functional', 'hybrid', 'musculation']);
    expect(Object.keys(TRACK_LABEL)).toEqual(['functional', 'hybrid', 'musculation']);
    expect(isTrack('hybrid')).toBe(true);
    expect(isTrack('crossfit')).toBe(false);
    expect(isTrack('hyrox')).toBe(false);
  });

  it('n’affiche ni « CrossFit » ni « Hyrox », et plus « Functional / Hybrid »', () => {
    const labels = Object.values(TRACK_LABEL);
    expect(labels).toEqual(['Functional', 'Hybrid', 'Musculation']);
    for (const l of labels) {
      expect(l).not.toMatch(/crossfit|hyrox/i);
      // L’ancien libellé fusionné nommait deux pistes d’un coup.
      expect(l).not.toContain('/');
    }
  });

  it('énumère les pistes actives en français, sans jamais dire « les deux »', () => {
    expect(trackListLabel(['functional'])).toBe('Functional');
    expect(trackListLabel(['functional', 'hybrid'])).toBe('Functional et Hybrid');
    expect(trackListLabel(['functional', 'hybrid', 'musculation']))
      .toBe('Functional, Hybrid et Musculation');
    expect(trackListLabel([])).toBe('');
  });

  it('une box à trois pistes n’est « déjà générée » que si les trois le sont', () => {
    const run = (track: string): AutoRun => ({
      id: `r-${track}`, box_id: 'box-1', track: track as AutoRun['track'],
      iso_year: 2026, iso_week: 39, status: 'done',
      regen_counter: 0, error: null, wod_ids: [], generated_at: '2026-09-16T20:26:13Z',
    });
    const semaine = { iso_year: 2026, iso_week: 39 };
    const trois: AutoRun['track'][] = ['functional', 'hybrid', 'musculation'];
    expect(everyTrackDone([run('functional'), run('musculation')], trois, semaine)).toBe(false);
    expect(everyTrackDone(trois.map(run), trois, semaine)).toBe(true);
  });
});
