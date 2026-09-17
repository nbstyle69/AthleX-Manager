import { BLOCKING_TABLES, assessEmptiness, pluralLabel, type BlockingCount } from '@/lib/boxDeletion';

const c = (table: string, count: number, restrict = false): BlockingCount =>
  ({ table, label: `${count} ${table}`, count, restrict });

describe('inventaire des tables emportées par une suppression', () => {
  it('couvre les trois tables qui BLOQUENT au lieu de cascader', () => {
    // `wod_scores`, `score_comments` et `message_replies` n'ont aucune action
    // de suppression : sans décompte préalable, Postgres rend un 23503 illisible.
    const restrict = BLOCKING_TABLES.filter(t => t.restrict).map(t => t.table).sort();
    expect(restrict).toEqual(['message_replies', 'score_comments', 'wod_scores']);
  });

  it('couvre les postes qu’un critère à cinq tables oubliait', () => {
    const tables = BLOCKING_TABLES.map(t => t.table);
    // Ceux-là partaient en cascade sans que rien ne les compte.
    for (const t of ['elo_history', 'box_elo_history', 'wod_completions',
      'box_cash_payments', 'box_invitations', 'membership_plans', 'class_reservations']) {
      expect(tables).toContain(t);
    }
    expect(BLOCKING_TABLES.length).toBeGreaterThan(30);
  });

  it('nomme chaque table au singulier et au pluriel, sans doublon', () => {
    expect(new Set(tablesOf()).size).toBe(BLOCKING_TABLES.length);
    for (const t of BLOCKING_TABLES) {
      expect(t.label[0].length).toBeGreaterThan(0);
      expect(t.label[1].length).toBeGreaterThan(0);
      expect(t.column).toMatch(/box_id$/);
    }
  });

  function tablesOf() { return BLOCKING_TABLES.map(t => `${t.table}.${t.column}`); }

  it('accorde le décompte', () => {
    const wods = BLOCKING_TABLES.find(t => t.table === 'box_wods')!;
    expect(pluralLabel(wods, 1)).toBe('1 WOD');
    expect(pluralLabel(wods, 12)).toBe('12 WODs');
  });
});

describe('assessEmptiness', () => {
  it('déclare vide une box sans rien, gérant seul et essai local compris', () => {
    // Le cas de la box fantôme : une seule ligne d'abonnement en essai, sans
    // identifiant Stripe. L'exiger vide rendrait cette box insupprimable.
    const r = assessEmptiness({ counts: [c('box_members', 1)], otherMembers: 0, stripeSubscriptions: 0 });
    expect(r.empty).toBe(true);
    expect(r.blockers).toEqual([]);
  });

  it('bloque sur un abonnement réellement rattaché à Stripe', () => {
    const r = assessEmptiness({ counts: [], otherMembers: 0, stripeSubscriptions: 1 });
    expect(r.empty).toBe(false);
    expect(r.blockers).toEqual(['1 abonnement Stripe']);
  });

  it('bloque sur un membre autre que le gérant', () => {
    const r = assessEmptiness({ counts: [c('box_members', 3)], otherMembers: 2, stripeSubscriptions: 0 });
    expect(r.empty).toBe(false);
    expect(r.blockers).toEqual(['2 membres autres que le gérant']);
  });

  it('énumère les postes bloquants du plus gros au plus petit', () => {
    const r = assessEmptiness({
      counts: [c('box_wods', 12), c('wod_scores', 3, true), c('tournaments', 0)],
      otherMembers: 0, stripeSubscriptions: 0,
    });
    expect(r.empty).toBe(false);
    expect(r.blockers).toEqual(['12 box_wods', '3 wod_scores']);
    // Un poste `restrict` doit se voir : il ferait échouer la requête elle-même.
    expect(r.hasRestrict).toBe(true);
  });

  it('ne signale pas de contrainte quand seuls des postes en cascade bloquent', () => {
    const r = assessEmptiness({ counts: [c('box_wods', 4)], otherMembers: 0, stripeSubscriptions: 0 });
    expect(r.hasRestrict).toBe(false);
  });
});
