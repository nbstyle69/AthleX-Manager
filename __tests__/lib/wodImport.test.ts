import {
  dateToWeekDay, parseWodImportFile, wodCsvTemplate, wodCsvTemplateFileName,
} from '@/lib/wodImport';
import { parseCap } from '@/lib/wodFields';

describe('templates CSV', () => {
  it('le mode programmation ancre en semaine/jour et n’expose aucun accès', () => {
    const header = wodCsvTemplate('programming').split('\n')[0];
    expect(header).toBe('week,day,title,type,description,timecap,rounds,notes,block');
    expect(header).not.toContain('groups');
    expect(header).not.toContain('date');
    expect(wodCsvTemplateFileName('programming')).toBe('template_programmation.csv');
  });

  it('le mode whiteboard garde la date et les groupes', () => {
    const header = wodCsvTemplate('whiteboard').split('\n')[0];
    expect(header).toBe('date,title,type,description,timecap,rounds,notes,block,published,rank,groups');
  });

  it('chaque template se relit par son propre parseur', () => {
    for (const mode of ['whiteboard', 'programming'] as const) {
      const { rows, errors } = parseWodImportFile(wodCsvTemplate(mode), 'template.csv', mode);
      expect(errors).toEqual([]);
      expect(rows).toHaveLength(5);
    }
  });
});

describe('CSV whiteboard', () => {
  const csv = [
    'date,title,type,description,timecap,rounds,notes,block,published,rank,groups',
    '2026-03-10,Fran,for-time,"21-15-9 Thrusters, then Pull-ups",12:30,3,Note,wod,false,false,Compétiteurs|Matin',
  ].join('\n');

  it('lit les guillemets, les booléens et les groupes', () => {
    const { rows, errors } = parseWodImportFile(csv, 'w.csv', 'whiteboard');
    expect(errors).toEqual([]);
    expect(rows[0].date).toBe('2026-03-10');
    expect(rows[0].description).toBe('21-15-9 Thrusters, then Pull-ups');
    expect(rows[0].published).toBe(false);
    expect(rows[0].rank).toBe(false);
    expect(rows[0].groupNames).toEqual(['Compétiteurs', 'Matin']);
  });

  it('refuse une date absente ou mal formée sans avaler la ligne en silence', () => {
    const bad = 'date,title\n10/03/2026,Fran';
    const { rows, errors } = parseWodImportFile(bad, 'w.csv', 'whiteboard');
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('date invalide');
  });
});

describe('CSV programmation', () => {
  it('mappe semaine et jour, sans groupe ni publication', () => {
    const csv = [
      'week,day,title,type,description,timecap,rounds,notes,block',
      '2,5,Karen,for-time,150 Wall Balls,12:30,,Note,wod',
    ].join('\n');
    const { rows, errors } = parseWodImportFile(csv, 'p.csv', 'programming', 4);
    expect(errors).toEqual([]);
    expect(rows[0].week).toBe(2);
    expect(rows[0].day).toBe(5);
    expect(rows[0].groupNames).toEqual([]);
    // Le cap traverse l'import sans perdre ses secondes.
    expect(parseCap(rows[0].timeCap)).toBe(750);
  });

  it('borne la semaine au nombre de semaines de l’offre', () => {
    const csv = 'week,day,title\n9,1,Trop loin\n1,1,Bonne';
    const { rows, errors } = parseWodImportFile(csv, 'p.csv', 'programming', 4);
    expect(rows.map((r) => r.title)).toEqual(['Bonne']);
    expect(errors[0]).toContain('semaine (1..4)');
  });

  it('refuse un jour hors 1..7', () => {
    const csv = 'week,day,title\n1,0,Zéro\n1,8,Huit';
    const { rows, errors } = parseWodImportFile(csv, 'p.csv', 'programming', 4);
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(2);
  });

  it('refuse une ligne sans titre', () => {
    const csv = 'week,day,title\n1,1,';
    const { rows, errors } = parseWodImportFile(csv, 'p.csv', 'programming');
    expect(rows).toHaveLength(0);
    expect(errors[0]).toContain('titre manquant');
  });
});

describe('JSON', () => {
  it('accepte un objet seul comme un tableau (whiteboard)', () => {
    const json = JSON.stringify({ date: '2026-03-10', title: 'Fran', timecap: '12:30', groups: ['Matin'] });
    const { rows, errors } = parseWodImportFile(json, 'w.json', 'whiteboard');
    expect(errors).toEqual([]);
    expect(rows[0].groupNames).toEqual(['Matin']);
    expect(parseCap(rows[0].timeCap)).toBe(750);
  });

  it('exige semaine et jour en programmation', () => {
    const json = JSON.stringify([
      { week: 1, day: 3, title: 'Cindy' },
      { title: 'Sans ancrage' },
    ]);
    const { rows, errors } = parseWodImportFile(json, 'p.json', 'programming', 4);
    expect(rows).toHaveLength(1);
    expect(rows[0].day).toBe(3);
    expect(errors).toHaveLength(1);
  });

  it('signale un JSON illisible', () => {
    const { rows, errors } = parseWodImportFile('{oops', 'p.json', 'programming');
    expect(rows).toHaveLength(0);
    expect(errors).toEqual(['Fichier JSON invalide']);
  });
});

describe('dateToWeekDay', () => {
  it('convertit la sortie datée du PDF en semaine × jour ISO', () => {
    // 2026-03-09 est un lundi.
    expect(dateToWeekDay('2026-03-09', '2026-03-09')).toEqual({ week: 1, day: 1 });
    expect(dateToWeekDay('2026-03-15', '2026-03-09')).toEqual({ week: 1, day: 7 });
    expect(dateToWeekDay('2026-03-16', '2026-03-09')).toEqual({ week: 2, day: 1 });
    expect(dateToWeekDay('2026-03-27', '2026-03-09')).toEqual({ week: 3, day: 5 });
  });

  it('ramène la date de départ à son lundi', () => {
    // Départ un mercredi : le lundi de la même semaine reste la semaine 1.
    expect(dateToWeekDay('2026-03-09', '2026-03-11')).toEqual({ week: 1, day: 1 });
    expect(dateToWeekDay('2026-03-16', '2026-03-11')).toEqual({ week: 2, day: 1 });
  });

  it('ne descend jamais sous la semaine 1', () => {
    expect(dateToWeekDay('2026-02-20', '2026-03-09').week).toBe(1);
  });
});
