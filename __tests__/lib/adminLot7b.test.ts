// Lot 7b — super-admin (contenu) : jetons `--ax-*` seulement, corrections de
// débordement à 390 px, actions au clavier, et « Programmes » touché en
// apparence seulement (D13 : lectures, écritures et boîte native intactes).
import { readFileSync } from 'fs';
import { join } from 'path';

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
    expect(changelog).toContain("{ value: 'fix', label: 'Fix', icon: Bug, color: 'text-ax-danger bg-ax-danger-soft' }");
    expect(changelog).toContain("{ value: 'feature', label: 'Feature', icon: Sparkles, color: 'text-ax-success bg-ax-success-soft' }");
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
