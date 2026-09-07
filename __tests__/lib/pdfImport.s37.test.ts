/**
 * Fixture réelle K+ Perf S37 (`__fixtures__/kplus-perf/S37.pdf`). Le worker pdf.js ne
 * se charge pas sous jest : le texte par page est extrait avec la même lib que la route
 * (`node scripts/pdf-fixture-extract.mjs …/S37.pdf` → `S37.pages.json`), puis passé
 * dans détection → parseDocument et comparé entrée par entrée au JSON attendu.
 *
 * Régénérer l'attendu après une évolution volontaire du parseur :
 *   UPDATE_FIXTURES=1 npx jest pdfImport.s37
 */
import fs from 'fs';
import path from 'path';
import { parseDocument } from '@/lib/pdfImport/core';
import { detectProfile, profileBySlug } from '@/lib/pdfImport/profiles';
import type { ImportEntry, ImportResult, PdfPage } from '@/lib/pdfImport/types';

const FIXTURES = path.join(__dirname, '..', '__fixtures__', 'kplus-perf');
const PAGES = path.join(FIXTURES, 'S37.pages.json');
const EXPECTED = path.join(FIXTURES, 'S37.expected.json');
const WEEK_START = '2026-09-07';

function loadPages(): PdfPage[] {
  return JSON.parse(fs.readFileSync(PAGES, 'utf8')) as PdfPage[];
}

/** Sans `key`/`order` (dépendent de l'ordre d'itération) pour rendre le diff lisible. */
function stable(e: ImportEntry) {
  const { key: _k, order: _o, ...rest } = e;
  return rest;
}

describe('K+ Perf — fixture réelle S37', () => {
  let pages: PdfPage[];
  let result: ImportResult;

  beforeAll(() => {
    pages = loadPages();
    const profile = profileBySlug('kplus-perf')!;
    result = parseDocument(pages, profile, WEEK_START, {});
    if (process.env.UPDATE_FIXTURES) {
      fs.writeFileSync(EXPECTED, JSON.stringify({ ...result, entries: result.entries.map(stable) }, null, 2) + '\n');
    }
  });

  it('a 7 pages : 1 intro + 6 jours', () => {
    expect(pages).toHaveLength(7);
    expect(result.week_notes).toMatch(/LASHA TALAKHADZE/);
  });

  it('est détecté comme kplus-perf sans forçage', () => {
    const { profile, scores } = detectProfile(pages);
    expect(profile.slug).toBe('kplus-perf');
    expect(scores['kplus-perf']).toBeGreaterThanOrEqual(0.7);
  });

  it('couvre les 6 jours lundi → samedi', () => {
    const dates = Array.from(new Set(result.entries.map(e => e.date))).sort();
    expect(dates).toEqual(['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12']);
  });

  describe('lundi — section HALTERO implicite (§2.2)', () => {
    it("sort en skill-haltero avec 2) SNATCH et 3) SNATCH PULL en lignes force, warm-up en notes", () => {
      const haltero = result.entries.find(e => e.date === '2026-09-07' && /^HALTERO/.test(e.title))!;
      expect(haltero).toBeDefined();
      expect(haltero.block).toBe('skill-haltero');
      expect(haltero.type).toBe('strength');
      expect(haltero.musculation.map(m => `${m.exercise} ${m.sets}x${m.reps}`)).toEqual([
        'Squat Snatch 1x3', 'Squat Snatch 1x2', 'Squat Snatch 1x1', 'Squat Snatch 6x1', 'Snatch High Pull 4x3',
      ]);
      // Le warm-up (`4 Rounds : de barre à vide à 30%` + Muscle/Power Snatch…) n'est pas crédité en mouvements.
      expect(haltero.movements).toEqual([]);
      expect(haltero.rounds).toBeNull();
      expect(haltero.notes_coach).toMatch(/Échauffement : 4 Rounds : de barre à vide à 30% — 1 Muscle Snatch — 1 Power Snatch — 1 Snatch balance — 1 Squat Snatch/);
    });
  });

  it('les noms non résolus sont listés (décision catalogue séparée)', () => {
    expect(Array.isArray(result.unresolved_movements)).toBe(true);
  });

  it('correspond entrée par entrée au JSON attendu', () => {
    const expected = JSON.parse(fs.readFileSync(EXPECTED, 'utf8')) as ImportResult;
    const actual = result.entries.map(stable);
    expect(actual).toHaveLength(expected.entries.length);
    actual.forEach((e, i) => expect(e).toEqual(expected.entries[i]));
    expect(result.unresolved_movements).toEqual(expected.unresolved_movements);
    expect(result.week_notes).toEqual(expected.week_notes);
  });
});
