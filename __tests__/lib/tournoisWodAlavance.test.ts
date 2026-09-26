// Tournois : WOD préparés à l'avance (athlex-app #386). La base rend les étapes
// à proposer (`tournament_bracket_stages`) et pose le WOD prévu sur chaque match
// à sa création ; le Manager enregistre l'étape (tableau + numéro), lit le WOD
// du match d'abord, et ne garde l'ancien calcul par étape que pour les anciens
// matchs sans WOD.
import { readFileSync } from 'fs';
import { join } from 'path';
import { DUPLICATE_STAGE, STAGES_UNAVAILABLE, parseStageKey, stageKey, stageOptions, wodSaveError, wodStageLabel } from '@/lib/tournaments/wodStages';
import { GENERIC_REFUSAL } from '@/lib/tournaments/refusals';
import { columnWod, loserColumnWodId, matchWodId, stageWod } from '@/lib/tournaments/bracketRounds';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
const FORM = read('components/tournaments/WODForm.tsx');
const PAGE = read('app/(dashboard)/tournaments/[id]/wods/page.tsx');
const MANAGER = read('components/tournaments/TournamentWODManager.tsx');
const BM = read('components/tournaments/BracketManager.tsx');

// Ce que rend la base pour une double élimination à 8 (dans le désordre, pour
// prouver que l'ordre vient de `ordre`) et une élimination simple à 4 avec petite finale.
const DOUBLE_8 = [
  { ordre: 8, bracket_board: 'grand_final_reset', bracket_stage: null, label_fr: 'Grande finale — match décisif' },
  { ordre: 1, bracket_board: 'winner', bracket_stage: 2, label_fr: 'Quart de finale des gagnants' },
  { ordre: 4, bracket_board: 'loser', bracket_stage: 1, label_fr: 'Tour 1 des perdants' },
  { ordre: 2, bracket_board: 'winner', bracket_stage: 1, label_fr: 'Demi-finale des gagnants' },
  { ordre: 3, bracket_board: 'winner', bracket_stage: 0, label_fr: 'Finale des gagnants' },
  { ordre: 5, bracket_board: 'loser', bracket_stage: 2, label_fr: 'Tour 2 des perdants' },
  { ordre: 6, bracket_board: 'loser', bracket_stage: 3, label_fr: 'Tour 3 des perdants' },
  { ordre: 7, bracket_board: 'grand_final', bracket_stage: null, label_fr: 'Grande finale' },
];
const SIMPLE_4_PETITE_FINALE = [
  { ordre: 3, bracket_board: 'third_place', bracket_stage: null, label_fr: 'Petite finale' },
  { ordre: 1, bracket_board: 'winner', bracket_stage: 1, label_fr: 'Demi-finale' },
  { ordre: 2, bracket_board: 'winner', bracket_stage: 0, label_fr: 'Finale' },
];

describe('étapes proposées : celles de la base, dans son ordre, avec ses libellés', () => {
  it('double élimination à 8 : gagnants, perdants, grande finale, match décisif', () => {
    expect(stageOptions(DOUBLE_8)).toEqual([
      { value: 'winner:2', label: 'Quart de finale des gagnants' },
      { value: 'winner:1', label: 'Demi-finale des gagnants' },
      { value: 'winner:0', label: 'Finale des gagnants' },
      { value: 'loser:1', label: 'Tour 1 des perdants' },
      { value: 'loser:2', label: 'Tour 2 des perdants' },
      { value: 'loser:3', label: 'Tour 3 des perdants' },
      { value: 'grand_final:', label: 'Grande finale' },
      { value: 'grand_final_reset:', label: 'Grande finale — match décisif' },
    ]);
  });

  it('élimination simple : la petite finale seulement si la base la rend', () => {
    expect(stageOptions(SIMPLE_4_PETITE_FINALE).map(o => o.label)).toEqual(['Demi-finale', 'Finale', 'Petite finale']);
    expect(stageOptions(SIMPLE_4_PETITE_FINALE.slice(1)).map(o => o.label)).toEqual(['Demi-finale', 'Finale']);
  });

  it('la page lit la base, sans libellé ni calcul d’étape en dur', () => {
    expect(PAGE).toContain("isBracket ? supabase.rpc('tournament_bracket_stages', { p_tournament_id: id }) : Promise.resolve({ data: [], error: null })");
    expect(PAGE).toContain('const bracketStages = stageOptions((stages.data ?? []) as StageRow[]);');
    for (const src of [PAGE, MANAGER, FORM]) expect(src).not.toMatch(/STAGE_LABELS|'Demi-finale'|Math\.log2|tours avant la finale/);
  });
});

describe('enregistrement : tableau et étape ensemble', () => {
  it('clé ⇄ colonnes', () => {
    expect(parseStageKey('winner:0')).toEqual({ bracket_board: 'winner', bracket_stage: 0 });
    expect(parseStageKey('loser:2')).toEqual({ bracket_board: 'loser', bracket_stage: 2 });
    expect(parseStageKey('grand_final_reset:')).toEqual({ bracket_board: 'grand_final_reset', bracket_stage: null });
    expect(parseStageKey('')).toEqual({ bracket_board: null, bracket_stage: null });
    expect(stageKey('loser', 2)).toBe('loser:2');
    expect(stageKey('third_place', null)).toBe('third_place:');
    expect(stageKey(null, null)).toBe('');
  });

  it('le formulaire écrit bracket_board avec bracket_stage, et relit les deux', () => {
    expect(FORM).toContain('bracket_stage:    stageKey(initial?.bracket_board, initial?.bracket_stage),');
    expect(FORM).toContain('...(!isBracket ? { bracket_board: null, bracket_stage: null } : stagesUnavailable ? {} : parseStageKey(form.bracket_stage)),');
    expect(FORM).not.toMatch(/bracket_stage:\s+isBracket \?/);
    expect(FORM).toMatch(/<option value="" className="text-black">🌐 Toutes les étapes \(non assigné\)<\/option>\s*\{bracketStages\.map\(s => \(\s*<option key=\{s\.value\} value=\{s\.value\}/);
  });

  it('liste des étapes illisible : pas de champ, un message, l’étape du WOD intacte', () => {
    expect(PAGE).toContain('const stagesUnavailable = isBracket && !!stages.error;');
    expect(STAGES_UNAVAILABLE).toBe('L’étape du tournoi ne peut pas être choisie pour l’instant. Le WOD s’enregistre sans changer son étape.');
    expect(FORM).toMatch(/\{isBracket && stagesUnavailable && \(\s*<p role="status" data-testid="etapes-indisponibles"[^>]*>\{STAGES_UNAVAILABLE\}<\/p>/);
    expect(MANAGER.match(/stagesUnavailable=\{stagesUnavailable\}/g)).toHaveLength(1);
  });
});

describe('refus à l’enregistrement', () => {
  it('doublon d’étape (23505) : texte validé, jamais l’erreur brute', () => {
    expect(wodSaveError({ code: '23505', message: 'duplicate key value violates unique constraint "tournament_wods_etape_unique"' })).toBe('Un WOD est déjà prévu pour cette étape.');
    expect(DUPLICATE_STAGE).toBe('Un WOD est déjà prévu pour cette étape.');
  });

  it('tout autre refus passe par tournamentRefusal', () => {
    expect(wodSaveError({ code: '23514', message: 'new row violates check constraint "tournament_wods_bracket_board_check"' })).toBe(GENERIC_REFUSAL);
    expect(wodSaveError({ code: '42501', message: 'permission denied' })).toBe('Tu n’as pas les droits pour gérer ce tournoi.');
    expect(FORM).toContain('if (err) { setError(wodSaveError(err)); return; }');
  });
});

describe('libellés d’étape des WOD : ceux de la base', () => {
  const labels = Object.fromEntries(stageOptions(DOUBLE_8).map(o => [o.value, o.label]));
  it('par tableau et étape, finale comprise', () => {
    expect(wodStageLabel({ bracket_board: 'loser', bracket_stage: 2 }, labels)).toBe('Tour 2 des perdants');
    expect(wodStageLabel({ bracket_board: 'winner', bracket_stage: 0 }, labels)).toBe('Finale des gagnants');
    expect(wodStageLabel({ bracket_board: 'grand_final_reset', bracket_stage: null }, labels)).toBe('Grande finale — match décisif');
    expect(wodStageLabel({ bracket_board: null, bracket_stage: null }, labels)).toBeNull();
    expect(wodStageLabel({ bracket_board: 'loser', bracket_stage: 9 }, labels)).toBe('Étape prévue');
  });
  it('la liste et la suppression les utilisent', () => {
    expect(MANAGER).toContain('{wodStageLabel(wod, stageMap)}');
    expect(MANAGER).toContain(': wodStageLabel(wod, stageMap);');
  });
});

describe('bracket : le WOD posé sur le match d’abord', () => {
  const WODS = [
    { id: 'w-final', bracket_board: 'winner', bracket_stage: 0 },
    { id: 'w-l1', bracket_board: 'loser', bracket_stage: 1 },
    { id: 'w-semi', bracket_board: 'winner', bracket_stage: 1 },
    { id: 'w-pose', bracket_board: 'winner', bracket_stage: 2 },
  ];
  const m = (wod_id: string | null, winner_id: string | null = null, status = 'pending') => ({ wod_id, winner_id, status });

  it('match.wod_id lu en premier', () => {
    expect(matchWodId({ wod_id: 'w-pose', side: 'winner', round: 2 }, 'swiss', () => 'w-final')).toBe('w-pose');
    expect(columnWod([m('w-pose'), m('w-pose')], WODS, WODS[0])?.id).toBe('w-pose');
    expect(BM).toContain('return columnWod(grouped.winnerByRound[r] ?? [], wods, wodForRound(r));');
    expect(BM).toContain('wodForRound={wodForColumn}');
    expect(BM).toMatch(/function autoResolveRound\(round: number\) \{\s*const wod = wodForColumn\(round\);/);
  });

  it('ancien calcul seulement pour les anciens matchs sans WOD, et jamais sur un WOD des perdants', () => {
    expect(columnWod([m(null), m(null)], WODS, WODS[2])?.id).toBe('w-semi');
    expect(matchWodId({ wod_id: null, side: 'winner', round: 1 }, 'bracket', () => 'w-semi')).toBe('w-semi');
    // 2 tours : tour 1 = demi (distance 1) ; le WOD des perdants au numéro 1 ne compte pas.
    expect(stageWod(WODS, 2, 1)?.id).toBe('w-semi');
    expect(stageWod(WODS.filter(w => w.id !== 'w-semi'), 2, 1)).toBeUndefined();
    expect(BM).toContain('return stageWod(wods, totalRounds, r);');
  });

  it('liste de secours de #401 préremplie avec le WOD posé par la base', () => {
    expect(loserColumnWodId([m('w-l1'), m('w-l1'), m(null, null, 'bye')])).toBe('w-l1');
    expect(BM).toContain("value: loserColumnWodId(grouped.loserByRound[r]) ?? '',");
    expect(read('app/(dashboard)/tournaments/[id]/bracket/page.tsx')).toContain('bracket_board: w.bracket_board ?? null, bracket_stage: w.bracket_stage ?? null,');
  });
});
