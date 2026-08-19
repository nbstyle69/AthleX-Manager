import { isBoxPrimaryOwner } from '@/lib/requireBoxOwner';

type Row = { id: string } | null;

/**
 * Stub chaînable : renvoie `boxes` seulement quand les deux `eq` correspondent,
 * comme le fait `boxes.owner_id = userId` en base.
 */
function client(boxes: Array<{ id: string; owner_id: string }>) {
  return {
    from(table: string) {
      const filters: Record<string, string> = {};
      const chain = {
        select: () => chain,
        eq: (col: string, val: string) => {
          filters[col] = val;
          return chain;
        },
        maybeSingle: async (): Promise<{ data: Row }> => {
          if (table !== 'boxes') return { data: null };
          const hit = boxes.find((b) => b.id === filters.id && b.owner_id === filters.owner_id);
          return { data: hit ? { id: hit.id } : null };
        },
      };
      return chain;
    },
  } as never;
}

const BOX = 'box-1';
const OWNER = 'owner-1';
const CO_OWNER = 'co-owner-1';

describe('isBoxPrimaryOwner', () => {
  const boxes = [{ id: BOX, owner_id: OWNER }];

  it('accepte le gérant principal', async () => {
    await expect(isBoxPrimaryOwner(client(boxes), OWNER, BOX)).resolves.toBe(true);
  });

  it('refuse un co-gérant : il lit l’abonnement, il ne le modifie pas', async () => {
    await expect(isBoxPrimaryOwner(client(boxes), CO_OWNER, BOX)).resolves.toBe(false);
  });

  it('refuse le gérant d’une autre box', async () => {
    await expect(isBoxPrimaryOwner(client(boxes), OWNER, 'box-2')).resolves.toBe(false);
  });
});
