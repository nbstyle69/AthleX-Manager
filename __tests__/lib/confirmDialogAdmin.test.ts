import { readFileSync } from 'fs';
import { join } from 'path';

// Section D du relevé (fix/confirm-dialogs) : espace super-administrateur, sauf
// D13 (écran Programmes, hors périmètre). Le bouton ouvre la boîte ; l'action
// n'est lancée que par son bouton d'action (`run`).
const lire = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');

const CHANGELOG = 'app/admin/changelog/page.tsx';
const CONTESTS = 'app/admin/daily-contests/page.tsx';
const INTER = 'app/admin/inter-competitions/[id]/page.tsx';
const INTER_LIST = 'app/admin/inter-competitions/page.tsx';
const PARTNERS = 'app/admin/partners/page.tsx';
const PHYS = 'app/admin/physical-competitions/[id]/page.tsx';
const PHYS_LIST = 'app/admin/physical-competitions/page.tsx';
const PROGRAMS = 'app/admin/programs/page.tsx';
const TOURN = 'app/admin/tournaments/[id]/page.tsx';
const TOURN_LIST = 'app/admin/tournaments/page.tsx';
const FILES = [CHANGELOG, CONTESTS, INTER, INTER_LIST, PARTNERS, PHYS, PHYS_LIST, PROGRAMS, TOURN, TOURN_LIST];

interface Site { id: string; file: string; opens: string; direct: string; run: RegExp }

const SITES: Site[] = [
  { id: 'D1 entrée du journal', file: CHANGELOG, opens: 'onClick={() => askDelete(entry)}', direct: 'onClick={() => handleDelete(', run: /function askDelete[\s\S]{0,900}run: \(\) => handleDelete\(entry\.id\),/ },
  { id: 'D2 valider un score contesté', file: CONTESTS, opens: 'onClick={() => askValidate(score)}', direct: 'onClick={() => handleValidate(', run: /function askValidate[\s\S]{0,700}run: \(\) => handleValidate\(score\),/ },
  { id: 'D3 rejeter un score contesté', file: CONTESTS, opens: 'onClick={() => askReject(score)}', direct: 'onClick={() => handleReject(', run: /function askReject[\s\S]{0,700}run: \(\) => handleReject\(score\),/ },
  { id: 'D4 WOD inter-box', file: INTER, opens: '<button onClick={() => askDeleteWod(w)}', direct: '<button onClick={() => deleteWod(', run: /function askDeleteWod[\s\S]{0,800}run: \(\) => deleteWod\(w\.id\),/ },
  { id: 'D5 retirer un participant', file: INTER, opens: '<button onClick={() => askRemoveReg(r)}', direct: '<button onClick={() => removeReg(', run: /function askRemoveReg[\s\S]{0,900}run: \(\) => removeReg\(r\.id\),/ },
  { id: 'D6 disqualifier', file: INTER, opens: '<button onClick={() => askDisqualify(r)}', direct: '<button onClick={() => disqualifyReg(', run: /function askDisqualify[\s\S]{0,700}run: \(\) => disqualifyReg\(r\.id\),/ },
  { id: 'D7 rejeter un score (avec motif)', file: INTER, opens: 'onClick={() => askRejectScore(s)}', direct: "validateScore(s.id, 'rejected', reason);", run: /function askRejectScore[\s\S]{0,900}field: \{ label: 'Motif \(facultatif\)' \},[\s\S]{0,200}run: reason => validateScore\(s\.id, 'rejected', reason \|\| undefined\),/ },
  { id: 'D8 compétition inter-box', file: INTER_LIST, opens: 'onClick={() => askDelete(c)}', direct: 'onClick={() => handleDelete(', run: /function askDelete[\s\S]{0,900}run: \(\) => handleDelete\(c\.id\),/ },
  { id: 'D9 partenaire', file: PARTNERS, opens: 'onClick={() => askDelete(p)}', direct: 'onClick={() => handleDelete(', run: /function askDelete[\s\S]{0,1000}run: \(\) => handleDelete\(p\.id\),/ },
  { id: 'D10 WOD sur place', file: PHYS, opens: '<button onClick={() => askDeleteWod(w)}', direct: '<button onClick={() => handleDeleteWod(', run: /function askDeleteWod[\s\S]{0,900}run: \(\) => handleDeleteWod\(w\),/ },
  { id: 'D11 compétition sur place', file: PHYS_LIST, opens: 'onClick={() => askDelete(c)}', direct: 'onClick={() => handleDelete(', run: /function askDelete[\s\S]{0,900}run: \(\) => handleDelete\(c\.id\),/ },
  { id: 'D12 affilié', file: PROGRAMS, opens: '<button onClick={() => askDeleteAff(a)}', direct: '<button onClick={() => deleteAff(', run: /function askDeleteAff[\s\S]{0,700}run: \(\) => deleteAff\(a\.id\),/ },
  { id: 'D14 tournoi quotidien (fiche)', file: TOURN, opens: '<button onClick={askDeleteTournament}', direct: '<button onClick={handleDeleteTournament}', run: /function askDeleteTournament[\s\S]{0,800}run: handleDeleteTournament,/ },
  { id: 'D15 score de tournoi quotidien', file: TOURN, opens: '<button onClick={() => askDeleteScore(score)}', direct: '<button onClick={() => handleDeleteScore(', run: /function askDeleteScore[\s\S]{0,900}run: \(\) => handleDeleteScore\(score\.id\),/ },
];

describe('Section D : le bouton ouvre la boîte, l’action part de son bouton d’action', () => {
  it.each(SITES.map(s => [s.id, s] as const))('%s', (_id, s) => {
    const src = lire(s.file);
    expect(src).toContain(s.opens);
    expect(src).not.toContain(s.direct);
    expect(src).toMatch(s.run);
  });

  it('D16 et D17 (liste des tournois) : supprimer et masquer ouvrent la boîte puis s’arrêtent', () => {
    const src = lire(TOURN_LIST);
    const quick = src.slice(src.indexOf('async function quickAction'), src.indexOf('async function runAction'));
    // Chaque bloc est lu seul : le motif ne peut pas enjamber jusqu'au bloc suivant.
    const bloc = (action: string) => quick.slice(quick.indexOf(`if (action === '${action}') {`)).split(/\n    (?:\/\/|if \(action|await runAction)/)[0];
    expect(bloc('delete')).toMatch(/ask\(\{[\s\S]*run: \(\) => runAction\(action, tournamentId\),\s*\}\);\s*return;\s*\}$/);
    expect(bloc('cancel')).toMatch(/cancelLabel: 'Retour',[\s\S]*confirmLabel: 'Masquer le tournoi',[\s\S]*run: \(\) => runAction\(action, tournamentId\),\s*\}\);\s*return;\s*\}$/);
    expect(quick).not.toMatch(/fetch\(/);
    expect(src).toMatch(/async function runAction[\s\S]{0,300}fetch\(`\/api\/admin\/daily-tournaments\?id=\$\{tournamentId\}`, \{ method: 'DELETE' \}\)/);
  });

  it('D12 : le texte ne prétend plus supprimer les programmes', () => {
    const src = lire(PROGRAMS);
    expect(src).toMatch(/Aucun programme n’est supprimé/);
    expect(src).not.toMatch(/Supprimer cet affilié et tous ses programmes/);
  });

  it('D13 reste hors de cette PR (écran Programmes, diagnostic séparé)', () => {
    expect(lire(PROGRAMS)).toContain("if (!confirm('Supprimer ce programme ?')) return;");
  });

  it('aucune autre boîte native ne reste dans les fichiers de la section D', () => {
    for (const file of FILES) {
      const src = lire(file).replace("if (!confirm('Supprimer ce programme ?')) return;", '');
      expect(src).not.toMatch(/(^|[^\w.])(window\.)?(confirm|prompt)\(/m);
    }
  });

  it('chaque écran affiche la boîte', () => {
    for (const file of FILES) expect(lire(file)).toMatch(/\{dialog\}/);
  });
});
