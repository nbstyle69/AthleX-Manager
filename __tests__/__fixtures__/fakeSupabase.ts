/**
 * Faux client Supabase en mémoire (archivage PR 2) : les lectures filtrent de
 * vraies lignes (eq, neq, in, is), les écritures sont appliquées ET journalisées
 * dans `writes`, pour des assertions exactes. `rpc` appelle `rpcs[nom]`.
 */
type Row = Record<string, any>;
type Filter = (r: Row) => boolean;

export interface Write { table: string; op: 'insert' | 'update' | 'delete' | 'upsert'; values?: Row; match: Row }

export function fakeSupabase(tables: Record<string, Row[]>, rpcs: Record<string, (args: any) => any> = {}) {
  const writes: Write[] = [];
  const reads: { table: string; match: Row }[] = [];
  let seq = 0;

  function from(table: string) {
    const filters: Filter[] = [];
    const match: Row = {};
    let op: Write['op'] | null = null;
    let values: Row | undefined;
    let one = false;

    const rows = () => (tables[table] ??= []);
    const run = () => {
      if (op === 'insert' || op === 'upsert') {
        const row = { id: `${table}-${++seq}`, ...values };
        rows().push(row);
        writes.push({ table, op, values, match });
        return { data: one ? { id: row.id } : [row], error: null };
      }
      const hit = rows().filter(r => filters.every(f => f(r)));
      if (op === 'update') {
        hit.forEach(r => Object.assign(r, values));
        writes.push({ table, op, values, match });
        return { data: one ? hit[0] ?? null : hit, error: null };
      }
      if (op === 'delete') {
        tables[table] = rows().filter(r => !hit.includes(r));
        writes.push({ table, op, match });
        return { data: null, error: null };
      }
      reads.push({ table, match });
      return { data: one ? hit[0] ?? null : hit.map(r => ({ ...r })), error: null, count: hit.length };
    };

    const c: any = {
      select: () => c,
      insert: (v: Row) => { op = 'insert'; values = v; return c; },
      upsert: (v: Row) => { op = 'upsert'; values = v; return c; },
      update: (v: Row) => { op = 'update'; values = v; return c; },
      delete: () => { op = 'delete'; return c; },
      eq: (k: string, v: any) => { match[k] = v; filters.push(r => r[k] === v); return c; },
      neq: (k: string, v: any) => { match[`${k}!=`] = v; filters.push(r => r[k] !== v); return c; },
      in: (k: string, v: any[]) => { match[`${k} in`] = v; filters.push(r => v.includes(r[k])); return c; },
      is: (k: string, v: any) => { match[`${k} is`] = v; filters.push(r => (r[k] ?? null) === v); return c; },
      order: () => c,
      limit: () => c,
      maybeSingle: () => { one = true; return Promise.resolve(run()); },
      single: () => { one = true; return Promise.resolve(run()); },
      then: (res: any, rej: any) => Promise.resolve(run()).then(res, rej),
    };
    return c;
  }

  const rpc = jest.fn(async (name: string, args: any) => {
    const h = rpcs[name];
    if (!h) return { data: null, error: { message: `rpc ${name} absente du faux` } };
    return h(args);
  });

  return { client: { from: jest.fn(from), rpc } as any, writes, reads, tables };
}
