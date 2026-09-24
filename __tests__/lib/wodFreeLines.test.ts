import {
  movementRowsFromLines,
  serializeMovementRows,
  updateMovementRow,
  isStructuredMovementLine,
} from '@/lib/wodMovementRows';
import { descriptionToSave, movementLines } from '@/lib/wodFields';

// Lignes du catalogue, lignes libres de la programmation automatique, lignes
// mixtes (exercice du catalogue + consigne) et caractères spéciaux.
const CATALOGUE = ['21 Thruster (43/30 kg)', '20/15 cal Row', '400 m Run', '100 Double-Unders'];
// Lignes du catalogue écrites autrement que par l'éditeur : relues sans perte
// seulement grâce au texte d'origine (le sérialiseur écrirait « (43/30 kg) », « 400 m »).
const CATALOGUE_AUTRE_ECRITURE = ['21 Thruster @ 43/30 kg', '400m Run'];
const LIBRES = [
  "Musculation · Push · Tonification · 45'",
  "Échauffement (10') — mobilité épaules et hanches, barre à vide",
  "Every 2' × 8, en rotation :",
  'Impair · 15 KB Swings Russian @ 24/16 kg',
  'Women Pro / Men Pro : KB Swings Russian 28/20 kg',
  'Stimulus : RPE 8.5 — Allure course à 90 % du 5 km (cap 27:30)',
];
const MIXTES = [
  '21 Thruster (43/30 kg) — tempo lent (3 s en descente)',
  'R3 · 45 m Sled Pull (75/50 kg)',
  '12 Wall Ball Shots @ 9/6 kg, cible 3 m / 2,70 m',
];

/** Ce que l'éditeur réécrit quand il resérialise toutes les lignes (après une modification ailleurs). */
const roundTrip = (lines: string[]) => serializeMovementRows(movementRowsFromLines(lines));

describe('WodEditor — type de champ décidé à l’ouverture', () => {
  it.each([...CATALOGUE, ...CATALOGUE_AUTRE_ECRITURE])('ligne du catalogue « %s » : champs structurés avec suggestions', (l) => {
    expect(isStructuredMovementLine(l)).toBe(true);
    expect(movementRowsFromLines([l])[0].free).toBeFalsy();
  });
  it.each(LIBRES)('ligne libre « %s » : zone de texte libre', (l) => {
    expect(isStructuredMovementLine(l)).toBe(false);
    expect(movementRowsFromLines([l])[0].free).toBe(true);
  });
  it('une ligne vide ou une quantité seule reste structurée (saisie en cours)', () => {
    expect(isStructuredMovementLine('')).toBe(true);
    expect(isStructuredMovementLine('12')).toBe(true);
  });
  it('une ligne du catalogue renommée hors catalogue garde ses champs structurés', () => {
    const rows = movementRowsFromLines(['21 Thruster (43/30 kg)']);
    const renamed = updateMovementRow(rows, 0, { name: 'Thruster pause 2 s' });
    expect(renamed[0].free).toBeFalsy();
    expect(renamed[0].name).toBe('Thruster pause 2 s');
  });
});

describe('WodEditor — lignes réécrites au caractère près', () => {
  it.each([
    ['catalogue', CATALOGUE],
    ['du catalogue écrites autrement', CATALOGUE_AUTRE_ECRITURE],
    ['libres', LIBRES],
    ['mixtes', MIXTES],
    ['mélangées', [LIBRES[0], CATALOGUE[0], MIXTES[0], LIBRES[3], CATALOGUE[1]]],
  ])('lignes %s : resérialisation identique', (_, lines) => {
    expect(roundTrip(lines as string[])).toEqual(lines);
  });

  it('modifier une ligne ne touche aucune autre ligne, libre ou du catalogue', () => {
    const lines = [LIBRES[0], CATALOGUE[0], MIXTES[1], LIBRES[4], CATALOGUE[1]];
    const rows = movementRowsFromLines(lines);
    const out = serializeMovementRows(updateMovementRow(rows, 1, { reps: 15 }));
    expect(out).toEqual([LIBRES[0], '15 Thruster (43/30 kg)', MIXTES[1], LIBRES[4], CATALOGUE[1]]);
  });

  it('modifier une ligne libre change son texte et rien d’autre, tel que saisi', () => {
    const rows = movementRowsFromLines([LIBRES[0], CATALOGUE[0]]);
    const out = serializeMovementRows(updateMovementRow(rows, 0, { raw: "Musculation · Pull · 50' (@ la box)" }));
    expect(out).toEqual(["Musculation · Pull · 50' (@ la box)", CATALOGUE[0]]);
  });
});

describe('Whiteboard — séance ouverte puis enregistrée sans modification', () => {
  const DESCRIPTIONS = [
    ['catalogue', CATALOGUE.join('\n')],
    ['libres', LIBRES.join('\n')],
    ['mixtes', MIXTES.join('\n')],
    ['retours à la ligne et lignes vides', `${LIBRES[0]}\n\n${CATALOGUE[0]}\n${CATALOGUE[1]}\n\n\n${LIBRES[5]}`],
    ['espaces en bord de ligne', `  ${LIBRES[2]}\n${CATALOGUE[2]}   \n\t${MIXTES[2]}`],
    ['caractères spéciaux', "Min 1 · 8 Bench Press (60/43 kg)\nScaled 40/30 · RX+ 70/50 @ l'appréciation du coach\n(repos libre) / 'finisher' : 20 s"],
  ];

  it.each(DESCRIPTIONS)('%s : description identique au caractère près', (_, original) => {
    // À l'ouverture, le Whiteboard lit les lignes ; sans modification, l'éditeur ne les touche pas.
    const movements = movementLines(original);
    expect(descriptionToSave(original, movements)).toBe(original);
  });

  it.each(DESCRIPTIONS)('%s : identique même après une resérialisation complète des lignes', (_, original) => {
    // Une ligne ajoutée puis retirée déclenche une réécriture de toutes les lignes.
    const movements = roundTrip(movementLines(original));
    expect(descriptionToSave(original, movements)).toBe(original);
  });

  it('une modification réelle reconstruit la description ligne à ligne, comme avant', () => {
    const original = `${LIBRES[0]}\n\n${CATALOGUE[0]}`;
    const rows = movementRowsFromLines(movementLines(original));
    const movements = serializeMovementRows(updateMovementRow(rows, 1, { reps: 15 }));
    expect(descriptionToSave(original, movements)).toBe(`${LIBRES[0]}\n15 Thruster (43/30 kg)`);
  });

  it('une nouvelle séance sans description reste sans description', () => {
    expect(descriptionToSave(null, [])).toBeNull();
    expect(descriptionToSave(null, ['', '  '])).toBeNull();
  });
});
