import {
  eloChoiceOf,
  sortMembers,
  sortStateForEloChoice,
  type EloChoice,
  type SortableMember,
} from '@/lib/memberSort';

const m = (username: string, elo: number, level = 'rx'): SortableMember => ({
  username,
  elo,
  level,
  plan_id: null,
  role: 'member',
  is_banned: false,
});

const MEMBRES = [m('cleo', 1200, 'scaled'), m('bob', 900, 'rx+'), m('ana', 1050, 'rx')];

const noms = (list: SortableMember[]) => list.map((x) => x.username);
const plan = () => '';

describe('tri /members — la puce ELO affichée active est celle qui trie', () => {
  it.each<EloChoice>(['asc', 'desc'])(
    'la puce « %s » trie par ELO même après un clic sur une autre colonne',
    (choice) => {
      // l'écran est d'abord trié par une autre colonne (clic d'en-tête)
      expect(noms(sortMembers(MEMBRES, { sortCol: 'level', sortDir: 'asc' }, plan)))
        .toEqual(['cleo', 'ana', 'bob']);

      // puis la puce ELO est cliquée : c'est elle qui décide, pas la colonne d'avant
      const etat = sortStateForEloChoice(choice);
      expect(eloChoiceOf(etat)).toBe(choice);
      const trie = noms(sortMembers(MEMBRES, etat, plan));
      expect(trie).toEqual(choice === 'asc' ? ['bob', 'ana', 'cleo'] : ['cleo', 'ana', 'bob']);
    },
  );

  it('« Défaut » rend l’ordre d’origine, il ne laisse pas une colonne trier en sourdine', () => {
    const etat = sortStateForEloChoice('');
    expect(noms(sortMembers(MEMBRES, etat, plan))).toEqual(['cleo', 'bob', 'ana']);
  });

  it('la puce ne s’allume que si le tri appliqué est bien un tri ELO', () => {
    expect(eloChoiceOf({ sortCol: 'elo', sortDir: 'desc' })).toBe('desc');
    expect(eloChoiceOf({ sortCol: 'elo', sortDir: 'asc' })).toBe('asc');
    expect(eloChoiceOf({ sortCol: 'level', sortDir: 'asc' })).toBe('');
    expect(eloChoiceOf({ sortCol: '', sortDir: 'asc' })).toBe('');
  });

  it('un clic sur l’en-tête ELO et la puce correspondante décrivent le même état', () => {
    (['asc', 'desc'] as const).forEach((dir) => {
      const enTete = { sortCol: 'elo' as const, sortDir: dir };
      expect(sortStateForEloChoice(eloChoiceOf(enTete))).toEqual(enTete);
    });
  });

  it('le tri par colonne reste intact pour les autres colonnes', () => {
    expect(noms(sortMembers(MEMBRES, { sortCol: 'username', sortDir: 'asc' }, plan)))
      .toEqual(['ana', 'bob', 'cleo']);
    expect(noms(sortMembers(MEMBRES, { sortCol: 'level', sortDir: 'desc' }, plan)))
      .toEqual(['bob', 'ana', 'cleo']);
  });
});
