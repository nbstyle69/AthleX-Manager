import { readFileSync } from 'fs';
import { join } from 'path';

// Section C du relevé (fix/confirm-dialogs) : tournois. Le bouton de l'écran
// ouvre la boîte de confirmation ; l'action n'est lancée que par son bouton
// d'action (`run`, ou `secondary.run` pour « Garder la date »).
const lire = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const KICK = 'app/(dashboard)/tournaments/[id]/participants/KickButton.tsx';
const START = 'components/tournaments/StartTournamentButton.tsx';
const FINISH = 'components/tournaments/FinishTournamentButton.tsx';
const BRACKET = 'components/tournaments/BracketManager.tsx';
const DIVS = 'components/tournaments/DivisionsManager.tsx';
const WODS = 'components/tournaments/TournamentWODManager.tsx';

interface Site { id: string; file: string; opens: string; direct: string; run: RegExp }

const SITES: Site[] = [
  { id: 'C1 exclure', file: KICK, opens: 'onClick={askKick}', direct: 'onClick={handleKick}', run: /function askKick[\s\S]{0,900}run: handleKick,/ },
  // PR 2 tournois : la base décide (decide_bracket_round) ; la boîte reste le seul départ de l'action.
  { id: 'C2 décider les matchs', file: BRACKET, opens: 'onClick={() => autoResolveRound(lastR)}', direct: 'decideRound(lastR)', run: /function autoResolveRound\(round: number\) \{\s*const wod = wodForColumn\(round\);\s*ask\(\{[\s\S]{0,900}run: \(\) => decideRound\(round, wod\?\.id \?\? null\),\s*\}\);\s*\}/ },
  { id: 'C3 premier tour', file: BRACKET, opens: 'onClick={askGenerateRound1}', direct: 'onClick={generateRound1}', run: /function askGenerateRound1[\s\S]{0,700}run: generateRound1,/ },
  { id: 'C4 effacer un résultat', file: BRACKET, opens: 'onReset={askResetMatch}', direct: 'onReset={resetMatch}', run: /function askResetMatch[\s\S]{0,900}run: \(\) => resetMatch\(match\),/ },
  { id: 'C5 refaire le tableau', file: BRACKET, opens: 'onClick={askRegenerateBracket}', direct: 'onClick={regenerateBracket}', run: /function askRegenerateBracket[\s\S]{0,900}run: regenerateBracket,/ },
  { id: 'C6 retirer de la division', file: DIVS, opens: 'onClick={() => askRemoveMember(row.id, p, d.name, row.points, rIdx + 1)}', direct: 'onClick={() => removeMember(', run: /function askRemoveMember[\s\S]{0,900}run: \(\) => removeMember\(memberRowId, athlete\),/ },
  { id: 'C7 clôturer la saison', file: DIVS, opens: 'onClick={askEndSeason}', direct: 'onClick={endSeasonAndAdvance}', run: /function askEndSeason[\s\S]{0,900}run: endSeasonAndAdvance,/ },
  { id: 'C8 créer une division', file: DIVS, opens: 'onClick={askAddDivision}', direct: 'onClick={addDivision}', run: /function askAddDivision[\s\S]{0,900}field: \{ label: 'Nom de la division', defaultValue: `D\$\{nextLevel\}` \},[\s\S]{0,120}run: name => addDivision\(nextLevel, name\),/ },
  { id: 'C9 changer de division', file: DIVS, opens: 'ask({\n                                    title: `Changer', direct: '    moveMember(row.id, next);', run: /ask\(\{\s*title: `Changer[\s\S]{0,700}run: \(\) => moveMember\(row\.id, next\),\s*\}\);/ },
  { id: 'C10 terminer', file: FINISH, opens: 'onClick={askFinish}', direct: 'onClick={finish}', run: /function askFinish[\s\S]{0,900}run: finish,/ },
  { id: 'C11 démarrer', file: START, opens: 'onClick={askStart}', direct: 'onClick={start}', run: /function askStart[\s\S]{0,900}run: start,/ },
  { id: 'C12 supprimer un WOD', file: WODS, opens: 'onClick={() => askDeleteWOD(wod)}', direct: 'onClick={() => deleteWOD(', run: /function askDeleteWOD[\s\S]{0,1200}run: \(\) => deleteWOD\(wod\.id\),/ },
];

describe('Section C : le bouton ouvre la boîte, l’action part de son bouton d’action', () => {
  it.each(SITES.map(s => [s.id, s] as const))('%s', (_id, s) => {
    const src = lire(s.file).replace(/\r\n/g, '\n');
    expect(src).toContain(s.opens);
    expect(src).not.toContain(s.direct);
    expect(src).toMatch(s.run);
  });

  it('C13 ouvrir un WOD programmé : trois choix, « Annuler » ne change rien', () => {
    const src = lire(WODS).replace(/\r\n/g, '\n');
    const toggle = src.slice(src.indexOf('async function toggleStatus'), src.indexOf('async function applyStatus'));
    // Le WOD programmé ouvre la boîte puis s'arrête : aucune écriture avant un choix.
    expect(toggle).toMatch(/if \(next === 'active' && isScheduledAhead\(wod\.opens_at\)\) \{\s*ask\(\{[\s\S]*?\}\);\s*return;\s*\}/);
    expect(toggle).toMatch(/secondary: \{ label: 'Garder la date', run: \(\) => applyStatus\(wod, \{ status: next \}\) \}/);
    expect(toggle).toMatch(/confirmLabel: 'Ouvrir maintenant',[\s\S]{0,300}run: \(\) => applyStatus\(wod, \{ status: next, opens_at: null \}\)/);
    expect(toggle).not.toMatch(/from\('tournament_wods'\)/);
    expect(src).toMatch(/async function applyStatus[\s\S]{0,300}from\('tournament_wods'\)\.update\(patch\)/);
  });

  it('C11 : le texte dit que les inscriptions seront fermées (case décochée)', () => {
    // Les textes vivent dans lib/tournaments/registrations.ts depuis la case
    // « Inscriptions ouvertes pendant le tournoi » ; le bouton les demande.
    expect(lire(START)).toMatch(/\.\.\.startDialogTexts\(registrationsOpen\),/);
    const { startDialogTexts } = require('@/lib/tournaments/registrations');
    expect(startDialogTexts(false).body).toMatch(/Les inscriptions seront fermées/);
    expect(startDialogTexts(false).body).not.toMatch(/Les inscriptions restent visibles/);
  });

  it('C12 : une erreur de suppression s’affiche au lieu de passer sans message', () => {
    expect(lire(WODS)).toMatch(/const \{ error \} = await supabase\.from\('tournament_wods'\)\.delete\(\)\.eq\('id', id\);\s*if \(error\) inform\(\{ kind: 'error', title: ERROR_TITLE, body: error\.message \}\);/);
  });

  it('aucune boîte native ne reste dans les fichiers de la section C', () => {
    for (const file of [KICK, START, FINISH, BRACKET, DIVS, WODS]) {
      expect(lire(file)).not.toMatch(/(^|[^\w.])(window\.)?(confirm|prompt)\(/m);
    }
  });

  it('chaque composant affiche la boîte', () => {
    for (const file of [KICK, START, FINISH, BRACKET, DIVS, WODS]) {
      expect(lire(file)).toMatch(/\{dialog\}/);
    }
  });
});
