import { readFileSync } from 'fs';
import { join } from 'path';
import { applyWeekNotes } from '@/lib/programWeek';

describe('applyWeekNotes', () => {
  it('nomme les WOD conservés, pas seulement les WOD posés', () => {
    const notes = applyWeekNotes({ inserted: 4, replaced: 4, keptWithResults: 3, skipped: 0 });
    expect(notes).toEqual([
      '4 WOD vierges remplacés.',
      '3 WOD conservés car ils portent des scores ou des complétions.',
    ]);
  });

  it('accorde au singulier', () => {
    const notes = applyWeekNotes({ inserted: 1, replaced: 1, keptWithResults: 1, skipped: 1 });
    expect(notes).toEqual([
      '1 WOD vierge remplacé.',
      '1 WOD conservé car il porte des scores ou des complétions.',
      '1 WOD non reposé : sa place est tenue par un WOD conservé.',
    ]);
  });

  it('ne dit rien quand il n’y a rien à dire', () => {
    expect(applyWeekNotes({ inserted: 3, replaced: 0, keptWithResults: 0, skipped: 0 })).toEqual([]);
  });
});

describe('ApplyProgramWeekModal', () => {
  const src = readFileSync(
    join(process.cwd(), 'components/wods/ApplyProgramWeekModal.tsx'),
    'utf8',
  );

  // L'ancienne version annonçait « supprimera ces WOD (et leurs scores) » : le
  // serveur ne le fait plus, et une promesse de suppression que le serveur
  // refuse est un mensonge à l'écran.
  it('ne promet plus de supprimer des scores', () => {
    expect(src).not.toMatch(/et leurs scores/);
    expect(src).toMatch(/conserv/);
  });

  it('interroge les conflits par jour de calendrier, avec leur provenance', () => {
    expect(src).toContain('list_program_week_conflicts');
    expect(src).toMatch(/origin/);
    expect(src).toMatch(/has_results/);
  });

  it('applique les deux sources par le même p_source_kind', () => {
    expect(src).toContain('selected.kind');
    expect(src).toMatch(/'template'/);
    expect(src).toMatch(/'subscription'/);
  });
});
