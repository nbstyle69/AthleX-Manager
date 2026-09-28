import fs from 'fs';
import path from 'path';
import { parseWodImportFile } from '@/lib/wodImport';

const ROOT = path.join(__dirname, '..', '..');
const DIRS = ['app', 'components', 'lib', 'data', 'scripts', 'middleware.ts'];
const EXT = /\.(ts|tsx|js|jsx|mjs)$/;

function sources(p: string): string[] {
  const abs = path.join(ROOT, p);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return EXT.test(p) ? [p] : [];
  return fs.readdirSync(abs).flatMap(n => sources(path.join(p, n)));
}

describe('import de WODs : CSV / JSON seulement', () => {
  it.each(['/api/wods/import-pdf', 'parse-wod-pdf'])('aucun fichier n’appelle plus %s', cible => {
    const fautifs = DIRS.flatMap(sources).filter(f => fs.readFileSync(path.join(ROOT, f), 'utf8').includes(cible));
    expect(fautifs).toEqual([]);
  });

  it('le parseur CSV lit toujours un exemple Whiteboard', () => {
    const csv = [
      'date,title,type,description,timecap,rounds,notes,block,published,rank,groups',
      '2026-09-28,Fran,for_time,21-15-9 Thruster / Pull-up,10,,,,true,true,',
    ].join('\n');
    const { rows, errors } = parseWodImportFile(csv, 'wods.csv', 'whiteboard');
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: 'Fran', type: 'for_time', date: '2026-09-28' });
  });

  it('le parseur CSV lit toujours un exemple de programmation', () => {
    const csv = ['week,day,title,type,description,timecap,rounds,notes,block', '2,3,Cindy,amrap,5 Pull-up / 10 Push-up / 15 Squat,20,,,'].join('\n');
    const { rows, errors } = parseWodImportFile(csv, 'prog.csv', 'programming', 4);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ title: 'Cindy', week: 2, day: 3 });
  });
});
