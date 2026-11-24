// WOD d'offre Marketplace : Score et texte libre (#453, PR 2c ; colonnes
// ajoutées par athlex-app#617).
jest.mock('react', () => jest.requireActual(require('path').join(process.cwd(), 'node_modules', 'react', 'index.js')));
jest.mock('@/lib/supabase/client', () => ({ createClient: () => { throw new Error('pas de réseau en test'); } }));

import { readFileSync } from 'fs';
import { join } from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WodEditor from '@/components/wods/WodEditor';
import { EMPTY_WOD_FORM, WodFormState, withWodType } from '@/lib/wodFields';
import { OfferWod, offerWodForm, offerWodPayload } from '@/lib/offerWod';
import { SCORE_FREE } from '@/lib/wodScoreType';

(globalThis as unknown as { React: typeof React }).React = React;

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ').trim();
const src = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');

const wod = (over: Partial<OfferWod> = {}): OfferWod => ({
  id: 'w1', programming_id: 'p1', week_number: 2, day_of_week: 3, sort_order: 0,
  title: 'Fran', description: '21 Thruster\n15 Pull-up', wod_type: 'for-time', block_name: null,
  time_cap_seconds: null, rounds: null, notes: null, video_url: null, leaderboard_enabled: true,
  emom_interval_minutes: null, tabata_work_seconds: null, tabata_rest_seconds: null,
  score_type: 'time', text_mode: 'lines', ...over,
});

describe('écritures dans box_programming_wods', () => {
  it('création d’un WOD d’offre typé : score_type et text_mode écrits, semaine × jour', () => {
    const form = { ...withWodType({ ...EMPTY_WOD_FORM, title: 'Cindy' }, 'amrap'), week: 2, dayOfWeek: 5 };
    const p = offerWodPayload(form, ['5 Pull-up']);
    expect(p).toMatchObject({ score_type: 'rounds_reps', text_mode: 'lines', week_number: 2, day_of_week: 5, leaderboard_enabled: true });
  });

  it('modification : relu puis réécrit sans rien perdre (Score compris)', () => {
    const w = wod({ score_type: 'reps' });
    const { form, movements } = offerWodForm(w);
    expect(form.scoreType).toBe('reps');
    expect(form.scoreTypeAuto).toBe(false);
    const { id, programming_id, sort_order, ...colonnes } = w;
    void id; void programming_id; void sort_order;
    expect(offerWodPayload(form, movements)).toEqual(colonnes);
  });

  it('modification : changer de Type ne change pas un Score déjà enregistré', () => {
    const { form } = offerWodForm(wod({ score_type: 'reps' }));
    expect(offerWodPayload(withWodType(form, 'strength'), []).score_type).toBe('reps');
  });

  it('« Sans score » : classement coupé même si l’interrupteur dit oui', () => {
    const p = offerWodPayload({ ...EMPTY_WOD_FORM, title: 'Mobilité', scoreType: 'none', leaderboard: true }, []);
    expect(p.score_type).toBe('none');
    expect(p.leaderboard_enabled).toBe(false);
  });

  it('texte libre : séries de tête puis texte tel quel, text_mode = free, relu à l’identique', () => {
    const libre = 'For time\n21-15-9 Thruster + Pull-up\nTC 10\'';
    const form: WodFormState = { ...EMPTY_WOD_FORM, title: 'X', scoreType: 'time', textMode: 'free', freeText: libre };
    const p = offerWodPayload(form, ['Back Squat — 5 × 3 @ 80 %']);
    expect(p.text_mode).toBe('free');
    expect(p.description).toBe(`Back Squat — 5 × 3 @ 80 %\n${libre}`);
    const relu = offerWodForm(wod({ description: p.description, text_mode: 'free' }));
    expect(relu.form.textMode).toBe('free');
    expect(relu.form.freeText).toBe(libre);
    expect(relu.movements).toEqual(['Back Squat — 5 × 3 @ 80 %']);
  });

  it('WOD d’offre existant sans type : « Non défini », réécrit NULL', () => {
    const { form, movements } = offerWodForm(wod({ score_type: null }));
    expect(form.scoreType).toBe('');
    expect(offerWodPayload(form, movements).score_type).toBeNull();
  });
});

describe('éditeur de WOD d’offre (mode programming)', () => {
  const base = {
    heading: 'Nouveau WOD de programmation', submitLabel: 'Ajouter le WOD', setForm: () => {}, setMovements: () => {},
    saving: false, error: null, onClose: () => {}, onSubmit: () => {}, mode: 'programming', weeksCount: 4,
  };
  const render = (form: Partial<WodFormState>, extra: Record<string, unknown> = {}) => renderToStaticMarkup(
    React.createElement(WodEditor, { ...base, movements: [], form: { ...EMPTY_WOD_FORM, title: 'Fran', ...form }, ...extra } as any));
  const submitDisabled = (html: string) => /<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Ajouter le WOD/.test(html);

  it('même champ Score et même sélecteur Mouvements / Texte libre qu’un WOD de box', () => {
    const html = render({ scoreType: 'time' });
    expect(html).toContain('data-testid="champ-score"');
    expect(html).toContain('data-testid="selecteur-mode"');
    expect(text(html)).not.toMatch(/pas encore disponible/);
  });

  it('création : Score obligatoire', () => {
    expect(submitDisabled(render({ scoreType: '' }))).toBe(true);
    expect(submitDisabled(render({ scoreType: 'weight' }))).toBe(false);
  });

  it('« Sans score » : classement grisé et coupé', () => {
    const html = render({ scoreType: 'none', leaderboard: true });
    expect(text(html)).toContain('Pas de classement sans score');
    expect(html).toMatch(/role="switch" aria-checked="false" aria-label="Classement" disabled=""/);
  });

  it('texte libre : aperçu « Ce que l’app comprend » et règle « en tête seulement »', () => {
    const html = render({ scoreType: 'time', textMode: 'free', freeText: '21 Thruster' });
    expect(html).toContain('data-testid="texte-libre"');
    expect(text(html)).toContain('Ce que l’app comprend');
    expect(text(html)).toContain('écrites en tête');
  });

  it('modification d’un WOD sans type (SCORE_FREE) : « Non défini », pas obligatoire, rien de grisé', () => {
    const html = render({ scoreType: '' }, { scoreLock: SCORE_FREE });
    expect(text(html)).toContain('Non défini : les athlètes choisissent.');
    expect(submitDisabled(html)).toBe(false);
    expect(html).not.toContain('data-testid="score-verrou"');
  });
});

describe('MarketplaceWorkspace et imports', () => {
  const ws = src('components/marketplace/MarketplaceWorkspace.tsx');

  it('l’offre écrit et relit par offerWodPayload / offerWodForm, sans verrou en modification', () => {
    expect(ws).toContain('const payload = offerWodPayload(wodForm, movements);');
    expect(ws).toContain('offerWodForm(w)');
    expect(ws).toContain('scoreLock={editWod ? SCORE_FREE : undefined}');
    expect(ws).not.toMatch(/loadScoreLock/);
  });

  it('import PDF / CSV / JSON : inchangé, sans type (décision E7)', () => {
    const imp = src('components/wods/ProgWodImportModal.tsx');
    expect(imp).toContain("from('box_programming_wods').insert(payloads)");
    expect(imp).not.toMatch(/score_type|text_mode|scoreType|textMode/);
  });
});
