// Correctif : modifier un tournoi ne doit plus réécrire son format (ni aucun
// autre champ non touché) avec une valeur par défaut du formulaire.
import { readFileSync } from 'fs';
import { join } from 'path';
import { DEFAULT_RULES, initialTournamentForm, tournamentUpdatePayload } from '@/lib/tournamentForm';
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
function save(t: ReturnType<typeof row>, edit: (f: any) => void = () => {}, publish = false) {
  const start = initialTournamentForm(t, EDIT_ALLOWED);
  const form = { ...start };
  edit(form);
  const payload = tournamentUpdatePayload(start, form, {
    boxId: t.box_id, publish, bannerUrl: t.banner_url as string | null, initialBannerUrl: t.banner_url as string | null,
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

  it('« Publier » en modification : statut ouvert, format intact', () => {
    const { payload, after } = save(row({ format: 'swiss', status: 'active' }), () => {}, true);
    expect(payload.status).toBe('open');
    expect(after.format).toBe('swiss');
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
    const p = tournamentUpdatePayload(start, { ...start }, { boxId: 'box-1', publish: false, bannerUrl: null, initialBannerUrl: t.banner_url });
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
