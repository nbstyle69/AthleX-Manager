// Lot 7b — super-admin (contenu) : jetons `--ax-*` seulement, corrections de
// débordement à 390 px, actions au clavier, et « Programmes » touché en
// apparence seulement (D13 : lectures, écritures et boîte native intactes).
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CATALOG_FAMILIES, CATALOG_PATTERNS, FAMILY_LABEL, LOAD_BAND_LABEL, PATTERN_LABEL, validateMovementPatch,
} from '@/lib/adminCatalog';
import { SIDE_BY_SIDE_QUERY, revealEditForm } from '@/lib/admin/revealEditForm';
import { bindModalEscape, escapeHandler } from '@/lib/modalEscape';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const FILES = [
  'app/admin/movements/page.tsx',
  'app/admin/badges/page.tsx',
  'app/admin/changelog/page.tsx',
  'app/admin/partners/page.tsx',
  'app/admin/programs/page.tsx',
  'app/admin/auto-programming/page.tsx',
  'app/admin/volume-caps/page.tsx',
  'app/admin/daily-contests/page.tsx',
  'components/admin/MovementCatalogEditor.tsx',
  'components/admin/MovementStats.tsx',
];

// Même motif que le lot 7a : couleurs Tailwind codées en dur, hexadécimaux.
const LEGACY = /(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border|from|to|divide|accent|placeholder)-(?:white|black|gray|zinc|slate|neutral|red|green|emerald|amber|yellow|orange|blue|sky|cyan|purple|violet|pink|rose)(?:-\d{2,3})?(?:\/[\w.[\]]+)?(?![\w-])|bg-\[#|text-\[#|#[0-9A-Fa-f]{6}\b/;

describe('lot 7b : apparence en jetons', () => {
  it.each(FILES)('%s n’utilise plus de couleur codée en dur', f => {
    const src = read(f).split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'));
    expect(src.filter(l => LEGACY.test(l))).toEqual([]);
  });

  it.each(FILES)('%s : plus de transparence qui rend le texte illisible', f => {
    expect(read(f)).not.toMatch(/(?<!disabled:)\bopacity-(?:30|40|50|60)\b/);
  });

  it('les couleurs gardent leur sens', () => {
    const badges = read('app/admin/badges/page.tsx');
    expect(badges).toContain("c === 'tournament' ? 'text-ax-warning bg-ax-warning-soft'");
    expect(badges).toContain("c === 'movement' ? 'text-ax-danger bg-ax-danger-soft'");
    expect(badges).toContain("c === 'elo' ? `text-ax-purple ${PURPLE_SOFT}`");
    const changelog = read('app/admin/changelog/page.tsx');
    expect(changelog).toContain("{ value: 'fix', label: 'Correction', icon: Bug, color: 'text-ax-danger bg-ax-danger-soft' }");
    expect(changelog).toContain("{ value: 'feature', label: 'Nouveauté', icon: Sparkles, color: 'text-ax-success bg-ax-success-soft' }");
    const auto = read('app/admin/auto-programming/page.tsx');
    expect(auto).toContain("error: 'text-ax-danger bg-ax-danger-soft'");
    expect(auto).toContain("done: 'text-ax-success bg-ax-success-soft'");
    expect(read('app/admin/daily-contests/page.tsx')).toContain("score.rx ? 'bg-ax-success-soft text-ax-success' : `${SUB_ORANGE_SOFT} ${SUB_ORANGE_TEXT}`");
  });
});

describe('lot 7b : rien ne sort de l’écran à 390 px', () => {
  it('les tableaux défilent dans leur zone (Table du lot 1)', () => {
    for (const f of ['components/admin/MovementStats.tsx', 'components/admin/MovementCatalogEditor.tsx', 'app/admin/auto-programming/page.tsx', 'app/admin/volume-caps/page.tsx']) {
      expect(read(f)).toMatch(/<Table aria-label=/);
    }
    // Seule table restante : les bandes de charge, dans leur propre zone défilante.
    expect(read('components/admin/MovementCatalogEditor.tsx')).toMatch(/className="overflow-x-auto[^"]*" role="region" aria-label="Bandes de charge"/);
  });
  it('la fiche du catalogue et le classement passent sous/au-dessus du tableau', () => {
    const editor = read('components/admin/MovementCatalogEditor.tsx');
    expect(editor).toContain('flex flex-col xl:flex-row gap-6');
    expect(editor).toContain('w-full xl:w-[26rem] shrink-0 order-1 xl:order-none');
    const stats = read('components/admin/MovementStats.tsx');
    expect(stats).toContain('flex flex-col lg:flex-row gap-6');
    expect(stats).toContain('w-full lg:w-80 shrink-0');
  });
  it('recherches en pleine largeur, en-têtes qui passent à la ligne', () => {
    expect(read('app/admin/badges/page.tsx')).toContain('relative w-full sm:w-64');
    expect(read('components/admin/MovementStats.tsx')).toContain('relative w-full sm:w-72');
    expect(read('components/admin/MovementCatalogEditor.tsx')).toContain('relative w-full sm:w-64');
    for (const f of FILES.filter(f => !f.startsWith('components') && !f.includes('volume-caps'))) {
      expect(read(f)).toMatch(/className="flex (?:flex-wrap items-center justify-between gap-4|items-center justify-between gap-4 flex-wrap)"/);
    }
  });
  it('libellé masqué contenu dans sa cellule (sinon la page déborde de 647 px)', () => {
    expect(read('app/admin/volume-caps/page.tsx')).toContain('<TableHead className="relative"><span className="sr-only">Enregistrer</span>');
  });
  it('textes lus en entier : plus de troncature', () => {
    for (const f of FILES) expect(read(f)).not.toMatch(/\btruncate\b/);
  });
});

describe('lot 7b : actions au clavier', () => {
  it('lignes cliquables atteignables au clavier', () => {
    for (const f of ['components/admin/MovementStats.tsx', 'components/admin/MovementCatalogEditor.tsx', 'app/admin/volume-caps/page.tsx']) {
      const src = read(f);
      expect(src).toContain('tabIndex={0}');
      expect(src).toMatch(/onKeyDown=\{e => \{ if \([^)]*e\.key === 'Enter' \|\| e\.key === ' '\)/);
    }
    // Le bouton actif/inactif garde sa propre action : la ligne ne réagit qu'à elle-même.
    expect(read('components/admin/MovementCatalogEditor.tsx')).toContain("if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' '))");
  });
  it('boutons-icônes nommés', () => {
    expect(read('app/admin/changelog/page.tsx')).toContain('aria-label={`Supprimer l\'entrée « ${entry.title} »`}');
    expect(read('app/admin/partners/page.tsx')).toContain('aria-label={`Supprimer ${p.name}`}');
    const programs = read('app/admin/programs/page.tsx');
    expect(programs).toContain('aria-label={`Supprimer ${p.name}`}');
    expect(programs).toContain("aria-label={`Ouvrir la page d'achat de ${p.name}`}");
  });
});

describe('Programmes (D13) : apparence seulement', () => {
  const src = read('app/admin/programs/page.tsx');
  it('lectures, écritures et boîte native inchangées', () => {
    expect(src).toContain("if (!confirm('Supprimer ce programme ?')) return;");
    expect(src).toContain("await supabase.from('programs').delete().eq('id', id);");
    expect(src).toContain("const { data } = await supabase.from('program_affiliates').select('*').order('sort_order', { ascending: true });");
    expect(src).toContain("await supabase.from('programs').update({ is_active: !p.is_active, updated_at: new Date().toISOString() }).eq('id', p.id);");
    expect(src).toContain('onClick={() => deletePrg(p.id)}');
  });
  it('seule boîte native des fichiers 7b', () => {
    for (const f of FILES) {
      const n = (read(f).match(/\b(?:window\.)?(?:confirm|alert|prompt)\(/g) ?? []).length;
      expect([f, n]).toEqual([f, f.endsWith('programs/page.tsx') ? 1 : 0]);
    }
  });
});

describe('lot 7b : libellés', () => {
  it('aucun « Owner » affiché dans les fichiers de 7b', () => {
    for (const f of FILES) {
      expect(read(f)).not.toMatch(/>[^<{}]*\b(?:Owner|OWNER|owners?)\b(?![_.?-])[^<{}]*<|['"`][^'"`\n]*\b(?:Owner|owners?)\b(?![_.?-])[^'"`\n]*['"`]/);
    }
  });
});

// ── v2 de 7b (décisions de Nabil) ─────────────────────────────────────────

describe('lot 7b v2 : libellés affichés en français', () => {
  it('Nouveautés : titre et types en français', () => {
    const src = read('app/admin/changelog/page.tsx');
    expect(src).toContain('uppercase tracking-wide text-ax-text">Nouveautés</h1>');
    for (const l of ["label: 'Nouveauté'", "label: 'Correction'", "label: 'Amélioration'"]) expect(src).toContain(l);
    expect(src).toContain('Aucune entrée dans les nouveautés');
    // Le badge d'une entrée affiche le libellé, plus la clé brute.
    expect(src).toContain('{tc.label}');
    expect(src).not.toContain('{entry.type}');
    expect(src).not.toMatch(/>Changelog<|label: '(?:Feature|Fix|Update)'/);
  });
  it('Badges : catégories en français, filtre toujours sur la clé', () => {
    const src = read('app/admin/badges/page.tsx');
    expect(src).toContain("activity: 'Activité', tournament: 'Tournoi'");
    expect(src).toContain("{c === 'all' ? 'Tous' : categoryLabel(c)}");
    expect(src).toContain('{categoryLabel(b.category)}');
    expect(src).toContain("if (catFilter !== 'all' && b.category !== catFilter) return false;");
    expect(src).toContain('onClick={() => setCatFilter(c)}');
    expect(src).toContain('${catColor(b.category)}');
  });
  it('Contestations : mode de score en français, valeurs de base intactes', () => {
    const src = read('app/admin/daily-contests/page.tsx');
    expect(src).toContain("{ time: 'Temps', reps: 'Répétitions', rounds: 'Tours' }");
    expect(src).toContain('{SCORE_MODE_LABEL[score.score_mode] ?? score.score_mode}');
    expect(src).toContain("if (mode === 'time') {");
    expect(src).toContain("score_mode: tournament?.score_mode ?? 'time',");
  });
  it('Programmes, Mouvements, Plafonds : plus de libellé anglais ou technique', () => {
    const programs = read('app/admin/programs/page.tsx');
    expect(programs).toContain("'Envoi du logo...'");
    expect(programs).toContain('URL de l&apos;image</label>');
    expect(programs).not.toMatch(/Upload du logo|>Image URL<|Programming élite/);
    expect(read('app/admin/movements/page.tsx')).not.toContain('`movement_catalog`');
    const stats = read('components/admin/MovementStats.tsx');
    expect(stats).toContain('mouvements suivis');
    expect(stats).toContain('>Meilleurs athlètes</h2>');
    const caps = read('app/admin/volume-caps/page.tsx');
    expect(caps).toContain('famille ${FAMILY_LABEL[c.family] ?? c.family}');
    expect(caps).toContain('>Identifiant</TableHead>');
    const editor = read('components/admin/MovementCatalogEditor.tsx');
    expect(editor).toContain('<option key={f} value={f}>{FAMILY_LABEL[f]}</option>');
    expect(editor).toContain('>{PATTERN_LABEL[p]}</button>');
    expect(editor).toContain('{FAMILY_LABEL[r.family] ?? r.family}');
  });
  it('catalogue : un libellé par clé, les clés envoyées restent celles de la base', () => {
    expect(Object.keys(FAMILY_LABEL)).toEqual([...CATALOG_FAMILIES]);
    expect(Object.keys(PATTERN_LABEL)).toEqual([...CATALOG_PATTERNS]);
    expect(LOAD_BAND_LABEL).toEqual({ light: 'Léger', medium: 'Moyen', heavy: 'Lourd' });
    expect(validateMovementPatch({ family: 'barbell', pattern: ['push_v'] }, false).errors).toEqual([]);
    // Le libellé affiché n'est jamais une valeur acceptée.
    expect(validateMovementPatch({ family: FAMILY_LABEL.barbell }, false).errors).toEqual(['famille inconnue']);
    expect(validateMovementPatch({ pattern: [PATTERN_LABEL.push_v] }, false).errors).toEqual(['pattern inconnu']);
    // Les options gardent la clé en valeur, et la recherche porte sur le nom et l'id.
    const editor = read('components/admin/MovementCatalogEditor.tsx');
    expect(editor).toContain('onChange={e => patchDraft({ family: e.target.value as CatalogFamily })}');
    expect(editor).toContain('(r.name.toLowerCase().includes(search.toLowerCase()) || r.id.includes(search.toLowerCase()))');
  });
});

describe('lot 7b v2 : catalogue, la fiche vient à l’écran sous 1280 px', () => {
  const fake = (wide: boolean, reduced = false) => {
    const calls: string[] = [];
    const form = {
      scrollIntoView: (o: ScrollIntoViewOptions) => { calls.push(`scroll ${o.block} ${o.behavior}`); },
      querySelector: (sel: string) => { calls.push(`query ${sel}`); return { focus: (o?: FocusOptions) => { calls.push(`focus ${o?.preventScroll}`); } }; },
    };
    const mm = (q: string) => ({ matches: q === SIDE_BY_SIDE_QUERY ? wide : reduced });
    return { form, mm, calls };
  };
  it('sous 1280 px : défilement puis focus sur le premier champ', () => {
    const { form, mm, calls } = fake(false);
    expect(revealEditForm(form, mm)).toBe(true);
    expect(calls).toEqual(['scroll start smooth', 'query input, select, textarea', 'focus true']);
  });
  it('mouvement réduit : défilement sans animation', () => {
    const { form, mm, calls } = fake(false, true);
    revealEditForm(form, mm);
    expect(calls[0]).toBe('scroll start auto');
  });
  it('à partir de 1280 px : rien ne bouge', () => {
    const { form, mm, calls } = fake(true);
    expect(SIDE_BY_SIDE_QUERY).toBe('(min-width: 1280px)');
    expect(revealEditForm(form, mm)).toBe(false);
    expect(calls).toEqual([]);
    expect(revealEditForm(null, fake(false).mm)).toBe(false);
  });
  it('branché sur le toucher d’une ligne, après le rendu de la fiche', () => {
    const src = read('components/admin/MovementCatalogEditor.tsx');
    expect(src).toContain('const selectRow = (id: string) => { setCreating(false); setSelectedId(id); setRevealTick(t => t + 1); };');
    expect(src).toContain('if (revealTick === revealed.current || !draft) return;');
    expect(src).toContain('revealEditForm(formRef.current, q => window.matchMedia(q));');
    expect(src).toContain('<div ref={formRef} className="w-full xl:w-[26rem]');
    // « Nouveau mouvement » ne défile pas : la fiche est déjà sous le bouton.
    expect(src).toContain('setCreating(true); setSelectedId(null); setDraft({ ...NEW_DRAFT });');
  });
});

describe('lot 7b v2 : Échap ferme Nouveautés et Partenaires sans enregistrer', () => {
  const key = (k: string, defaultPrevented = false) => {
    const e = { key: k, defaultPrevented, prevented: false, preventDefault() { this.prevented = true; } };
    return e;
  };
  it('Échap ferme une fois ; les autres touches ne font rien', () => {
    const close = jest.fn();
    const h = escapeHandler(close);
    h(key('Enter')); h(key('a'));
    expect(close).not.toHaveBeenCalled();
    const esc = key('Escape');
    h(esc);
    expect(close).toHaveBeenCalledTimes(1);
    expect(esc.prevented).toBe(true);
    h(key('Escape', true));
    expect(close).toHaveBeenCalledTimes(1);
  });
  it('à la fermeture, l’écoute s’arrête et le focus revient au bouton d’ouverture', () => {
    const opener = { focus: jest.fn() };
    const listeners = new Set<(e: any) => void>();
    const doc = { activeElement: opener, addEventListener: (_: 'keydown', f: any) => listeners.add(f), removeEventListener: (_: 'keydown', f: any) => listeners.delete(f) };
    const close = jest.fn();
    const cleanup = bindModalEscape(doc, close);
    expect(listeners.size).toBe(1);
    [...listeners][0](key('Escape'));
    expect(close).toHaveBeenCalledTimes(1);
    expect(opener.focus).not.toHaveBeenCalled();
    cleanup();
    expect(listeners.size).toBe(0);
    expect(opener.focus).toHaveBeenCalledTimes(1);
  });
  it.each(['app/admin/changelog/page.tsx', 'app/admin/partners/page.tsx'])('%s : Échap ferme, n’enregistre pas', f => {
    const src = read(f);
    expect(src).toContain('useModalEscape(showForm, () => setShowForm(false));');
    expect(src).not.toMatch(/useModalEscape\([^)]*handleSave/);
  });
});
