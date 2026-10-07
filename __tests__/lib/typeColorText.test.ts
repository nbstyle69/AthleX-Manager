import fs from 'fs';
import path from 'path';

// Le texte d'un type de séance passe par textTint() : la couleur brute (jaune,
// vert, menthe) tombe sous 4,5:1 en thème clair. Le fond et la pastille gardent
// la couleur pure.
const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('texte du type de séance teinté', () => {
  it('Marketplace : badge du type', () => {
    const src = lire('components/marketplace/MarketplaceWorkspace.tsx');
    expect(src).toContain("import { softVar, textTint } from '@/lib/colorVars';");
    expect(src).toContain('style={{ backgroundColor: softVar(TYPE_COLOR[w.wod_type], 0.125), color: textTint(TYPE_COLOR[w.wod_type]) }}');
    expect(src).not.toMatch(/color: TYPE_COLOR\[/);
  });

  it('Éditeur de séances : libellé du type dans Badges', () => {
    const src = lire('components/programs/ProgramSessionsEditor.tsx');
    expect(src).toContain("import { softVar, textTint } from '@/lib/colorVars';");
    expect(src).toContain('style={{ color: textTint(color) }}>{wt.toUpperCase()}</span>');
    expect(src).toContain('style={{ backgroundColor: color }}');
    expect(src).not.toContain('style={{ color }}');
  });

  it('Import PDF : menu Type, avec repli quand le type est vide', () => {
    const src = lire('components/wods/PdfImportModal.tsx');
    expect(src).toContain("import { softVar, textTint } from '@/lib/colorVars';");
    expect(src).toContain("style={{ color: textTint(TYPE_COLOR[e.type ?? ''] ?? 'var(--ax-neutral)') }}");
    expect(src).not.toMatch(/color: TYPE_COLOR\[/);
  });
});
