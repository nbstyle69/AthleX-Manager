import { detectFormat, timecapOf } from '@/lib/pdfImport/formats';
import { parseMovementLine, resolveMovementName } from '@/lib/pdfImport/movements';
import { parseStrengthLine } from '@/lib/pdfImport/strength';
import { entryToBoxWod, serializeImportMovement, serializeImportStrength, validateEntry } from '@/lib/pdfImport/serialize';
import { parseDocument } from '@/lib/pdfImport/core';
import { detectProfile } from '@/lib/pdfImport/profiles';
import { kplusPerf } from '@/lib/pdfImport/profiles/kplus-perf';
import type { ImportEntry } from '@/lib/pdfImport/types';

const FH = { chargeOrder: 'FH' as const, synonyms: kplusPerf.synonyms, typoFixes: kplusPerf.typoFixes };

describe('detectFormat (§4)', () => {
  it('E2MOM X5 → emom 2 min × 5, cap 10:00', () => {
    const d = detectFormat('E2MOM X5\n- 3 Power Clean');
    expect(d).toMatchObject({ type: 'emom', emomIntervalMin: 2, rounds: 5, timecapSec: 600, scored: false });
    expect(timecapOf(d)).toBe('10:00');
  });
  it("Every 1'30 X4 → custom (intervalle non entier), cap 06:00, note", () => {
    const d = detectFormat("Every 1'30 X4\n- 5 Thruster");
    expect(d.type).toBe('custom');
    expect(d.timecapSec).toBe(360);
    expect(d.emomIntervalMin).toBeNull();
    expect(d.intervalNote).toMatch(/1'30/);
    expect(d.warnings).toContain('enum-fallback');
  });
  it("AMRAP 15 à 20' → amrap, cap 20:00", () => {
    const d = detectFormat("AMRAP 15 à 20'\n- 10 Burpees");
    expect(d).toMatchObject({ type: 'amrap', timecapSec: 1200, scored: true });
  });
  it('30" ON / 15" OFF X 8 → tabata-like structure', () => {
    const d = detectFormat('30" ON / 15" OFF X 8\n- Row');
    expect(d.tabataWorkSec).toBe(30);
    expect(d.tabataRestSec).toBe(15);
    expect(d.rounds).toBe(8);
    expect(d.timecapSec).toBe(360);
  });
  it('Tabata → 8 × 20/10, cap 04:00', () => {
    const d = detectFormat('TABATA\n- Air Squat');
    expect(d).toMatchObject({ type: 'tabata', tabataWorkSec: 20, tabataRestSec: 10, rounds: 8, timecapSec: 240 });
  });
  it("For Time avec TC 12' → for-time, rank", () => {
    const d = detectFormat("FOR TIME (TC 12')\n21-15-9");
    expect(d).toMatchObject({ type: 'for-time', timecapSec: 720, scored: true });
  });
  it('4 Rounds for time', () => {
    const d = detectFormat('4 ROUNDS FOR TIME\n- 400m Run');
    expect(d).toMatchObject({ type: 'for-time', rounds: 4 });
  });
  it("Repos 2' extraits", () => {
    const d = detectFormat("5 rounds\n- 10 Squat\n2' de rest entre les rounds");
    expect(d.rests.length).toBeGreaterThan(0);
  });
});

describe('resolveMovementName (§7)', () => {
  it.each([
    ['T2B', 'Toes-to-Bar'],
    ['RMU', 'Ring Muscle-ups'],
    ['HSW', 'Handstand Walk'],
    ['thrusters', 'Thruster'],
    ['Ski', 'SkiErg'],
    ['Power Cleans', 'Power Clean'],
  ])('%s → %s (resolved)', (raw, expected) => {
    expect(resolveMovementName(raw, kplusPerf.synonyms)).toEqual({ name: expected, resolved: true });
  });
  it('mouvement inconnu → conservé, resolved=false', () => {
    const r = resolveMovementName('Copenhagen Plank Hold', kplusPerf.synonyms);
    expect(r.resolved).toBe(false);
    expect(r.name).toBe('Copenhagen Plank Hold');
  });
});

describe('parseMovementLine (§7)', () => {
  const parse = (l: string) => parseMovementLine(l, FH)!;

  it('6X1 Squat Snatch @85-90% → sets×reps + charge %', () => {
    const m = parse('- 6X1 Squat Snatch @85-90%').movement;
    expect(m.name).toBe('Squat Snatch');
    expect(m.reps).toBe('6×1');
    expect(m.charge_h).toBe('85-90%');
    expect(m.resolved).toBe(true);
  });
  it('3 à 4 X3 Clean Pull @110%', () => {
    const m = parse('- 3 à 4 X3 Clean Pull @110%').movement;
    expect(m.reps).toBe('4×3');
    expect(m.note).toMatch(/3 à 4/);
    expect(m.charge_h).toBe('110%');
  });
  it('5 Zercher Squat RPE9 (focus mouvement)', () => {
    const m = parse('- 5 Zercher Squat RPE9 (focus mouvement)').movement;
    expect(m.reps).toBe('5');
    expect(m.charge_h).toBe('RPE 9');
    expect(m.note).toBe('focus mouvement');
  });
  it('8/bras Tirage bucherons RPE9', () => {
    const m = parse('- 8/bras Tirage bucherons RPE9').movement;
    expect(m.reps).toBe('8/bras');
    expect(m.name).toBe('Tirage bûcherons');
  });
  it("20-30''/côté Copenhagen Plank Hold (genoux possible)", () => {
    const m = parse("- 20-30''/côté Copenhagen Plank Hold (genoux possible)").movement;
    expect(m.reps).toBe('20-30"/côté');
    expect(m.name).toBe('Copenhagen Plank Hold');
    expect(m.resolved).toBe(false);
    expect(m.note).toBe('genoux possible');
  });
  it('25% T2B (Série Max UBK T2B) (CAP à 12)', () => {
    const m = parse('- 25% T2B (Série Max UBK T2B) (CAP à 12)').movement;
    expect(m.name).toBe('Toes-to-Bar');
    expect(m.reps).toBe('25% du max UBK');
    expect(m.note).toBe('CAP à 12');
  });
  it('X RMU → selon niveau', () => {
    const m = parse('- X RMU').movement;
    expect(m.reps).toBe('selon niveau');
    expect(m.name).toBe('Ring Muscle-ups');
  });
  it('12m HSW (6m UBK maximum)', () => {
    const m = parse('- 12m HSW (6m UBK maximum)').movement;
    expect(m.reps).toBe('12m');
    expect(m.name).toBe('Handstand Walk');
    expect(m.note).toMatch(/6m UBK/);
  });
  it('500m Ski (RPE4/6)', () => {
    const m = parse('- 500m Ski (RPE4/6)').movement;
    expect(m.reps).toBe('500m');
    expect(m.name).toBe('SkiErg');
    expect(m.charge_h).toBe('RPE 4/6');
  });
  it('40 Cal Row sur deux Row en relais libre → suite en note', () => {
    const m = parse('- 40 Cal Row sur deux Row en relais libre').movement;
    expect(m.reps).toBe('40 Cal');
    expect(m.name).toBe('Row');
    expect(m.note).toMatch(/relais/);
  });
  it('charges 35/50kg en FH → F=35, H=50', () => {
    const m = parse('- 21 Thruster 35/50kg').movement;
    expect(m.charge_f).toBe('35kg');
    expect(m.charge_h).toBe('50kg');
  });
  it('ordre unknown : la plus lourde à H, ambigu', () => {
    const r = parseMovementLine('- 21 Thruster 50/35kg', { ...FH, chargeOrder: 'unknown' })!;
    expect(r.movement.charge_h).toBe('50kg');
    expect(r.chargeAmbiguous).toBe(true);
  });
  it('♀ 2 RMU / ♂ 3 RMU → reps par sexe', () => {
    const m = parse('- ♀ 2 RMU / ♂ 3 RMU').movement;
    expect(m.reps_f).toBe('2');
    expect(m.reps_h).toBe('3');
    expect(m.name).toBe('Ring Muscle-ups');
  });
});

describe('parseStrengthLine (§5)', () => {
  const opts = { synonyms: kplusPerf.synonyms, typoFixes: kplusPerf.typoFixes };
  it('5X3 Back Squat @88% → structuré', () => {
    const s = parseStrengthLine('- 5X3 Back Squat @88%', opts)!;
    expect(s).toMatchObject({ exercise: 'Back Squat', sets: 5, reps: 3, percent: 88, rpe: null, resolved: true });
  });
  it('4X2 Front Squat @85-90% → percent null, fourchette en note', () => {
    const s = parseStrengthLine('- 4X2 Front Squat @85-90%', opts)!;
    expect(s.percent).toBeNull();
    expect(s.charge_note).toBe('85-90%');
  });
  it('3X5 Bench RPE8 → rpe', () => {
    const s = parseStrengthLine('- 3X5 Bench Press RPE8', opts)!;
    expect(s.rpe).toBe('8');
    expect(s.percent).toBeNull();
  });
  it('1RM Back Squat du jour', () => {
    const s = parseStrengthLine('- 1RM Back Squat du jour', opts)!;
    expect(s).toMatchObject({ sets: 1, reps: 1, exercise: 'Back Squat' });
    expect(s.charge_note).toMatch(/1RM du jour/);
  });
  it('4X3 @-12% de la charge utilisée → exercice vide, note relative', () => {
    const s = parseStrengthLine('- 4X3 @-12% de la charge utilisée', opts)!;
    expect(s.exercise).toBe('');
    expect(s.charge_note).toMatch(/-12 %/);
  });
  it('tempo et repos', () => {
    const s = parseStrengthLine("- 3X8 Back Squat @70% 3\" pause ras le sol 2' de rest", opts)!;
    expect(s.tempo).toMatch(/3" pause/);
    expect(s.rest).toBe("2'");
  });
});

describe('sérialisation (§5, décision C)', () => {
  it('mouvement reps-first, charges en parenthèse', () => {
    const line = serializeImportMovement({
      name: 'Thruster', resolved: true, reps: '21', charge_h: '43kg', charge_f: '30kg', note: null,
    });
    expect(line).toBe('21 Thruster (43/30 kg)');
    expect(line).not.toMatch('@');
  });
  it('force : 85-90% → borne haute structurée + fourchette en notes ; RPE → non structuré', () => {
    const out = serializeImportStrength([
      { exercise: 'Front Squat', resolved: true, sets: 4, reps: 2, percent: null, rpe: null, charge_note: '85-90%', tempo: null, rest: null },
      { exercise: 'Back Squat', resolved: true, sets: 5, reps: 3, percent: 88, rpe: null, charge_note: null, tempo: null, rest: "2'" },
      { exercise: 'Zercher Squat', resolved: false, sets: 3, reps: 5, percent: null, rpe: '9', charge_note: null, tempo: null, rest: null },
    ]);
    expect(out.lines[0]).toMatch(/^Front Squat — 4 × 2 @ 90 %1RM/);
    expect(out.lines[1]).toMatch(/^Back Squat — 5 × 3 @ 88 %1RM — repos 2:00/);
    expect(out.chargeNotes[0]).toMatch(/85-90 %/);
    expect(out.unstructured).toHaveLength(1);
    expect(out.unstructured[0]).toMatch(/Zercher Squat.*RPE 9/);
  });

  const base: ImportEntry = {
    key: 'k', date: '2026-09-07', order: 1, block: 'wod', type: 'for-time', title: 'METCON — Thruster (For Time)',
    movements: [{ name: 'Thruster', resolved: true, reps: '21', charge_h: '43kg', charge_f: '30kg', note: null }],
    musculation: [], timecap: '12:00', rounds: null, emom_interval_minutes: null,
    tabata_work_seconds: null, tabata_rest_seconds: null, notes_coach: 'Barème :\n🟣 Open : 30/20kg',
    video_url: null, groups: [], programs: [], published: true, rank: true,
    source_profile: 'kplus-perf', source_page: 3, warnings: [],
  };
  it('entryToBoxWod conserve la source et le rank', () => {
    const row = entryToBoxWod(base, { boxId: 'b', userId: 'u', sourcePdfUrl: 'b/x.pdf', sortOrder: 0 });
    expect(row).toMatchObject({
      description: '21 Thruster (43/30 kg)', time_cap_seconds: 720, leaderboard_enabled: true,
      source_pdf_url: 'b/x.pdf', source_page: 3, source_profile: 'kplus-perf', is_published: true, video_url: null,
    });
  });
  it('validateEntry refuse un titre vide ou un timecap mal formé', () => {
    expect(validateEntry(base)).toEqual([]);
    expect(validateEntry({ ...base, title: '' }).length).toBe(1);
    expect(validateEntry({ ...base, timecap: '12' }).length).toBe(1);
  });
});

const S37_LIKE = [
  { index: 1, text: 'K+ PERF\nPROGRAMMATION S37\nDELOAD\nSemaine de deload : on baisse les volumes.\n« La régularité bat le talent » — Coach' },
  { index: 2, text: 'LUNDI | S37\nDPRDELOEPOLFROAIOLPADFRCDIOLSFCILB&CC\n1) HALTERO\n- 6X1 Squat Snatch @85-90%\n- 3 à 4 X3 Clean Pull @110%\n🎯 METCON OU RUN\nFOR TIME (TC 12\')\n- 21 Thruster 35/50kg\n- X RMU\n🟣 Open : 30/40kg\n🔴 Pro : 35/50kg\n🥇 Elite : 40/60kg\n* Attention au rythme\n2' },
  { index: 3, text: 'MARDI | S37\n🎯 SQUAT X PAG\nWARM-UPS\n- 10 Air Squat\n- 10 Good Morning\n- 5X3 Back Squat @88%\n- 4X3 @-12% de la charge utilisée\n🎯 RENFO\nA) E2MOM X5\n- 8/bras Tirage bucherons RPE9\nB) 3 rounds\n- 3X10 Zercher Squat RPE9 (focus mouvement)\n- 20-30\'\'/côté Copenhagen Plank Hold (genoux possible)\n3' },
];

describe('profil kplus-perf + parseDocument', () => {
  it('détecte K+ Perf', () => {
    const { profile, scores } = detectProfile(S37_LIKE);
    expect(profile.slug).toBe('kplus-perf');
    expect(scores['kplus-perf']).toBeGreaterThanOrEqual(0.7);
  });
  it('découpe jours, sections implicites, alternatives et sous-blocs', () => {
    const r = parseDocument(S37_LIKE, kplusPerf, '2026-09-07');
    expect(r.week_notes).toMatch(/deload/i);
    expect(r.week_notes).not.toMatch(/DPRDELOE/);

    const titles = r.entries.map(e => e.title);
    const lundi = r.entries.filter(e => e.date === '2026-09-07');
    const mardi = r.entries.filter(e => e.date === '2026-09-08');
    expect(lundi.length).toBe(2);
    expect(mardi.length).toBeGreaterThanOrEqual(3);

    const haltero = lundi.find(e => e.block === 'skill-haltero')!;
    expect(haltero).toBeDefined();
    expect(haltero.type).toBe('strength');
    expect(haltero.musculation.map(m => `${m.exercise} ${m.sets}x${m.reps}`)).toEqual(['Squat Snatch 6x1', 'Clean Pull 4x3']);
    expect(haltero.notes_coach).not.toMatch(/1\) HALTERO/);

    // `METCON OU RUN` sans section RUN en face : une seule entrée, annotée, sans « Option ».
    const optA = lundi.find(e => /^METCON/.test(e.title))!;
    expect(optA.title).not.toMatch(/Option/);
    expect(lundi.some(e => /^RUN/.test(e.title))).toBe(false);
    expect(optA.block).toBe('wod');
    expect(optA.type).toBe('for-time');
    expect(optA.rank).toBe(true);
    expect(optA.timecap).toBe('12:00');
    expect(optA.notes_coach).toMatch(/Au choix avec RUN/);
    expect(optA.notes_coach).toMatch(/Barème :\n🟣 Open : 30\/40kg/);
    expect(optA.notes_coach).toMatch(/Attention au rythme/);
    expect(optA.movements).toHaveLength(2);
    expect(optA.movements[0]).toMatchObject({ name: 'Thruster', charge_f: '35kg', charge_h: '50kg' });
    expect(optA.warnings).not.toContain('level-scale-missing');

    const squat = mardi.find(e => /SQUAT X PAG/.test(e.title))!;
    expect(squat.block).toBe('skill-haltero');
    expect(squat.musculation.length).toBe(2);
    expect(squat.musculation[1].exercise).toBe('Back Squat');
    expect(squat.notes_coach).toMatch(/Échauffement : 10 Air Squat — 10 Good Morning/);
    expect(squat.movements).toHaveLength(0);
    expect(squat.warnings).toContain('strength-unstructured');

    const renfoA = mardi.find(e => /RENFO/.test(e.title) && e.type === 'emom')!;
    expect(renfoA).toBeDefined();
    expect(renfoA.rounds).toBe(5);
    expect(renfoA.emom_interval_minutes).toBe(2);
    expect(renfoA.rank).toBe(false);

    const renfoB = mardi.find(e => /RENFO/.test(e.title) && e !== renfoA)!;
    expect(renfoB.block).toBe('post-wod');
    expect(renfoB.warnings).toContain('movement-unresolved');
    expect(r.unresolved_movements).toContain('Copenhagen Plank Hold');

    for (const e of r.entries) {
      expect(e.source_profile).toBe('kplus-perf');
      expect(e.source_page).toBeGreaterThanOrEqual(2);
      expect(e.notes_coach).not.toMatch(/DPRDELOE|^DELOAD$/m);
      expect(validateEntry(e)).toEqual([]);
    }
    expect(titles.every(t => t.length > 0)).toBe(true);
  });
});
