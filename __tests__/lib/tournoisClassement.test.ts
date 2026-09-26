// Tournois, lot Manager PR 6 : classement calculé par la base
// (`tournament_classique_standings`, `tournament_classique_wod_ranks`,
// `tournament_ligue_standings`). Le Manager n'a plus de barème : il lit le
// rang et les points de la base et les met en forme.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { SCALE_NOTE, generalFromBase, requestedSeason, seasonOptions, wodRankingsFromBase } from '@/lib/tournaments/standings';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
const PROFILES = Object.fromEntries(['A', 'B', 'C', 'D', 'E', 'F'].map(n => [n, { username: `Athlète ${n}`, level: 'rx', elo: 1500 }]));

// Cas de référence du document (un For Time) : A et B en 8:00, C en 9:30,
// D au CAP à 150 reps, E au CAP à 140 reps, F sans score — tel que la base le rend.
const REFERENCE = [
  { athlete_id: 'F', points: 0, final_rank: 6 },
  { athlete_id: 'C', points: 95, final_rank: 3 },
  { athlete_id: 'B', points: 100, final_rank: 1 },
  { athlete_id: 'E', points: 91, final_rank: 5 },
  { athlete_id: 'A', points: 100, final_rank: 1 },
  { athlete_id: 'D', points: 93, final_rank: 4 },
];

describe('général : rang et points de la base', () => {
  it('cas de référence : A 100, B 100, C 95, D 93, E 91, F 0', () => {
    const rows = generalFromBase(REFERENCE, PROFILES, {});
    expect(rows.map(r => [r.athlete_id, r.total_score])).toEqual([['A', 100], ['B', 100], ['C', 95], ['D', 93], ['E', 91], ['F', 0]]);
  });

  it('rang partagé, puis rang suivant sauté (1, 1, 3…)', () => {
    expect(generalFromBase(REFERENCE, PROFILES, {}).map(r => r.rank)).toEqual([1, 1, 3, 4, 5, 6]);
  });

  it('nom, niveau, ELO et écart d’ELO de l’athlète', () => {
    const [a] = generalFromBase(REFERENCE, PROFILES, { A: 12 });
    expect(a).toEqual({ rank: 1, athlete_id: 'A', total_score: 100, username: 'Athlète A', level: 'rx', elo: 1500, elo_change: 12 });
  });
});

describe('par WOD : rang et points de la base, score mis en forme', () => {
  const wods = [{ id: 'w1', title: 'Fran', order_index: 1, type: 'For Time' }];
  const ranks = [
    { athlete_id: 'C', tournament_wod_id: 'w1', wod_rank: 3, points: 95 },
    { athlete_id: 'A', tournament_wod_id: 'w1', wod_rank: 1, points: 100 },
    { athlete_id: 'B', tournament_wod_id: 'w1', wod_rank: 1, points: 100 },
  ];
  const scores = [
    { athlete_id: 'A', tournament_wod_id: 'w1', score_value: '480', capped: false },
    { athlete_id: 'B', tournament_wod_id: 'w1', score_value: '480', capped: false },
    { athlete_id: 'C', tournament_wod_id: 'w1', score_value: '570', capped: false },
  ];

  it('rangs de la base, ex-aequo signalés, rang suivant sauté', () => {
    const [w] = wodRankingsFromBase(wods, ranks, scores, PROFILES);
    expect(w.scores.map(s => [s.athlete_id, s.rank, s.points, s.is_ex_aequo, s.score_display])).toEqual([
      ['A', 1, 100, true, '08:00'], ['B', 1, 100, true, '08:00'], ['C', 3, 95, false, '09:30'],
    ]);
  });
});

describe('ligue : saison en cours ou passée', () => {
  it('« Saison en cours », puis les saisons terminées, la plus récente d’abord', () => {
    expect(seasonOptions(3)).toEqual([{ season: null, label: 'Saison en cours' }, { season: 2, label: 'Saison 2' }, { season: 1, label: 'Saison 1' }]);
    expect(seasonOptions(1)).toEqual([{ season: null, label: 'Saison en cours' }]);
  });

  it('seule une saison terminée se choisit ; sinon la saison en cours', () => {
    expect(requestedSeason('1', 3)).toBe(1);
    expect(requestedSeason('3', 3)).toBeNull();
    expect(requestedSeason('0', 3)).toBeNull();
    expect(requestedSeason('abc', 3)).toBeNull();
    expect(requestedSeason(undefined, 3)).toBeNull();
  });
});

describe('branchements de l’écran Classement', () => {
  const page = read('app/(dashboard)/tournaments/[id]/leaderboard/page.tsx');

  it('lit les trois fonctions de la base, avec les bons arguments', () => {
    expect(page).toContain("svc.rpc('tournament_ligue_standings', { p_tournament_id: tournamentId, p_season: season })");
    expect(page).toContain("svc.rpc('tournament_classique_standings', { p_tournament_id: tournamentId })");
    expect(page).toContain("svc.rpc('tournament_classique_wod_ranks', { p_tournament_id: tournamentId })");
    expect(page).toContain('const season = isLeague ? requestedSeason(saison, currentSeason) : null;');
    expect(page).toContain(': generalFromBase((standingsRaw ?? []) as StandingRow[], profileMap, eloChangeById);');
  });

  it('texte validé du barème, choix de saison, relu à chaque visite', () => {
    expect(SCALE_NOTE).toBe('Barème : 100, 97, 95, 93… Ex-aequo : même rang, mêmes points, le rang suivant est sauté.');
    expect(page).toContain('>Rang · Points · {SCALE_NOTE}</p>');
    expect(page).toMatch(/\{isLeague && currentSeason > 1 && \([\s\S]*?seasonOptions\(currentSeason\)\.map/);
    expect(page).toContain("export const dynamic = 'force-dynamic';");
  });
});

describe('rechargement après un rejet de score', () => {
  const sc = read('app/(dashboard)/tournaments/[id]/scores/ScoresClient.tsx');

  it('validé comme rejeté : le classement de la base est relu', () => {
    const fn = sc.slice(sc.indexOf('async function updateStatus('), sc.indexOf('async function saveScoreValue('));
    expect(fn).toMatch(/setProcessing\(null\);\s*\/\/ Validé comme rejeté : le classement de la base change\.\s*reloadStandings\(\);/);
    expect(fn).not.toMatch(/if \(newStatus === 'validated'\)[^\n]*reloadStandings/);
    expect(sc).toMatch(/function reloadStandings\(\) \{\s*router\.refresh\(\);\s*\}/);
  });

  it('après une correction de score aussi', () => {
    const fn = sc.slice(sc.indexOf('async function saveScoreValue('), sc.indexOf('async function saveAdminMessage('));
    expect(fn).toContain('reloadStandings();');
  });
});

describe('plus aucun barème ni aucune écriture de score dans le Manager', () => {
  const walk = (d: string): string[] => readdirSync(d).flatMap(n => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
  const files = ['app', 'components', 'lib'].flatMap(r => walk(join(process.cwd(), r)));

  it('ni barème (100 − 3 par rang), ni fonction de classement du Manager', () => {
    const hits = files.filter(f => /rankClassique|rankWodScores|compareWodScores|recalcLeaderboard|100 - i \* 3|Math\.max\(1, 100/.test(readFileSync(f, 'utf8')));
    expect(hits.map(f => f.replace(process.cwd(), ''))).toEqual([]);
  });

  it('aucune écriture de tournament_participants.score', () => {
    const hits = files.filter(f => /from\(\s*'tournament_participants'\s*\)[\s\S]{0,60}\.(update|upsert|insert)\([^)]*\bscore\b/.test(readFileSync(f, 'utf8')));
    expect(hits.map(f => f.replace(process.cwd(), ''))).toEqual([]);
  });
});
