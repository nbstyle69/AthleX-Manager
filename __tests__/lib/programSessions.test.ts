import fs from 'fs';
import path from 'path';
import { EMPTY_WOD_FORM, sharedWodColumns } from '@/lib/wodFields';
import {
  ProgramWod,
  caseVoisine, colonnesSeance, csvSeances, estJourRepos, estSeanceRelative, formulaireDepuisSeance,
  jourIsoDe, nombreSemaines, reposDeSemaine, seancesDatees, seancesDeCase, seancesDeSemaine, semaineSuivante,
} from '@/lib/programContent';

jest.mock('@/lib/supabase/client', () => ({ createClient: () => { throw new Error('pas de réseau en test'); } }));

/**
 * Séances d'un programme athlète : une grille RELATIVE (semaine × jour) et
 * non un calendrier. Le Whiteboard de la box, lui, lit `box_wods` par
 * `scheduled_date` : une séance relative (`scheduled_date = NULL`) ne peut
 * pas y tomber, et un WOD daté ne peut pas devenir une séance de programme
 * sans passer par le formulaire. Ces tests fixent ces deux sens.
 */

const seance = (o: Partial<ProgramWod>): ProgramWod => ({
  id: o.id ?? Math.random().toString(36).slice(2),
  title: 'Séance', description: null, wod_type: 'amrap', block_name: null,
  time_cap_seconds: null, rounds: null, notes: null, video_url: null,
  leaderboard_enabled: true, emom_interval_minutes: null, tabata_work_seconds: null, tabata_rest_seconds: null,
  scheduled_date: null, program_week: 1, program_day: 1, sort_order: 0, is_published: true,
  ...o,
});

describe('mapping semaine × jour', () => {
  const wods = [
    seance({ id: 'a', program_week: 1, program_day: 1, sort_order: 1 }),
    seance({ id: 'b', program_week: 1, program_day: 1, sort_order: 0 }),
    seance({ id: 'c', program_week: 1, program_day: 3 }),
    seance({ id: 'd', program_week: 2, program_day: 1 }),
    seance({ id: 'elite', scheduled_date: '2026-04-13', program_week: null, program_day: null }),
  ];

  it('une case ne montre que ses séances, dans l’ordre', () => {
    expect(seancesDeCase(wods, 1, 1).map(w => w.id)).toEqual(['b', 'a']);
    expect(seancesDeCase(wods, 1, 3).map(w => w.id)).toEqual(['c']);
    expect(seancesDeCase(wods, 2, 1).map(w => w.id)).toEqual(['d']);
    expect(seancesDeCase(wods, 3, 1)).toEqual([]);
  });

  it('une semaine regroupe ses 7 jours et rien d’autre', () => {
    expect(seancesDeSemaine(wods, 1).map(w => w.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('une séance datée (ancien modèle) n’entre dans aucune case relative', () => {
    expect(estSeanceRelative(wods[4])).toBe(false);
    for (let w = 1; w <= 3; w++) for (let d = 1; d <= 7; d++) {
      expect(seancesDeCase(wods, w, d).map(x => x.id)).not.toContain('elite');
    }
    expect(seancesDatees(wods).map(w => w.id)).toEqual(['elite']);
  });

  it('jour ISO : lundi = 1, dimanche = 7', () => {
    expect(jourIsoDe('2026-04-13')).toBe(1);
    expect(jourIsoDe('2026-04-19')).toBe(7);
  });

  it('un repos est une marque explicite du coach, par semaine et par jour — jamais déduit de Nj/sem', () => {
    const repos = [{ program_week: 1, program_day: 3 }, { program_week: 2, program_day: 7 }];
    expect(estJourRepos(repos, 1, 3)).toBe(true);
    expect(estJourRepos(repos, 2, 3)).toBe(false);
    expect(estJourRepos(repos, 2, 7)).toBe(true);
    // Sam/Dim sans marque : jours vides, pas des repos.
    expect(estJourRepos(repos, 1, 6)).toBe(false);
    expect(estJourRepos(repos, 1, 7)).toBe(false);
    expect(estJourRepos([], 1, 7)).toBe(false);
    expect(reposDeSemaine(repos, 2)).toEqual([{ program_week: 2, program_day: 7 }]);
  });

  it('une séance de programme ne porte jamais de leaderboard (pas d’ELO)', () => {
    const form = { ...EMPTY_WOD_FORM, title: 'X', week: 1, dayOfWeek: 1, leaderboard: true };
    expect(colonnesSeance(form, []).leaderboard_enabled).toBe(false);
    const w = seance({ leaderboard_enabled: true });
    expect(formulaireDepuisSeance(w, 1).leaderboard).toBe(false);
  });

  it('déplacer d’un jour reste dans la semaine', () => {
    expect(caseVoisine({ week: 2, day: 1 }, 'prev')).toBeNull();
    expect(caseVoisine({ week: 2, day: 7 }, 'next')).toBeNull();
    expect(caseVoisine({ week: 2, day: 3 }, 'next')).toEqual({ week: 2, day: 4 });
  });

  it('dupliquer = même jour, semaine + 1 (jamais une date)', () => {
    expect(semaineSuivante({ week: 4, day: 5 })).toEqual({ week: 5, day: 5 });
  });

  it('le nombre de semaines suit la durée du programme fixe, ou la dernière semaine écrite + 1 en ongoing', () => {
    expect(nombreSemaines({ type: 'fixed', duration_weeks: 6 }, wods)).toBe(6);
    expect(nombreSemaines({ type: 'ongoing', duration_weeks: null }, wods)).toBe(3);
    expect(nombreSemaines({ type: 'ongoing', duration_weeks: null }, [])).toBe(1);
  });
});

describe('formulaire partagé → séance de programme', () => {
  const form = {
    ...EMPTY_WOD_FORM,
    title: 'Fran', wod_type: 'for-time', block: 'metcon', timeCap: '10:00', rounds: '21-15-9',
    notes: 'go', videoUrl: 'https://youtu.be/x', week: 3, dayOfWeek: 4, published: false,
    // Ce que le Whiteboard porterait et qu'une séance de programme ne doit jamais écrire :
    date: '2026-04-13', groupIds: ['g1'], programIds: ['autre-programme'],
  };
  const movements = ['21 Thrusters @ 43/30 kg', '21 Pull-Ups'];

  it('écrit un ancrage relatif et force scheduled_date à null', () => {
    const p = colonnesSeance(form, movements);
    expect(p.scheduled_date).toBeNull();
    expect(p.program_week).toBe(3);
    expect(p.program_day).toBe(4);
    expect(p.is_published).toBe(false);
  });

  it('borne la semaine à 1 et le jour à 1..7', () => {
    expect(colonnesSeance({ ...form, week: 0, dayOfWeek: 9 }, [])).toMatchObject({ program_week: 1, program_day: 7 });
  });

  it('description : la même sérialisation que le Whiteboard, sans code spécifique', () => {
    const p = colonnesSeance(form, movements);
    const whiteboard = sharedWodColumns(form, movements);
    expect(p.description).toBe(whiteboard.description);
    expect(p.description).toContain('21 Thrusters @ 43/30 kg');
    expect(p.title).toBe(whiteboard.title);
    expect(p.block_name).toBe('metcon');
    expect(p.time_cap_seconds).toBe(600);
  });

  it('ne porte ni groupe ni liste de programmes : le rattachement est celui de la page', () => {
    const p = colonnesSeance(form, movements) as unknown as Record<string, unknown>;
    expect(p).not.toHaveProperty('groupIds');
    expect(p).not.toHaveProperty('programIds');
    expect(p).not.toHaveProperty('group_ids');
    expect(p).not.toHaveProperty('program_ids');
  });

  it('séance → formulaire : ancrage relatif relu, verrous posés', () => {
    const f = formulaireDepuisSeance(seance({ program_week: 5, program_day: 2, title: 'X', block_name: 'strength', time_cap_seconds: 900 }), 1);
    expect(f.week).toBe(5);
    expect(f.dayOfWeek).toBe(2);
    expect(f.timeCap).toBe('15:00');
    expect(f.block).toBe('strength');
    expect(f.date).toBe('');
    expect(f.groupIds).toEqual([]);
    expect(f.programIds).toEqual([]);
  });

  it('séance datée → formulaire : semaine affichée, jour de sa date', () => {
    const f = formulaireDepuisSeance(seance({ scheduled_date: '2026-04-15', program_week: null, program_day: null }), 4);
    expect(f.week).toBe(4);
    expect(f.dayOfWeek).toBe(3);
  });

  it('export CSV : semaine, jour, contenu — pas de date', () => {
    const csv = csvSeances([seance({ program_week: 2, program_day: 3, title: 'A "B"', wod_type: 'emom' })]);
    const [head, ligne] = csv.split('\n');
    expect(head.startsWith('week,day,title,type,description')).toBe(true);
    expect(ligne.startsWith('2,3,"A ""B""",emom')).toBe(true);
    expect(csv).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe('verrouillage sur le programme courant', () => {
  const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
  const editeur = lire('components/programs/ProgramSessionsEditor.tsx');
  const contenu = lire('lib/programContent.ts');
  const wodEditor = lire('components/wods/WodEditor.tsx');
  const page = lire('components/programs/AthleteProgramsWorkspace.tsx');

  it('la page Séances utilise le formulaire partagé du Whiteboard en mode « program »', () => {
    expect(editeur).toContain('<WodEditor');
    expect(editeur).toContain('mode="program"');
    expect(editeur).toContain('lockedProgram={{ id: program.id, title: program.title, type: program.type }}');
    expect(editeur).not.toMatch(/groups=/);
    expect(editeur).not.toMatch(/programs=\{/);
  });

  it('le mode « program » affiche le programme en chip non modifiable et ne propose ni groupe ni date', () => {
    expect(wodEditor).toContain('data-testid="programme-verrouille"');
    // Le bloc « Qui reçoit ce WOD ? » (audience box, groupes, programmes, offres)
    // est derrière `isWhiteboard` : le mode program n'en montre rien.
    expect(wodEditor).toMatch(/\{isWhiteboard && \(\s*<AudienceBlock/);
    expect(wodEditor).toMatch(/\{isWhiteboard \? \([\s\S]{0,400}Date \*/);
  });

  it('la création rattache la séance au programme de la page, et le retire si le lien échoue', () => {
    expect(contenu).toMatch(/from\('wod_program_access'\)\s*\.insert\(\{ wod_id: wodId, program_id: programId \}\)/);
    expect(contenu).toMatch(/erreurLien[\s\S]{0,120}from\('box_wods'\)\.delete\(\)\.eq\('id', wodId\)/);
    expect(editeur).toContain('createProgramWod(program.id, program.box_id, userId,');
  });

  it('aucune écriture de la page ne pose une date : le Whiteboard ne peut pas voir une séance de programme', () => {
    const valeurs = [...contenu.matchAll(/scheduled_date:\s*([^,;\n]+)/g)].map(m => m[1].trim());
    expect(valeurs.length).toBeGreaterThan(0);
    // Types (`string | null`, `null`), destructuration (`_d`) ou écriture `null` : jamais une date.
    for (const v of valeurs) expect(['null', 'string | null', '_d']).toContain(v);
    expect(editeur).not.toMatch(/scheduled_date:/);
    expect(contenu).not.toContain('addDays');
    expect(contenu).not.toContain('ancreProgramme');
  });

  it('la liste des programmes délègue la page Séances au composant dédié', () => {
    expect(page).toContain('<ProgramSessionsEditor');
    expect(page).not.toContain('wodDate');
    expect(page).not.toContain('ancreProgramme');
  });
});
