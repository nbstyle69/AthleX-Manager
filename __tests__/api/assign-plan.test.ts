// Formule d'un membre écrite côté serveur (POST /api/members/assign-plan) :
// gérant ou co-gérant seulement, formule de la box, membre de la box, clé
// serveur. Garde réelle (`isBoxOwnerAdmin`), base simulée qui filtre vraiment.
jest.mock('@/lib/supabase/server', () => ({
  getServerUser: jest.fn(),
  createServiceClient: jest.fn(),
}));

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { POST } from '../../app/api/members/assign-plan/route';
import { getServerUser, createServiceClient } from '@/lib/supabase/server';
import { fakeSupabase } from '../__fixtures__/fakeSupabase';

const mockUser = getServerUser as jest.Mock;
const mockService = createServiceClient as jest.Mock;
const req = (body: any): any => ({ json: jest.fn().mockResolvedValue(body) });

let db: ReturnType<typeof fakeSupabase>;
function setup(userId: string | null) {
  db = fakeSupabase({
    boxes: [{ id: 'b1', owner_id: 'gerant' }, { id: 'b2', owner_id: 'autre-gerant' }],
    box_members: [
      { id: 'bm-co', box_id: 'b1', member_id: 'cogerant', role: 'owner', status: 'active', plan_id: null },
      { id: 'bm-coach', box_id: 'b1', member_id: 'coach', role: 'coach', status: 'active', plan_id: null },
      { id: 'bm-m', box_id: 'b1', member_id: 'membre', role: 'member', status: 'active', plan_id: 'pl-1' },
      { id: 'bm-x', box_id: 'b2', member_id: 'ailleurs', role: 'member', status: 'active', plan_id: null },
    ],
    membership_plans: [{ id: 'pl-1', box_id: 'b1' }, { id: 'pl-2', box_id: 'b1' }, { id: 'pl-b2', box_id: 'b2' }],
  });
  mockService.mockReturnValue(db.client);
  mockUser.mockResolvedValue(userId ? { id: userId } : null);
}
const planOf = (id: string) => db.tables.box_members.find(r => r.id === id)!.plan_id;
const planWrites = () => db.writes.filter(w => w.table === 'box_members' && w.op === 'update');

describe('POST /api/members/assign-plan', () => {
  it.each(['gerant', 'cogerant'])('%s : formule écrite sur la seule ligne du membre, avec la clé serveur', async (who) => {
    setup(who);
    const res: any = await POST(req({ box_id: 'b1', member_id: 'membre', plan_id: 'pl-2' }));
    expect(res._status ?? 200).toBe(200);
    expect(res._data).toEqual({ ok: true, plan_id: 'pl-2' });
    expect(planOf('bm-m')).toBe('pl-2');
    expect(planWrites()).toEqual([{ table: 'box_members', op: 'update', values: { plan_id: 'pl-2' }, match: { id: 'bm-m' } }]);
    expect(mockService).toHaveBeenCalled();
  });

  it('retirer la formule (plan_id null) : accepté', async () => {
    setup('gerant');
    const res: any = await POST(req({ box_id: 'b1', member_id: 'membre', plan_id: null }));
    expect(res._data).toEqual({ ok: true, plan_id: null });
    expect(planOf('bm-m')).toBeNull();
  });

  it.each(['coach', 'membre', 'ailleurs'])('%s : 403, rien écrit', async (who) => {
    setup(who);
    const res: any = await POST(req({ box_id: 'b1', member_id: 'membre', plan_id: 'pl-2' }));
    expect(res._status).toBe(403);
    expect(planWrites()).toEqual([]);
    expect(planOf('bm-m')).toBe('pl-1');
  });

  it('sans session : 401', async () => {
    setup(null);
    expect((await POST(req({ box_id: 'b1', member_id: 'membre', plan_id: 'pl-2' })) as any)._status).toBe(401);
  });

  it('formule d’une autre box : 404, rien écrit', async () => {
    setup('gerant');
    const res: any = await POST(req({ box_id: 'b1', member_id: 'membre', plan_id: 'pl-b2' }));
    expect(res._status).toBe(404);
    expect(res._data.error).toBe('Formule introuvable dans cette box.');
    expect(planWrites()).toEqual([]);
  });

  it('membre d’une autre box : 404, rien écrit', async () => {
    setup('gerant');
    const res: any = await POST(req({ box_id: 'b1', member_id: 'ailleurs', plan_id: 'pl-2' }));
    expect(res._status).toBe(404);
    expect(res._data.error).toBe('Membre introuvable.');
    expect(planWrites()).toEqual([]);
  });

  it('paramètres invalides : 400', async () => {
    setup('gerant');
    expect((await POST(req({ box_id: 'b1', member_id: 'membre', plan_id: 42 })) as any)._status).toBe(400);
    expect((await POST(req({ box_id: 'b1', plan_id: 'pl-2' })) as any)._status).toBe(400);
    expect(planWrites()).toEqual([]);
  });
});

describe('aucune écriture de facturation de box_members depuis le navigateur', () => {
  const BILLING = /\b(plan_id|stripe_[a-z_]+|subscription_[a-z_]+|commitment_end_date|amount_cents|pause_[a-z_]+|dunning_[a-z_]+|past_due_since|payment_method_type|last_payment_error)\s*:/;
  const walk = (d: string): string[] => readdirSync(d).flatMap(n => {
    const p = join(d, n);
    if (statSync(p).isDirectory()) return n === 'api' && d.endsWith('app') ? [] : walk(p);
    return /\.tsx?$/.test(n) ? [p] : [];
  });

  it('pages, composants et hooks : aucune écriture de box_members ne touche une colonne de facturation', () => {
    const hits: string[] = [];
    for (const f of ['app', 'components', 'hooks'].flatMap(r => walk(join(process.cwd(), r)))) {
      const s = readFileSync(f, 'utf8');
      for (const m of s.matchAll(/from\(\s*['"]box_members['"]\s*\)\s*\.(update|insert|upsert)\(/g)) {
        const after = s.slice(m.index! + m[0].length);
        const payload = after.slice(0, after.indexOf(')'));
        if (BILLING.test(payload)) hits.push(`${f}: ${payload.trim().slice(0, 60)}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('la page Membres passe par la route serveur', () => {
    const s = readFileSync(join(process.cwd(), 'app/(dashboard)/members/page.tsx'), 'utf8');
    expect(s).toMatch(/fetch\('\/api\/members\/assign-plan'/);
    expect(s).toMatch(/if \(!ok\) \{ inform\(\{ kind: 'error', title: ERROR_TITLE, body: data\.error \?\? 'La formule n’a pas été modifiée\.' \}\); return; \}\s*setMembers\(prev => prev\.map\(m => m\.id === memberId \? \{ \.\.\.m, plan_id: planId \} : m\)\);/);
  });
});
