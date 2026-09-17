import fs from 'fs';
import path from 'path';
import {
  DEFAULT_TAB, TAB_LABEL, filterByTab, isTrackTab, resolveTab, trackOf,
  trackTabStorageKey, visibleTabs,
} from '@/lib/autoProgramming';
import {
  SUB_COLOR_DARK, SUB_COLOR_LIGHT, TRACK_COLOR_DARK, TRACK_COLOR_LIGHT,
  subColorVar, trackColorVar,
} from '@/lib/colorVars';

const w = (track: string | null) => ({ track });

describe('onglets de piste du Whiteboard', () => {
  it('n’affiche aucune barre quand aucune carte n’a de piste', () => {
    // Un gérant sans programmation automatique n'a pas à voir un filtre qui
    // ne filtre rien : le composant se tait sur un tableau vide.
    expect(visibleTabs([])).toEqual([]);
    expect(visibleTabs([w(null), w(null)])).toEqual([]);
  });

  it('ne montre que les pistes présentes, dans l’ordre du moteur', () => {
    expect(visibleTabs([w('musculation'), w('functional')]))
      .toEqual(['functional', 'musculation', 'all']);
  });

  it('ajoute « Box » seulement s’il existe une carte sans piste', () => {
    expect(visibleTabs([w('functional')])).toEqual(['functional', 'all']);
    expect(visibleTabs([w('functional'), w(null)])).toEqual(['functional', 'box', 'all']);
  });

  it('place « Tout » en dernier, toujours', () => {
    const tabs = visibleTabs([w('functional'), w('hybrid'), w('musculation'), w(null)]);
    expect(tabs).toEqual(['functional', 'hybrid', 'musculation', 'box', 'all']);
    expect(tabs[tabs.length - 1]).toBe('all');
  });

  it('filtre : « Box » ne retient que les cartes saisies à la main', () => {
    const semaine = [w('functional'), w('hybrid'), w(null), w(null)];
    expect(filterByTab(semaine, 'box')).toHaveLength(2);
    expect(filterByTab(semaine, 'functional')).toHaveLength(1);
    expect(filterByTab(semaine, 'all')).toHaveLength(4);
  });

  it('traite une piste inconnue comme une carte de la box', () => {
    // Une valeur écrite par une version future ne doit pas disparaître.
    expect(trackOf({ track: 'crossfit' })).toBeNull();
    expect(filterByTab([{ track: 'crossfit' }], 'box')).toHaveLength(1);
  });

  it('le gérant arrive sur « Tout » : il gère la semaine entière', () => {
    expect(DEFAULT_TAB).toBe('all');
    expect(resolveTab(undefined, ['functional', 'all'])).toBe('all');
  });

  it('retombe sur « Tout » quand l’onglet mémorisé a disparu cette semaine', () => {
    expect(resolveTab('hybrid', ['functional', 'all'])).toBe('all');
    expect(resolveTab('hybrid', ['functional', 'hybrid', 'all'])).toBe('hybrid');
    expect(resolveTab('nimporte quoi', ['functional', 'all'])).toBe('all');
  });

  it('mémorise par box : deux box n’ont pas les mêmes pistes', () => {
    expect(trackTabStorageKey('box-1')).not.toBe(trackTabStorageKey('box-2'));
    expect(trackTabStorageKey('box-1')).toContain('box-1');
  });

  it('nomme les cinq onglets sans « CrossFit » ni « Hyrox »', () => {
    expect(Object.keys(TAB_LABEL)).toEqual(['functional', 'hybrid', 'musculation', 'box', 'all']);
    expect(TAB_LABEL.all).toBe('Tout');
    expect(TAB_LABEL.box).toBe('Box');
    for (const l of Object.values(TAB_LABEL)) expect(l).not.toMatch(/crossfit|hyrox/i);
    expect(isTrackTab('all')).toBe(true);
    expect(isTrackTab('crossfit')).toBe(false);
  });
});

describe('couleurs déclinées par thème', () => {
  const CSS = fs.readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf8');
  const light = CSS.slice(CSS.indexOf('html.light {'));

  it('rend des variables CSS, jamais un hex en style en ligne', () => {
    // Un hex posé en `style={{ }}` échappe aux surcharges `html.light .classe`
    // de globals.css : la carte gardait sa teinte sombre en mode clair.
    expect(trackColorVar('hybrid')).toBe('var(--track-hybrid)');
    expect(subColorVar('violet')).toBe('var(--sub-violet)');
    expect(subColorVar('inconnue')).toBe('var(--sub-sky)');
  });

  it('déclare chaque variable dans les deux thèmes', () => {
    for (const t of Object.keys(TRACK_COLOR_DARK)) {
      expect(CSS).toContain(`--track-${t}:`);
      expect(light).toContain(`--track-${t}:`);
    }
    for (const s of Object.keys(SUB_COLOR_DARK)) {
      expect(CSS).toContain(`--sub-${s}:`);
      expect(light).toContain(`--sub-${s}:`);
    }
  });

  it('donne au thème clair une valeur DIFFÉRENTE, sinon la déclinaison est un leurre', () => {
    for (const t of Object.keys(TRACK_COLOR_DARK) as (keyof typeof TRACK_COLOR_DARK)[]) {
      expect(TRACK_COLOR_LIGHT[t]).not.toBe(TRACK_COLOR_DARK[t]);
    }
    for (const s of Object.keys(SUB_COLOR_DARK) as (keyof typeof SUB_COLOR_DARK)[]) {
      expect(SUB_COLOR_LIGHT[s]).not.toBe(SUB_COLOR_DARK[s]);
    }
  });

  it('reprend les teintes sombres de l’app athlète pour les trois pistes', () => {
    // Deux palettes pour la même piste donneraient deux couleurs au même objet
    // selon l'écran (src/theme/hues.ts côté athlex-app).
    expect(TRACK_COLOR_DARK).toEqual({
      functional: '#10B981', hybrid: '#F97316', musculation: '#3B82F6',
    });
    expect(TRACK_COLOR_LIGHT).toEqual({
      functional: '#047857', hybrid: '#C2410C', musculation: '#1D4ED8',
    });
  });

  it('déclare les valeurs claires dans le bloc html.light, pas ailleurs', () => {
    expect(light).toContain('--track-functional:  #047857;');
    expect(light).toContain('--sub-sky:     #0369A1;');
  });
});
