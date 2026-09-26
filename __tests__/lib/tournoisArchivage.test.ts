// Tournois, lot Manager PR 1 (priorité 0) : archivage et désarchivage, refus
// traduits, régénération par la base seule, case « Inscriptions ouvertes
// pendant le tournoi », tournois archivés masqués. Branchement seulement : la
// base décide (athlex-app #371, PR 10).
import { readFileSync } from 'fs';
import { join } from 'path';
import { GENERIC_REFUSAL, REGENERATE_BODY, isResultsRefusal, tournamentRefusal } from '@/lib/tournaments/refusals';
import {
  ARCHIVE_BODY, UNARCHIVE_BODY, archiveRequest, archivedBanner, hasValidatedResult, setTournamentArchived, unarchiveRequest,
} from '@/lib/tournaments/archive';
import { REGISTRATIONS_LABEL, START_DATE_HINT, openNowBody, registrationsHint, startDialogTexts } from '@/lib/tournaments/registrations';
import { initialTournamentForm, tournamentUpdatePayload } from '@/lib/tournamentForm';
import { fullDate } from '@/lib/confirmDialog';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');

describe('refus de la base, en français clair', () => {
  it.each([
    ["MATCH_TERMINE: un match terminé ne peut pas être supprimé. Pour corriger le résultat, remets le match à jouer ou choisis le vainqueur : l'ELO est recalculé.", 'Ce match est terminé : il ne peut pas être supprimé. Pour corriger le résultat, remets-le à jouer ou choisis le vainqueur ; l’ELO est recalculé.'],
    ['Cannot regenerate: tournament already has completed matches', 'Le tableau ne peut plus être régénéré : un match est déjà joué. Pour corriger un résultat, remets le match à jouer ou choisis le vainqueur.'],
    ['Need at least 2 participants to generate a bracket', 'Il faut au moins 2 participants pour tirer le tableau.'],
    ['Not authorized: only the box owner/coach or an admin can manage this tournament', 'Tu n’as pas les droits pour gérer ce tournoi.'],
    ['Accès refusé : gérant, co-gérant ou coach de la box du tournoi requis', 'Tu n’as pas les droits pour gérer ce tournoi.'],
    ['TOURNOI_INCONNU', 'Ce tournoi n’existe plus.'],
    ['TOURNOI_ARCHIVE: ce tournoi est archivé, les inscriptions sont fermées.', 'Ce tournoi est archivé : les inscriptions sont fermées. Désarchive-le pour ajouter un participant.'],
    ['INSCRIPTIONS_FERMEES: le tournoi a démarré, les inscriptions sont closes.', 'Le tournoi a démarré : les inscriptions sont closes.'],
    ['INSCRIPTIONS_FERMEES: le tournoi est terminé.', 'Le tournoi est terminé : les inscriptions sont closes.'],
    ['TABLEAU_DEJA_TIRE: le tableau est déjà tiré, les inscriptions sont closes.', 'Le tableau est déjà tiré : les inscriptions sont closes.'],
    ["DIVISION_PLEINE: la division d'entrée de la ligue est complète.", 'La division d’entrée de la ligue est complète.'],
    ["DIVISION_INDISPONIBLE: la ligue n'a pas de division ouverte aux inscriptions.", 'La ligue n’a pas de division ouverte aux inscriptions.'],
    ['TOURNOI_COMPLET: le nombre maximal de participants est atteint.', 'Le nombre maximal de participants est atteint.'],
    ['HORS_BOX: ce tournoi est réservé aux membres de la box.', 'Ce tournoi est réservé aux membres de la box.'],
    ['GENRE_CIBLE: ce tournoi est réservé à une autre catégorie.', 'Ce tournoi est réservé à une autre catégorie.'],
    ["FORMAT_FIGE: le format d'un tournoi ne change pas après sa création.", 'Le format d’un tournoi ne change pas après sa création.'],
    ['STATUT_RECUL: un tournoi démarré ne revient pas aux inscriptions.', 'Un tournoi démarré ne revient pas aux inscriptions.'],
    ['TOURNOI_CLOTURE: un tournoi clôturé ne change plus de statut.', 'Un tournoi clôturé ne change plus de statut.'],
    ["CLOTURE_DEDIEE: un tournoi se clôture par la clôture dédiée, qui calcule l'ELO final, pas par une mise à jour directe.", 'Un tournoi se clôture par sa clôture dédiée, qui calcule l’ELO final.'],
    ['NOUVEAU_CODE: un texte de la base.', 'Un texte de la base.'],
    ['new row violates row-level security policy', GENERIC_REFUSAL],
    ['', GENERIC_REFUSAL],
  ])('%s', (message, expected) => {
    expect(tournamentRefusal(message)).toBe(expected);
    expect(tournamentRefusal(message)).not.toMatch(/[A-Z]{2,}_[A-Z_]+/);
  });

  it('42501 sans texte connu : droits', () => {
    expect(tournamentRefusal('permission denied for table tournaments', '42501')).toBe('Tu n’as pas les droits pour gérer ce tournoi.');
  });

  it('TOURNOI_AVEC_RESULTATS est reconnu (l’écran propose l’archivage)', () => {
    expect(isResultsRefusal('TOURNOI_AVEC_RESULTATS: ce tournoi a des résultats validés (score validé)…')).toBe(true);
    expect(isResultsRefusal('MATCH_TERMINE: …')).toBe(false);
    expect(isResultsRefusal(null)).toBe(false);
  });
});

describe('archivage', () => {
  it('résultat validé vu par le Manager : clôturé, match terminé ou forfait, score validé', () => {
    expect(hasValidatedResult({ status: 'completed', finishedMatches: 0, validatedScores: 0 })).toBe(true);
    expect(hasValidatedResult({ status: 'active', finishedMatches: 1, validatedScores: 0 })).toBe(true);
    expect(hasValidatedResult({ status: 'active', finishedMatches: 0, validatedScores: 2 })).toBe(true);
    expect(hasValidatedResult({ status: 'open', finishedMatches: 0, validatedScores: 0 })).toBe(false);
  });

  it('fenêtres validées : archiver (non rouge), désarchiver', () => {
    const run = jest.fn();
    expect(archiveRequest('Open d’été', run)).toEqual({
      title: 'Archiver ce tournoi ?', element: 'Open d’été', body: ARCHIVE_BODY, confirmLabel: 'Archiver', cancelLabel: 'Annuler', run,
    });
    expect(ARCHIVE_BODY).toBe('Ce tournoi a des résultats validés : il ne peut pas être supprimé. Archivé, il n’apparaît plus dans les listes, mais ses résultats, ses classements et l’ELO gagné par les athlètes sont conservés. Tu pourras le désarchiver.');
    expect(archiveRequest('x', run)).not.toHaveProperty('danger');
    expect(unarchiveRequest('Open d’été', run)).toEqual({
      title: 'Désarchiver ce tournoi ?', element: 'Open d’été', body: UNARCHIVE_BODY, confirmLabel: 'Désarchiver', cancelLabel: 'Annuler', run,
    });
    expect(UNARCHIVE_BODY).toBe('Il réapparaît dans les listes, avec ses résultats. S’il était ouvert aux inscriptions et que sa date de début est passée, il démarrera automatiquement dans les 15 minutes.');
  });

  it('bandeau d’un tournoi archivé', () => {
    expect(archivedBanner('2026-09-26T08:00:00Z')).toBe(`Tournoi archivé le ${fullDate('2026-09-26T08:00:00Z')}. Il n’apparaît plus dans les listes ; ses résultats, ses classements et l’ELO gagné sont conservés.`);
  });

  it('appels à la base : archive_tournament / unarchive_tournament, refus traduit', async () => {
    const rpc = jest.fn().mockResolvedValue({ error: null });
    await expect(setTournamentArchived({ rpc }, 't-1', true)).resolves.toBeNull();
    await expect(setTournamentArchived({ rpc }, 't-1', false)).resolves.toBeNull();
    expect(rpc.mock.calls).toEqual([['archive_tournament', { p_tournament_id: 't-1' }], ['unarchive_tournament', { p_tournament_id: 't-1' }]]);
    rpc.mockResolvedValue({ error: { message: 'Accès refusé : gérant, co-gérant ou coach de la box du tournoi requis', code: '42501' } });
    await expect(setTournamentArchived({ rpc }, 't-1', true)).resolves.toBe('Tu n’as pas les droits pour gérer ce tournoi.');
  });
});

describe('inscriptions pendant le tournoi', () => {
  it('textes de la case, par format, et de la date de début', () => {
    expect(REGISTRATIONS_LABEL).toBe('Inscriptions ouvertes pendant le tournoi');
    expect(registrationsHint('simple')).toBe('Les athlètes peuvent s’inscrire après le démarrage. Les WOD déjà fermés le restent pour eux : 0 point.');
    expect(registrationsHint('bracket')).toBe('Les inscriptions restent ouvertes jusqu’au tirage du premier tour.');
    expect(registrationsHint('swiss')).toBe(registrationsHint('bracket'));
    expect(registrationsHint('league_div')).toBe('Les nouveaux inscrits entrent dans la division la plus basse, tant qu’elle a de la place. Ensuite, les inscriptions sont refusées.');
    expect(START_DATE_HINT).toBe('Le tournoi démarre automatiquement ce jour-là à 00:00 (heure de Paris), ou à l’ouverture du premier WOD si elle vient avant.');
  });

  it('« Démarrer » : texte et bouton selon la case', () => {
    expect(startDialogTexts(true)).toEqual({
      body: 'Le tournoi démarre. Les inscriptions restent ouvertes selon son format (voir la case « Inscriptions ouvertes pendant le tournoi »). Les inscrits recevront l’annonce du démarrage dès qu’un WOD sera ouvert.',
      confirmLabel: 'Démarrer le tournoi',
    });
    expect(startDialogTexts(false).confirmLabel).toBe('Démarrer et fermer les inscriptions');
  });

  it('« Ouvrir maintenant » selon la case', () => {
    expect(openNowBody(true, 'lundi 5 octobre 2026 à 18:00')).toBe('Ouvrir maintenant : le WOD devient visible tout de suite et les scores sont acceptés. Si le tournoi n’a pas encore démarré, il démarre ; les inscriptions restent ouvertes selon son format. Garder la date : il s’ouvrira le lundi 5 octobre 2026 à 18:00.');
    expect(openNowBody(false, 'X')).toBe('Ouvrir maintenant : le WOD devient visible tout de suite et les scores sont acceptés. Si le tournoi n’a pas encore démarré, il démarre et les inscriptions se ferment. Garder la date : il s’ouvrira le X, et les inscrits sont prévenus de cette date.');
  });

  it('formulaire : décochée par défaut, lue du tournoi, envoyée seulement si elle change', () => {
    expect(initialTournamentForm(undefined, ['simple']).registrations_open_during_tournament).toBe(false);
    const start = initialTournamentForm({ name: 'T', format: 'bracket', registrations_open_during_tournament: true }, ['simple']);
    expect(start.registrations_open_during_tournament).toBe(true);
    const opts = { boxId: 'b', bannerUrl: null, initialBannerUrl: null };
    expect(tournamentUpdatePayload(start, start, opts)).not.toHaveProperty('registrations_open_during_tournament');
    expect(tournamentUpdatePayload(start, { ...start, registrations_open_during_tournament: false }, opts))
      .toMatchObject({ registrations_open_during_tournament: false });
    expect(tournamentUpdatePayload(start, { ...start, registrations_open_during_tournament: false }, opts)).not.toHaveProperty('format');
  });
});

describe('branchements', () => {
  it('bouton du tournoi : Désarchiver, Archiver, ou Supprimer avec passage à l’archivage sur refus', () => {
    const s = read('components/tournaments/DeleteTournamentButton.tsx');
    expect(s).toMatch(/if \(archivedAt\) \{[\s\S]*?onClick=\{askUnarchive\}[\s\S]*?Désarchiver/);
    expect(s).toMatch(/if \(hasResults\) \{[\s\S]*?onClick=\{askArchive\}[\s\S]*?Archiver/);
    expect(s).toMatch(/if \(err === ARCHIVE_INSTEAD\) \{ setOpen\(false\); askArchive\(\); return; \}/);
    expect(s).toMatch(/setTournamentArchived\(createClient\(\), tournamentId, archived\)/);
  });

  it('fiche du tournoi : résultats comptés, bandeau archivé, props passées', () => {
    const s = read('app/(dashboard)/tournaments/[id]/page.tsx');
    expect(s).toContain(".from('tournament_bracket_matches').select('*', { count: 'exact', head: true }).eq('tournament_id', id).in('status', ['completed', 'forfeit'])");
    expect(s).toContain(".from('tournament_scores').select('*', { count: 'exact', head: true }).eq('tournament_id', id).eq('status', 'validated')");
    expect(s).toContain('hasValidatedResult({ status: t.status, finishedMatches: finishedMatches ?? 0, validatedScores: validatedScores ?? 0 })');
    expect(s).toContain('<DeleteTournamentButton tournamentId={id} name={t.name} archivedAt={t.archived_at ?? null} hasResults={hasResults} />');
    expect(s).toMatch(/\{t\.archived_at && \([\s\S]*?\{archivedBanner\(t\.archived_at\)\}/);
    expect(s).toContain('registrationsOpen={t.registrations_open_during_tournament === true}');
  });

  it('page d’édition : suppression refusée → archivage proposé', () => {
    const s = read('app/(dashboard)/tournaments/[id]/edit/page.tsx');
    expect(s).toMatch(/if \(err === ARCHIVE_INSTEAD\) \{\s*setShowConfirm\(false\);\s*ask\(archiveRequest\(tournament\.name,/);
    expect(s).toContain('{dialog}');
  });

  it('régénérer : la base seule, aucune suppression de match par le Manager, refus traduits', () => {
    const s = read('app/(dashboard)/tournaments/[id]/bracket/actions.ts');
    const regen = s.slice(s.indexOf('export async function regenerateBracketAction'), s.indexOf('export async function createGrandFinalAction'));
    expect(regen).not.toMatch(/\.delete\(/);
    expect(regen).toContain("error: tournamentRefusal(genErr.message, genErr.code)");
    const gen = s.slice(s.indexOf('export async function generateRound1Action'), s.indexOf('export async function advanceRoundAction'));
    expect(gen).toContain('error: tournamentRefusal(err.message, err.code)');
    expect(read('components/tournaments/BracketManager.tsx')).toContain('body: REGENERATE_BODY,');
    expect(REGENERATE_BODY).not.toMatch(/ELO/);
  });

  it('formulaire : case, texte par format, texte de la date, refus traduits', () => {
    const s = read('components/tournaments/TournamentForm.tsx');
    expect(s).toMatch(/checked=\{form\.registrations_open_during_tournament\}\s*onChange=\{e => set\('registrations_open_during_tournament', e\.target\.checked\)\}/);
    expect(s).toContain('{registrationsHint(initial?.format ?? form.format)}');
    expect(s).toContain('{START_DATE_HINT}');
    expect(s.match(/fail\(tournamentRefusal\(err\.message, err\.code\)\)/g)).toHaveLength(2);
  });

  it('démarrer et ouvrir un WOD : textes selon la case, refus traduit', () => {
    const start = read('components/tournaments/StartTournamentButton.tsx');
    expect(start).toContain('...startDialogTexts(registrationsOpen),');
    expect(start).toContain('setError(tournamentRefusal(err.message, err.code))');
    expect(read('components/tournaments/TournamentWODManager.tsx')).toContain('body: openNowBody(registrationsOpen, formatSchedule(wod.opens_at)),');
    const wods = read('app/(dashboard)/tournaments/[id]/wods/page.tsx');
    expect(wods).toContain("'id, name, level, status, format, current_season, max_participants, registrations_open_during_tournament',");
    expect(wods).toContain('registrationsOpen={tournament.registrations_open_during_tournament === true}');
  });

  it('listes : les archivés masqués ; filtre « Actifs · Archivés »', () => {
    const list = read('app/(dashboard)/tournaments/page.tsx');
    expect(list).toContain("(showArchived ? base.not('archived_at', 'is', null) : base.is('archived_at', null))");
    expect(list).toContain("const showArchived = (await searchParams).vue === 'archives';");
    expect(list).toMatch(/\[\[false, 'Actifs', '\/tournaments'\], \[true, 'Archivés', '\/tournaments\?vue=archives'\]\]/);
    expect(list).toContain('Aucun tournoi archivé.');
    const dash = read('app/(dashboard)/page.tsx');
    expect(dash).toContain("supabase.from('tournaments').select('id').eq('box_id', box.id).is('archived_at', null),");
    expect(dash).toContain(".eq('box_id', box.id).in('status', ['open', 'active']).is('archived_at', null),");
    expect(dash).toContain(".eq('box_id', box.id).is('archived_at', null).order('created_at', { ascending: false }).limit(3),");
  });

  it('stats (box et super-admin) : « en cours » sans les archivés, total inchangé', () => {
    const stats = read('app/(dashboard)/stats/page.tsx');
    expect(stats).toContain(".eq('box_id', box.id).in('status', ['open', 'active']).is('archived_at', null),");
    expect(stats).toContain("supabase.from('tournaments').select('*', { count: 'exact', head: true }).eq('box_id', box.id),");
    const admin = read('app/admin/analytics/page.tsx');
    expect(admin).toContain(".neq('status', 'closed').is('archived_at', null),");
    expect(admin).toContain("supabase.from('tournaments').select('*', { count: 'exact', head: true }),");
  });
});
