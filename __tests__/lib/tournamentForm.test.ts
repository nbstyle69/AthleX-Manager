// Correctif : modifier un tournoi ne doit plus réécrire son format (ni aucun
// autre champ non touché) avec une valeur par défaut du formulaire.
import { readFileSync } from 'fs';
import { join } from 'path';
import { DEFAULT_RULES, initialTournamentForm, statusChangeAllowed, statusEditable, tournamentUpdatePayload } from '@/lib/tournamentForm';
import { fromDateInput } from '@/lib/datetime';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');

// Tournoi tel que la page de modification le lit (`select('*')`).
const row = (over: Record<string, unknown> = {}) => ({
  id: 't1', box_id: 'box-1', name: 'Open d’automne', description: 'Trois épreuves.', level: 'rx+',
  status: 'active', start_date: '2026-10-03T16:30:00+00:00', end_date: '2026-10-05',
  max_participants: 12, prize: 'Médaille', format: 'bracket', require_video_proof: true,
  rules: 'Règlement maison.', banner_url: 'https://exemple.fr/b.png', ...over,
});

// Ce que fait la page de modification : `TournamentForm` sans `allowedFormats`.
const EDIT_ALLOWED = ['simple'];
// « Enregistrer » et « Publier » envoient la même chose en modification.
function save(t: ReturnType<typeof row>, edit: (f: any) => void = () => {}) {
  const start = initialTournamentForm(t, EDIT_ALLOWED);
  const form = { ...start };
  edit(form);
  const payload = tournamentUpdatePayload(start, form, {
    boxId: t.box_id, bannerUrl: t.banner_url as string | null, initialBannerUrl: t.banner_url as string | null,
  });
  return { payload, after: { ...t, ...payload } };
}

describe('modifier un tournoi conserve son format', () => {
  it.each(['bracket', 'swiss', 'league_div', 'simple'])('%s : le format reste le même après « Enregistrer »', fmt => {
    const { payload, after } = save(row({ format: fmt }), f => { f.name = 'Nouveau nom'; });
    expect(payload).not.toHaveProperty('format');
    expect(after.format).toBe(fmt);
    expect(after.name).toBe('Nouveau nom');
  });

  it('même si l’état du formulaire contient un autre format, il ne part pas', () => {
    const { payload } = save(row({ format: 'bracket' }), f => { f.format = 'simple'; });
    expect(payload).not.toHaveProperty('format');
  });

});

describe('statut en modification', () => {
  const src = read('components/tournaments/TournamentForm.tsx');

  it.each(['open', 'active', 'completed'])('« Publier » sur un tournoi %s : aucun statut envoyé, statut conservé', status => {
    const { payload, after } = save(row({ status }), f => { f.name = 'Autre'; });
    expect(payload).not.toHaveProperty('status');
    expect(after.status).toBe(status);
    // Côté écran, la modification ignore `publish` : même envoi pour les deux boutons.
    expect(src).toMatch(/const update = tournamentUpdatePayload\(start, form, \{\s*boxId, bannerUrl, initialBannerUrl: initial\?\.banner_url \?\? null,\s*\}\);/);
  });

  it('passage volontaire « Inscriptions ouvertes » → « En cours » : envoyé', () => {
    const { payload, after } = save(row({ status: 'open' }), f => { f.status = 'active'; });
    expect(payload.status).toBe('active');
    expect(after.status).toBe('active');
  });

  it('retour arrière impossible : « En cours » → « Inscriptions ouvertes » n’est pas envoyé', () => {
    const { payload, after } = save(row({ status: 'active' }), f => { f.status = 'open'; });
    expect(payload).not.toHaveProperty('status');
    expect(after.status).toBe('active');
    expect(save(row({ status: 'completed' }), f => { f.status = 'open'; }).payload).not.toHaveProperty('status');
    expect(save(row({ status: 'completed' }), f => { f.status = 'active'; }).payload).not.toHaveProperty('status');
  });

  it('« Terminé » jamais envoyé par le formulaire', () => {
    expect(save(row({ status: 'open' }), f => { f.status = 'completed'; }).payload).not.toHaveProperty('status');
    expect(save(row({ status: 'active' }), f => { f.status = 'completed'; }).payload).not.toHaveProperty('status');
    expect(statusChangeAllowed('open', 'completed')).toBe(false);
    expect(statusChangeAllowed('active', 'completed')).toBe(false);
  });

  it('« Terminé » jamais proposé ; liste seulement pour un tournoi ouvert, sinon lecture seule', () => {
    expect(statusEditable('open')).toBe(true);
    expect(statusEditable('active')).toBe(false);
    expect(statusEditable('completed')).toBe(false);
    // La liste ne propose que ouvert et en cours, libellés d'avant.
    expect(src).toMatch(/const STATUSES = \[\s*\{ value: 'open', {3}label: 'Inscriptions ouvertes' \},\s*\{ value: 'active', label: 'En cours' \},\s*\];/);
    expect(src).toContain("{STATUSES.map(s => <option key={s.value} value={s.value} className=\"text-black\">{s.label}</option>)}");
    expect(src).not.toMatch(/value: 'completed'/);
    expect(src).toContain('const statusLocked = !!initial && !statusEditable(start.status);');
    expect(src).toMatch(/\{statusLocked \? \(\s*<div className=\{inp\} aria-readonly="true" data-testid="statut-lecture-seule">\{statusLabel\}<\/div>/);
    expect(src).toContain("const statusLabel = start.status === 'completed' ? 'Clôturé'");
  });

  it('création inchangée : « Publier » y ouvre les inscriptions', () => {
    expect(src).toContain("status:     publish ? 'open' : form.status,");
  });
});

describe('les autres champs non touchés gardent leur valeur enregistrée', () => {
  it('date de début avec une heure : pas ramenée à minuit', () => {
    const t = row({ start_date: '2026-10-03T16:30:00+00:00' });
    const { payload, after } = save(t, f => { f.name = 'Autre'; });
    expect(payload).not.toHaveProperty('start_date');
    expect(after.start_date).toBe('2026-10-03T16:30:00+00:00');
  });

  it('récompense vide en base (null) : pas réécrite en chaîne vide', () => {
    const { payload, after } = save(row({ prize: null }), f => { f.name = 'Autre'; });
    expect(payload).not.toHaveProperty('prize');
    expect(after.prize).toBeNull();
  });

  it('règlement vide en base (null) : pas remplacé par le règlement type', () => {
    const { payload, after } = save(row({ rules: null }), f => { f.name = 'Autre'; });
    expect(payload).not.toHaveProperty('rules');
    expect(after.rules).toBeNull();
    expect(initialTournamentForm(row({ rules: null }), EDIT_ALLOWED).rules).toBe(DEFAULT_RULES); // affichage inchangé
  });

  it('description vide en base (null) : pas réécrite en chaîne vide', () => {
    const { payload, after } = save(row({ description: null }), f => { f.name = 'Autre'; });
    expect(payload).not.toHaveProperty('description');
    expect(after.description).toBeNull();
  });

  it('niveau, statut, participants, preuve vidéo, date de fin, image : non envoyés s’ils ne changent pas', () => {
    const { payload } = save(row(), f => { f.name = 'Autre'; });
    expect(payload).toEqual({ name: 'Autre', box_id: 'box-1' });
  });

  it('un champ changé part, avec la même mise en forme qu’avant', () => {
    const { payload } = save(row(), f => {
      f.start_date = '2026-11-02'; f.end_date = ''; f.max_participants = 24; f.prize = ''; f.level = 'pro';
    });
    expect(payload).toEqual({
      name: 'Open d’automne', box_id: 'box-1',
      start_date: fromDateInput('2026-11-02'), end_date: null, max_participants: 24, prize: '', level: 'pro',
    });
  });

  it('image changée ou retirée : envoyée', () => {
    const t = row();
    const start = initialTournamentForm(t, EDIT_ALLOWED);
    const p = tournamentUpdatePayload(start, { ...start }, { boxId: 'box-1', bannerUrl: null, initialBannerUrl: t.banner_url });
    expect(p).toHaveProperty('banner_url', null);
  });
});

describe('branchement dans TournamentForm', () => {
  const src = read('components/tournaments/TournamentForm.tsx');
  it('la modification passe par tournamentUpdatePayload, plus par ...form', () => {
    expect(src).toMatch(/if \(initial\?\.id\) \{[\s\S]{0,200}const update = tournamentUpdatePayload\(start, form, \{/);
    expect(src).toContain(".update(update).eq('id', initial.id)");
    expect(src).not.toMatch(/\.update\(payload\)/);
  });
  it('la création ne change pas : ...form, format compris, en insert', () => {
    expect(src).toMatch(/const payload {2}= \{\s*\.\.\.form,\s*box_id: {5}boxId,/);
    expect(src).toContain(".insert(payload).select('id').single()");
  });
  it('format : choix à la création, lecture seule à la modification', () => {
    // Création : les cartes-boutons, derrière `!initial`.
    expect(src).toMatch(/\{!initial && \(\s*<div[^>]*>\s*<h2[^>]*>Format du tournoi<\/h2>[\s\S]{0,700}onClick=\{\(\) => set\('format', fmt\)\}/);
    // Modification : une carte non interactive avec le libellé actuel.
    const ro = src.slice(src.indexOf('data-testid="format-lecture-seule"'), src.indexOf('{/* Section générale */}'));
    expect(ro).toContain('{(FORMAT_META[initial.format] ?? { label: initial.format }).label}');
    expect(ro).toContain('aria-readonly="true"');
    expect(ro).not.toMatch(/<button|onClick|set\('format'/);
    expect(src).toMatch(/\{initial && \(\s*<div[^>]*data-testid="format-lecture-seule"/);
  });
});

describe('bouton « Publier »', () => {
  const src = read('components/tournaments/TournamentForm.tsx');
  // Le bloc du bouton, depuis sa garde jusqu'à sa fermeture.
  const guard = src.indexOf('{!initial && (\n          <button type="button" disabled={saving} onClick={(e) => handleSubmit(e as any, true)}');
  const block = guard >= 0 ? src.slice(guard, src.indexOf(')}', src.indexOf('Publier', guard)) + 2) : '';

  it.each(['open', 'active', 'completed'])('absent en modification (tournoi %s) : rendu seulement sans `initial`', status => {
    // La page Modifier passe toujours `initial` : la garde ne dépend que de lui, pas du statut.
    const t = row({ status });
    expect(!!t).toBe(true);
    expect(block).toContain('Publier');
    expect(block.startsWith('{!initial && (')).toBe(true);
    expect(block).not.toMatch(/status|statusLocked|statusEditable/);
    // Un seul bouton « Publier », et il est dans ce bloc.
    expect(src.split('Publier\n').length - 1).toBe(1);
  });

  it('présent à la création, où il ouvre les inscriptions', () => {
    expect(block).toContain('onClick={(e) => handleSubmit(e as any, true)}');
    expect(src).toContain("status:     publish ? 'open' : form.status,");
    // « Enregistrer » reste pour les deux cas, hors de la garde.
    expect(src).toMatch(/<button type="submit" disabled=\{saving\}[\s\S]{0,300}Enregistrer\s*<\/button>\s*\{\/\*/);
  });
});
