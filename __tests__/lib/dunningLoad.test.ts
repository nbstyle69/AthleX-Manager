// Panneau des impayés : `get_box_dunning` refusé (42501) ou en échec ne se lit
// jamais comme « aucun impayé ».
import { readFileSync } from 'fs';
import { join } from 'path';
import { dunningLoad, DUNNING_FORBIDDEN, DUNNING_FAILED } from '@/lib/dunningLoad';

describe('dunningLoad', () => {
  it('refus 42501 : message d’accès', () => {
    expect(dunningLoad({ data: null, error: { code: '42501' } })).toEqual({ rows: [], message: "Tu n'as pas accès aux impayés de cette box." });
  });

  it('autre erreur : message générique, même avec des données', () => {
    expect(dunningLoad({ data: [{ id: 'x' }], error: { code: '57014' } })).toEqual({ rows: [], message: DUNNING_FAILED });
    expect(dunningLoad({ data: null, error: {} })).toEqual({ rows: [], message: DUNNING_FAILED });
    expect(DUNNING_FAILED).not.toBe(DUNNING_FORBIDDEN);
  });

  it('liste vide normale : aucun message', () => {
    expect(dunningLoad({ data: [], error: null })).toEqual({ rows: [], message: null });
  });

  it('impayés : la liste', () => {
    expect(dunningLoad({ data: [{ id: 'bm-1' }], error: null })).toEqual({ rows: [{ id: 'bm-1' }], message: null });
  });
});

it('UnpaidPanel lit l’erreur et l’affiche avant le cas « liste vide »', () => {
  const s = readFileSync(join(process.cwd(), 'components/UnpaidPanel.tsx'), 'utf8');
  expect(s).toMatch(/dunningLoad<UnpaidRow>\(await supabase\.rpc\('get_box_dunning', \{ p_box_id: boxId \}\)\)/);
  expect(s).toMatch(/setLoadError\(message\);/);
  expect(s).toMatch(/if \(loadError\) \{\s*return \([\s\S]*?\{loadError\}[\s\S]*?\);\s*\}/);
  // L'erreur passe avant le « rien à montrer » : jamais masquée par une liste vide.
  expect(s.indexOf('if (loadError) {')).toBeGreaterThan(-1);
  expect(s.indexOf('if (loadError) {')).toBeLessThan(s.indexOf('if (!rows.length) return null;'));
});
