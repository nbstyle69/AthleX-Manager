import { EMPTY_WOD_FORM, formatCap, parseCap, sharedWodColumns } from '@/lib/wodFields';

describe('time cap mm:ss', () => {
  it('formate les secondes en mm:ss', () => {
    expect(formatCap(750)).toBe('12:30');
    expect(formatCap(720)).toBe('12:00');
    expect(formatCap(65)).toBe('1:05');
    expect(formatCap(0)).toBe('0:00');
  });

  it('rend une chaîne vide pour null/undefined (pas de 0:00 inventé)', () => {
    expect(formatCap(null)).toBe('');
    expect(formatCap(undefined)).toBe('');
  });

  it('un cap effacé s’écrit null, pas 0', () => {
    expect(parseCap('')).toBeNull();
    expect(parseCap('   ')).toBeNull();
    expect(parseCap('abc')).toBeNull();
  });

  it('lit un nombre nu comme des minutes (compat CSV)', () => {
    expect(parseCap('12')).toBe(720);
    expect(parseCap('20')).toBe(1200);
  });

  it('lit mm:ss à la seconde', () => {
    expect(parseCap('12:30')).toBe(750);
    expect(parseCap('0:45')).toBe(45);
  });

  it('aller-retour formatCap → parseCap : identité à la seconde', () => {
    // Le cas qui réécrivait la donnée : 750 s revenait à 720 s.
    for (const s of [0, 1, 45, 59, 60, 119, 720, 750, 899, 3600, 3661]) {
      expect(parseCap(formatCap(s))).toBe(s);
    }
  });
});

describe('sharedWodColumns', () => {
  it('rouvrir puis enregistrer sans rien changer ne modifie aucun champ', () => {
    const enBase = {
      title: 'ZZ EMOM',
      description: '21 Thruster (43/30 kg)\n15 Pull-up',
      wod_type: 'emom',
      block_name: 'skill-haltero',
      time_cap_seconds: 750,
      rounds: 5,
      notes: 'notes coach',
      video_url: 'https://youtu.be/zz',
      leaderboard_enabled: false,
      emom_interval_minutes: 3,
      tabata_work_seconds: null,
      tabata_rest_seconds: null,
    };

    // Préremplissage identique à celui de l'éditeur.
    const form = {
      ...EMPTY_WOD_FORM,
      title: enBase.title,
      wod_type: enBase.wod_type,
      block: enBase.block_name,
      timeCap: formatCap(enBase.time_cap_seconds),
      rounds: String(enBase.rounds),
      notes: enBase.notes,
      videoUrl: enBase.video_url,
      leaderboard: enBase.leaderboard_enabled,
      emomInterval: String(enBase.emom_interval_minutes),
    };

    expect(sharedWodColumns(form, enBase.description.split('\n'))).toEqual(enBase);
  });

  it('changer le type EMOM → AMRAP ne laisse pas l’intervalle derrière lui', () => {
    const form = { ...EMPTY_WOD_FORM, title: 'ZZ', wod_type: 'amrap', emomInterval: '3' };
    expect(sharedWodColumns(form, []).emom_interval_minutes).toBeNull();
  });
});
