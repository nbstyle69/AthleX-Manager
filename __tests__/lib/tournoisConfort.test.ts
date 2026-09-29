// Tournois, lot Manager priorité 5 : « Max participants » sans NaN, refus de
// clôture en français (TABLEAU_NON_TERMINE…), écart d'ELO par match.
import { readFileSync } from 'fs';
import { join } from 'path';
import { initialTournamentForm, maxParticipantsError, parseMaxParticipants } from '@/lib/tournamentForm';
import { tournamentRefusal } from '@/lib/tournaments/refusals';
import { eloDeltaDisplay, matchEloDelta, matchEloDeltas } from '@/lib/tournaments/matchElo';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');

describe('« Max participants » : jamais NaN, vide ou invalide refusé', () => {
  it.each([
    ['', null], ['  ', null], ['abc', null], ['12.5', null], ['-3', null], ['1e3', null],
    ['12', 12], [' 32 ', 32], ['2', 2],
  ])('lecture de « %s » → %p', (raw, expected) => {
    const v = parseMaxParticipants(raw as string);
    expect(v).toBe(expected);
    expect(Number.isNaN(v)).toBe(false);
  });

  it.each([null, 0, 1, 501, 12.5])('%p est refusé avec un message', v => {
    expect(maxParticipantsError(v as number | null)).toMatch(/entre 2 et 500/);
  });

  it.each([2, 16, 500])('%p est accepté', v => {
    expect(maxParticipantsError(v)).toBeNull();
  });

  it('valeur enregistrée reprise telle quelle, 32 par défaut à la création', () => {
    expect(initialTournamentForm({ max_participants: 12 }, ['simple']).max_participants).toBe(12);
    expect(initialTournamentForm(undefined, ['simple']).max_participants).toBe(32);
  });

  it('le formulaire lit le champ sans parseInt et bloque l’enregistrement tant qu’il est refusé', () => {
    const src = read('components/tournaments/TournamentForm.tsx');
    expect(src).not.toMatch(/set\('max_participants', parseInt/);
    expect(src).toMatch(/set\('max_participants', parseMaxParticipants\(e\.target\.value\)\)/);
    expect(src).toMatch(/if \(maxError\) \{ maxRef\.current\?\.focus\(\); return; \}/);
    expect(src).toMatch(/aria-describedby=\{maxError \? 'erreur-max-participants' : undefined\}/);
  });
});

describe('Clôture : refus de la base dits en français', () => {
  it('TABLEAU_NON_TERMINE : nombre accordé, match décisif et petite finale cités, sans code ni « (s) »', () => {
    const three = tournamentRefusal('TABLEAU_NON_TERMINE : 3 athlète(s) encore en lice');
    expect(three).toContain('3 athlètes sont encore en lice');
    expect(three).toMatch(/match décisif/);
    expect(three).toMatch(/petite finale/);
    expect(three).not.toMatch(/TABLEAU_NON_TERMINE|\(s\)/);
    expect(tournamentRefusal('TABLEAU_NON_TERMINE : 1 athlète(s) encore en lice')).toContain('1 athlète est encore en lice');
    expect(tournamentRefusal('TABLEAU_NON_TERMINE')).toMatch(/^Le tableau n’est pas terminé/);
  });

  it('SCORES_EN_ATTENTE, TOURNOI_DEJA_CLOTURE, ELO_INCOHERENT, FORMAT_INCONNU', () => {
    expect(tournamentRefusal('SCORES_EN_ATTENTE : 2 score(s) à valider ou rejeter avant la clôture')).toBe('2 scores sont encore en attente : valide-les ou rejette-les avant de clôturer.');
    expect(tournamentRefusal('TOURNOI_DEJA_CLOTURE : l\'ELO de ce tournoi a déjà été distribué')).toBe('Ce tournoi est déjà clôturé : son ELO a déjà été distribué.');
    expect(tournamentRefusal('ELO_INCOHERENT : 1 profil(s) ≠ elo_after après clôture')).toMatch(/^La clôture a été annulée/);
    expect(tournamentRefusal('FORMAT_INCONNU : truc')).toMatch(/ne peut pas être clôturé/);
    expect(tournamentRefusal('Accès refusé : gérant ou co-gérant de la box du tournoi requis', '42501')).toBe('Tu n’as pas les droits pour gérer ce tournoi.');
  });

  it('les codes déjà gérés restent traduits', () => {
    expect(tournamentRefusal('MATCH_TERMINE: x')).toMatch(/^Ce match est terminé/);
    expect(tournamentRefusal('STATUT_RECUL: un tournoi démarré ne revient pas aux inscriptions.')).toBe('Un tournoi démarré ne revient pas aux inscriptions.');
  });

  it('le bouton de clôture passe par tournamentRefusal, jamais le message brut', () => {
    const src = read('components/tournaments/CloseTournamentButton.tsx');
    expect(src).toMatch(/setError\(tournamentRefusal\(rpcErr\.message, rpcErr\.code\)\)/);
    expect(src).not.toMatch(/setError\(rpcErr\.message\)/);
  });
});

describe('Écart d’ELO par match', () => {
  const deltas = matchEloDeltas([
    { match_id: 'm1', athlete_id: 'a', elo_delta: 14 },
    { match_id: 'm1', athlete_id: 'b', elo_delta: -14 },
  ]);

  it('affiché sur un match terminé, pour chaque athlète', () => {
    expect(matchEloDelta(deltas, { id: 'm1', status: 'completed' }, 'a')).toBe(14);
    expect(matchEloDelta(deltas, { id: 'm1', status: 'completed' }, 'b')).toBe(-14);
  });

  it('rien sur un forfait, une exemption, un match à jouer, ou sans ligne', () => {
    for (const status of ['forfeit', 'bye', 'active', 'pending']) {
      expect(matchEloDelta(deltas, { id: 'm1', status }, 'a')).toBeNull();
    }
    expect(matchEloDelta(deltas, { id: 'm2', status: 'completed' }, 'a')).toBeNull();
    expect(matchEloDelta(deltas, { id: 'm1', status: 'completed' }, null)).toBeNull();
  });

  it('gain en succès, perte en danger, avec le vrai signe moins', () => {
    expect(eloDeltaDisplay(14)).toEqual({ text: '+14', tone: 'success' });
    expect(eloDeltaDisplay(-14)).toEqual({ text: '−14', tone: 'danger' });
    expect(eloDeltaDisplay(0)).toEqual({ text: '0', tone: 'neutral' });
  });

  it('la page du tableau lit l’historique ELO de CE tournoi et le passe au tableau', () => {
    const page = read('app/(dashboard)/tournaments/[id]/bracket/page.tsx');
    expect(page).toMatch(/from\('tournament_match_elo_history'\)\.select\('match_id, athlete_id, elo_delta'\)\.eq\('tournament_id', id\)/);
    expect(page).toMatch(/eloDeltas=\{matchEloDeltas\(/);
    const bm = read('components/tournaments/BracketManager.tsx');
    expect(bm).toMatch(/tone === 'success' \? 'text-ax-success' : tone === 'danger' \? 'text-ax-danger'/);
    expect(bm).toMatch(/\{elo != null && <EloDelta delta=\{elo\} \/>\}/);
  });
});
