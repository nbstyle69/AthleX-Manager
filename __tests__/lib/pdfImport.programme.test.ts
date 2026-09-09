import fs from 'fs';
import path from 'path';
import {
  ANCRE_IMPORT_PROGRAMME, caseDepuisDate, dateFictive, entryToProgramWod, rangsParCase, recalerSurSemaine, semainesCouvertes,
} from '@/lib/pdfImport/programme';
import { entryToBoxWod } from '@/lib/pdfImport/serialize';
import { parseDocument } from '@/lib/pdfImport/core';
import { kplusPerf } from '@/lib/pdfImport/profiles/kplus-perf';
import type { ImportEntry } from '@/lib/pdfImport/types';

/**
 * PR (c) — import PDF sur la page « Séances » d'un programme athlète.
 * Le cœur PDF ne change pas : il date à partir d'un lundi fictif, relu ensuite
 * en semaine × jour. Destination : programme courant, jamais le Whiteboard.
 */

const base: ImportEntry = {
  key: 'k', date: ANCRE_IMPORT_PROGRAMME, order: 1, block: 'wod', type: 'for-time', title: 'METCON — Thruster (For Time)',
  movements: [{ name: 'Thruster', resolved: true, reps: '21', charge_h: '43kg', charge_f: '30kg', note: null }],
  musculation: [], timecap: '12:00', rounds: null, emom_interval_minutes: null,
  tabata_work_seconds: null, tabata_rest_seconds: null, notes_coach: '',
  video_url: null, groups: ['Compétiteurs'], programs: ['Autre programme'], published: true, rank: true,
  source_profile: 'kplus-perf', source_page: 3, warnings: [],
};

describe('ancrage fictif ↔ semaine × jour', () => {
  it("l'ancrage est un lundi", () => {
    expect(new Date(`${ANCRE_IMPORT_PROGRAMME}T00:00:00Z`).getUTCDay()).toBe(1);
  });
  it('dateFictive et caseDepuisDate sont inverses (Lun=1 … Dim=7)', () => {
    for (const week of [1, 2, 6, 13]) {
      for (let day = 1; day <= 7; day++) {
        expect(caseDepuisDate(dateFictive(week, day))).toEqual({ week, day });
      }
    }
    expect(caseDepuisDate(ANCRE_IMPORT_PROGRAMME)).toEqual({ week: 1, day: 1 });
    expect(caseDepuisDate('2001-01-07')).toEqual({ week: 1, day: 7 });
    expect(caseDepuisDate('2001-01-08')).toEqual({ week: 2, day: 1 });
  });
  it("une date antérieure à l'ancrage est bornée à S1 J1", () => {
    expect(caseDepuisDate('2000-12-25')).toEqual({ week: 1, day: 1 });
  });
});

describe('semaine cible et documents multi-semaines', () => {
  const doc = [
    { ...base, key: 'a', date: dateFictive(1, 1) },
    { ...base, key: 'b', date: dateFictive(1, 3) },
    { ...base, key: 'c', date: dateFictive(2, 5) },
  ];
  it('recalerSurSemaine décale toutes les cartes en bloc, jour conservé', () => {
    const out = recalerSurSemaine(doc, 4);
    expect(out.map(e => caseDepuisDate(e.date))).toEqual([
      { week: 4, day: 1 }, { week: 4, day: 3 }, { week: 5, day: 5 },
    ]);
    expect(recalerSurSemaine(doc, 1)).toBe(doc);
  });
  it('semainesCouvertes liste les semaines distinctes, triées', () => {
    expect(semainesCouvertes(doc)).toEqual([1, 2]);
    expect(semainesCouvertes(recalerSurSemaine(doc, 3))).toEqual([3, 4]);
  });
  it('rangsParCase numérote les cartes dans la même case', () => {
    expect(rangsParCase([doc[0], { ...doc[0], key: 'a2' }, doc[1]])).toEqual([0, 1, 0]);
  });
});

describe('entryToProgramWod', () => {
  const ctx = { boxId: 'b', userId: 'u', sourcePdfUrl: 'b/x.pdf', sortOrder: 2 };
  it('pose scheduled_date = NULL et la case relative', () => {
    const row = entryToProgramWod({ ...base, date: dateFictive(3, 4) }, ctx);
    expect(row.scheduled_date).toBeNull();
    expect(row.program_week).toBe(3);
    expect(row.program_day).toBe(4);
  });
  it('conserve source_pdf_url / source_page / source_profile', () => {
    const row = entryToProgramWod(base, ctx);
    expect(row).toMatchObject({ source_pdf_url: 'b/x.pdf', source_page: 3, source_profile: 'kplus-perf', sort_order: 2 });
  });
  it('même sérialisation description/notes que le Whiteboard (entryToBoxWod)', () => {
    const prog = entryToProgramWod(base, ctx);
    const wb = entryToBoxWod(base, ctx);
    const { scheduled_date: _d, program_week: _w, program_day: _j, ...resteProg } = prog;
    const { scheduled_date: _dw, ...resteWb } = wb;
    expect(resteProg).toEqual(resteWb);
    expect(prog.description).toBe('21 Thruster (43/30 kg)');
  });
  it("n'emporte ni groupe ni programme du document : le destinataire est imposé par la page", () => {
    const row = entryToProgramWod(base, ctx) as unknown as Record<string, unknown>;
    expect(row).not.toHaveProperty('groups');
    expect(row).not.toHaveProperty('programs');
    expect(row).not.toHaveProperty('group_id');
    expect(row).not.toHaveProperty('program_id');
  });
});

describe('cœur PDF inchangé, relu en relatif', () => {
  const pages = [
    { index: 1, text: 'K+ PERF\nPROGRAMMATION S37' },
    { index: 2, text: 'LUNDI | S37\n🎯 METCON\nFOR TIME (TC 12\')\n- 21 Thruster 35/50kg\n2' },
    { index: 3, text: 'MERCREDI | S37\n🎯 METCON\nAMRAP 10\'\n- 10 Burpee\n3' },
  ];
  it('Lundi → J1, Mercredi → J3 de la semaine cible, sans date calendrier', () => {
    const res = parseDocument(pages, kplusPerf, ANCRE_IMPORT_PROGRAMME, {});
    const entries = recalerSurSemaine(res.entries, 5);
    const cases = entries.map(e => caseDepuisDate(e.date));
    expect(cases.every(c => c.week === 5)).toBe(true);
    expect(new Set(cases.map(c => c.day))).toEqual(new Set([1, 3]));
    const rows = entries.map((e, i) => entryToProgramWod(e, { boxId: 'b', userId: 'u', sourcePdfUrl: null, sortOrder: i }));
    expect(rows.every(r => r.scheduled_date === null)).toBe(true);
  });
});

describe('modale partagée : destination programme verrouillée', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'components/wods/PdfImportModal.tsx'), 'utf8');
  it('expose une cible discriminée whiteboard | program', () => {
    expect(src).toMatch(/kind: 'whiteboard'/);
    expect(src).toMatch(/kind: 'program'/);
  });
  it('en mode programme : chip verrouillée, aucun sélecteur de groupe ni de programme, rattachement via rattacherAuProgramme', () => {
    expect(src).toMatch(/data-testid="destinataire-verrouille"/);
    expect(src).toMatch(/const groups = target\.kind === 'whiteboard' \? target\.groups : \[\]/);
    expect(src).toMatch(/const programs = target\.kind === 'whiteboard' \? target\.programs : \[\]/);
    expect(src).toMatch(/rattacherAuProgramme\(ids, t\.program\.id\)/);
    expect(src).toMatch(/data-testid="semaine-cible"/);
  });
  it("le Whiteboard n'appelle jamais le chemin programme, et réciproquement", () => {
    expect(src).toMatch(/if \(target\.kind === 'program'\) \{ await insertProgramme\(target\); return; \}/);
    expect(src).not.toMatch(/assignRestrictions\([^)]*t\.program/);
  });
  it('la page Séances passe le programme courant et la semaine affichée', () => {
    const page = fs.readFileSync(path.join(process.cwd(), 'components/programs/ProgramSessionsEditor.tsx'), 'utf8');
    expect(page).toMatch(/kind: 'program'/);
    expect(page).toMatch(/program: \{ id: program\.id, title: program\.title, type: program\.type \}/);
    expect(page).toMatch(/defaultWeek: week/);
    expect(page).not.toMatch(/defaultWeekStart/);
  });
});
