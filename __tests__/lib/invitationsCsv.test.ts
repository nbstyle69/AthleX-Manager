import {
  parseInvitationsCsv, decodeCsv, verdictLabel, IMPORT_MAX_ROWS, invitationCsvTemplate,
} from '@/lib/invitationsCsv';

const PLANS = [
  { id: 'plan-illimite', name: 'Illimité' },
  { id: 'plan-3x', name: '3x / semaine' },
];

describe('parseInvitationsCsv', () => {
  it('lit un export Excel français (séparateur ;) et rattache la formule', () => {
    const csv = 'Prénom;Nom;Courriel;Formule\nÉlodie;Durand;Elodie.Durand@Exemple.fr;Illimité\n';
    const out = parseInvitationsCsv(csv, PLANS);
    expect(out.fatal).toBeNull();
    expect(out.ready).toBe(1);
    expect(out.rows[0]).toMatchObject({
      firstName: 'Élodie', email: 'elodie.durand@exemple.fr', planId: 'plan-illimite', error: null,
    });
  });

  it('lit une virgule, des guillemets et des alias anglais', () => {
    const csv = 'firstname,lastname,mail\n"Bon, Jean",Bon,jean@exemple.fr\n';
    const out = parseInvitationsCsv(csv, PLANS);
    expect(out.rows[0].firstName).toBe('Bon, Jean');
    expect(out.rows[0].email).toBe('jean@exemple.fr');
  });

  it('ignore les lignes vides et nettoie les espaces', () => {
    const csv = 'prenom;nom;email\n\n  Ana  ; Lopez ; ana@exemple.fr \n\n';
    const out = parseInvitationsCsv(csv, PLANS);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({ firstName: 'Ana', lastName: 'Lopez', email: 'ana@exemple.fr' });
  });

  it('signale les lignes fautives sans écarter les valides', () => {
    const csv = [
      'prenom;nom;email;formule',
      'A;A;a@exemple.fr;',
      'B;B;pas-un-email;',
      'C;C;a@exemple.fr;',
      'D;D;d@exemple.fr;Formule fantôme',
      'E;E;;',
    ].join('\n');
    const out = parseInvitationsCsv(csv, PLANS);
    expect(out.ready).toBe(1);
    expect(out.invalid).toBe(4);
    expect(out.rows.map(r => r.error)).toEqual([
      null, 'E-mail invalide', 'Doublon dans le fichier', 'Formule inconnue : « Formule fantôme »', 'E-mail manquant',
    ]);
  });

  it('numérote les lignes comme le tableur, en-tête comprise', () => {
    const csv = 'prenom;nom;email\nA;A;a@exemple.fr\nB;B;b@exemple.fr\n';
    expect(parseInvitationsCsv(csv, PLANS).rows.map(r => r.line)).toEqual([2, 3]);
  });

  it('refuse le fichier entier au-delà du plafond, plutôt que de le tronquer', () => {
    const body = Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, i) => `A;A;a${i}@exemple.fr`).join('\n');
    const out = parseInvitationsCsv(`prenom;nom;email\n${body}`, PLANS);
    expect(out.rows).toHaveLength(0);
    expect(out.fatal).toMatch(/501 lignes lues/);
  });

  it('refuse un fichier sans colonne e-mail', () => {
    expect(parseInvitationsCsv('prenom;nom\nA;B', PLANS).fatal).toMatch(/colonne e-mail/);
  });

  it('refuse un fichier vide', () => {
    expect(parseInvitationsCsv('   \n\n', PLANS).fatal).toBe('Fichier vide.');
  });
});

describe('decodeCsv', () => {
  const bytes = (...b: number[]) => new Uint8Array(b).buffer;

  it('retire le BOM UTF-8', () => {
    expect(decodeCsv(bytes(0xef, 0xbb, 0xbf, 0x61))).toBe('a');
  });

  it('retombe sur Latin-1 quand l’UTF-8 strict échoue (accents Excel)', () => {
    // 0xE9 seul est un « é » Latin-1 et une séquence UTF-8 invalide.
    expect(decodeCsv(bytes(0x50, 0x72, 0xe9, 0x6e, 0x6f, 0x6d))).toBe('Prénom');
  });
});

describe('verdictLabel', () => {
  it('traduit le verdict serveur et sa raison', () => {
    expect(verdictLabel('ignoree', 'deja_membre')).toBe('Ignorée — déjà membre de ta box');
    expect(verdictLabel('creee', null)).toBe('Invitation créée');
  });
});

describe('prochaine échéance (lot 3)', () => {
  const NOW = new Date('2026-09-27T10:00:00Z');
  const parse = (dates: string[]) => parseInvitationsCsv(
    'email;formule;prochaine échéance\n' + dates.map((d, i) => `m${i}@b.fr;Illimité;${d}`).join('\n'),
    PLANS, NOW,
  );

  it('lit JJ/MM/AAAA, facultative', () => {
    const { rows, ready } = parse(['15/10/2026', '5/1/2027', '']);
    expect(rows.map((r) => r.dueDate)).toEqual(['2026-10-15', '2027-01-05', null]);
    expect(ready).toBe(3);
  });

  it('refuse par ligne une date mal formée, passée ou à plus de 12 mois', () => {
    const { rows, ready } = parse(['2026-10-15', '31/02/2027', '27/09/2026', '28/09/2027', '27/09/2027']);
    expect(rows.map((r) => r.error)).toEqual([
      'Échéance mal formée : « 2026-10-15 » (JJ/MM/AAAA attendu)',
      'Échéance mal formée : « 31/02/2027 » (JJ/MM/AAAA attendu)',
      'Échéance passée',
      'Échéance à plus de 12 mois',
      null,
    ]);
    expect(ready).toBe(1);
  });

  it('reconnaît les en-têtes sans accent', () => {
    const { rows } = parseInvitationsCsv('email;echeance\na@b.fr;01/12/2026', PLANS, NOW);
    expect(rows[0].dueDate).toBe('2026-12-01');
  });

  it('traduit les verdicts serveur d’échéance', () => {
    expect(verdictLabel('refusee', 'DUE_DATE_PAST')).toBe('Refusée — échéance passée');
    expect(verdictLabel('refusee', 'DUE_DATE_INVALID')).toBe('Refusée — échéance mal formée');
    expect(verdictLabel('refusee', 'DUE_DATE_TOO_FAR')).toBe('Refusée — échéance à plus de 12 mois');
  });

  it('le modèle porte une échéance d’exemple valable, relue sans erreur', () => {
    const { rows } = parseInvitationsCsv(invitationCsvTemplate(NOW), PLANS, NOW);
    expect(rows.map((r) => r.error)).toEqual([null, null]);
    expect(rows[0].dueDate).toBe('2026-10-27');
  });
});
