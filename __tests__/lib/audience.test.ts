import {
  audienceBadgeLabel, isAudience, mondayOfISO, nextMondayISO, isoDow,
  weekNumberFor, recapLine, subscriptionColorHex, offerWeekStorageKey,
} from '@/lib/audience';

describe('audience', () => {
  it('isAudience n’accepte que all/groups/none', () => {
    expect(isAudience('all')).toBe(true);
    expect(isAudience('groups')).toBe(true);
    expect(isAudience('none')).toBe(true);
    expect(isAudience('')).toBe(false);
    expect(isAudience(null)).toBe(false);
  });

  it('badge : libellé explicite selon la colonne audience, pas déduit des groupes', () => {
    expect(audienceBadgeLabel('all', ['K+ Perf'])).toBe('Visible par toute la box');
    expect(audienceBadgeLabel('groups', ['K+ Perf', 'Compet'])).toBe('Visible par K+ Perf, Compet');
    expect(audienceBadgeLabel('none', [])).toBe('Visible par personne');
  });

  it('recap : null tant que la visibilité n’est pas choisie', () => {
    expect(recapLine({ audience: '', groupNames: [], programNames: [], offers: [] })).toBeNull();
    expect(recapLine({
      audience: 'groups', groupNames: ['K+ Perf'], programNames: ['Prog Muscu'],
      offers: [{ title: 'ATHX BLOC 2', week: 1 }],
    })).toBe('Visible par K+ Perf · Prog Muscu · copié dans ATHX BLOC 2, semaine 1');
  });
});

describe('dates et ancrage', () => {
  it('mondayOfISO / nextMondayISO / isoDow', () => {
    expect(mondayOfISO('2026-09-10')).toBe('2026-09-07'); // jeudi → lundi
    expect(mondayOfISO('2026-09-13')).toBe('2026-09-07'); // dimanche → lundi de la même semaine ISO
    expect(nextMondayISO('2026-09-10')).toBe('2026-09-14');
    expect(nextMondayISO('2026-09-14')).toBe('2026-09-21');
    expect(isoDow('2026-09-13')).toBe(7);
    expect(isoDow('2026-09-14')).toBe(1);
  });

  it('weekNumberFor : même rotation que materialize_box_programming (NBS2, ancre 2026-09-14, 6 semaines)', () => {
    expect(weekNumberFor('2026-09-14', '2026-09-14', 6)).toBe(1);
    expect(weekNumberFor('2026-09-14', '2026-09-21', 6)).toBe(2);
    expect(weekNumberFor('2026-09-14', '2026-10-19', 6)).toBe(6);
    expect(weekNumberFor('2026-09-14', '2026-10-26', 6)).toBe(1);
    // Lundi antérieur à l’ancre : modulo positif
    expect(weekNumberFor('2026-09-14', '2026-09-07', 6)).toBe(6);
  });
});

describe('palette et stockage', () => {
  it('subscriptionColorHex retombe sur sky pour une clé inconnue', () => {
    expect(subscriptionColorHex('violet')).toBe('#8B5CF6');
    expect(subscriptionColorHex(null)).toBe('#38BDF8');
    expect(subscriptionColorHex('bleu')).toBe('#38BDF8');
  });

  it('clé localStorage des semaines d’offre', () => {
    expect(offerWeekStorageKey('abc')).toBe('athlex:offerWeek:abc');
  });
});
