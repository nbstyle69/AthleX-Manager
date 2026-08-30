// Tests des deux routes publiques du tunnel Essai.
//
// Ce sont les seules routes du site qui acceptent une écriture sans session.
// Ce qui est verrouillé ici n'est donc pas le format de la réponse : c'est que
// la route ne détient aucun privilège (clé publique uniquement), qu'elle
// prononce le plafond que la base ne peut pas voir, qu'elle ne déguise pas une
// panne de lecture en calendrier vide, et qu'un e-mail raté n'annule pas une
// place déjà prise.

const rpc = jest.fn();
const created: { key: string }[] = [];

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn((_url: string, key: string) => {
    created.push({ key });
    return {
      rpc,
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { name: 'CrossFit Test', slug: 'nbs', address: null, city: 'Lyon', contact_email: null },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
  }),
}));

import { POST as slots } from '../../app/api/trial/slots/route';
import { POST as book } from '../../app/api/trial/book/route';

const SLOT = {
  schedule_id: 'sch-1',
  title: 'WOD 18h',
  scheduled_date: '2026-09-01',
  start_time: '18:00:00',
  end_time: '19:00:00',
};

/** Chaque test parle depuis une IP neuve : le compteur est propre au processus. */
let ipSeq = 0;
function req(body: unknown, ip?: string): any {
  const adresse = ip ?? `10.0.0.${++ipSeq}`;
  return {
    headers: new Headers({ 'x-forwarded-for': `${adresse}, 172.16.0.1` }),
    json: async () => body,
  };
}

describe('POST /api/trial/slots', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    created.length = 0;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://exemple.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'cle-publique';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-de-service';
    delete process.env.RESEND_API_KEY;
  });

  it('n’utilise que la clé publique', async () => {
    rpc.mockResolvedValue({ data: { ok: true, slots: [] }, error: null });
    await slots(req({ box_id: 'box-1' }));
    expect(created.map(c => c.key)).toEqual(['cle-publique']);
    expect(created.some(c => c.key === 'cle-de-service')).toBe(false);
  });

  it('distingue un calendrier vide d’un calendrier illisible', async () => {
    rpc.mockResolvedValue({ data: { ok: true, slots: [] }, error: null });
    const vide = await slots(req({ box_id: 'box-1' }));
    expect(vide.status).toBe(200);
    expect(await vide.json()).toEqual({ ok: true, slots: [] });

    rpc.mockResolvedValue({ data: null, error: { message: 'relation manquante' } });
    const panne = await slots(req({ box_id: 'box-1' }));
    expect(panne.status).toBe(502);
    expect((await panne.json()).reason).toBe('lecture_impossible');
  });

  it('ne laisse pas fuiter la cause technique au visiteur', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'permission denied for table class_reservations' } });
    const res = await slots(req({ box_id: 'box-1' }));
    expect(JSON.stringify(await res.json())).not.toContain('permission denied');
  });

  it('refuse la rafale depuis une même adresse, sans toucher la RPC', async () => {
    rpc.mockResolvedValue({ data: { ok: true, slots: [] }, error: null });
    const ip = '203.0.113.7';
    for (let i = 0; i < 30; i += 1) {
      expect((await slots(req({ box_id: 'box-1' }, ip))).status).toBe(200);
    }
    const appels = rpc.mock.calls.length;
    const res = await slots(req({ box_id: 'box-1' }, ip));
    expect(res.status).toBe(429);
    expect((await res.json()).reason).toBe('trop_de_requetes');
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(rpc.mock.calls.length).toBe(appels);
  });

  it('sert une autre adresse pendant que la première est plafonnée', async () => {
    rpc.mockResolvedValue({ data: { ok: true, slots: [] }, error: null });
    expect((await slots(req({ box_id: 'box-1' }, '203.0.113.7'))).status).toBe(429);
    expect((await slots(req({ box_id: 'box-1' }, '203.0.113.8'))).status).toBe(200);
  });
});

describe('POST /api/trial/book', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    created.length = 0;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://exemple.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'cle-publique';
    delete process.env.RESEND_API_KEY;
  });

  const corps = {
    box_id: 'box-1',
    schedule_id: 'sch-1',
    first_name: 'Jean',
    last_name: '',
    email: 'jean@exemple.fr',
    phone: '',
  };

  const succes = {
    ok: true,
    prospect_id: 'pros-1',
    reservation_id: 'res-1',
    plan: { id: 'plan-1', name: 'Séance découverte' },
    slot: SLOT,
  };

  it('transmet les champs vides en NULL SQL, jamais en chaîne vide', async () => {
    rpc.mockResolvedValue({ data: succes, error: null });
    await book(req(corps));
    expect(rpc).toHaveBeenCalledWith('book_trial_slot', {
      p_box_id: 'box-1',
      p_schedule_id: 'sch-1',
      p_first_name: 'Jean',
      p_last_name: null,
      p_email: 'jean@exemple.fr',
      p_phone: null,
    });
  });

  it('conserve le refus nommé de la base', async () => {
    rpc.mockResolvedValue({ data: { ok: false, reason: 'creneau_complet' }, error: null });
    const res = await book(req(corps));
    expect(await res.json()).toEqual({ ok: false, reason: 'creneau_complet' });
  });

  it('garde la réservation quand l’e-mail ne part pas', async () => {
    rpc.mockResolvedValue({ data: succes, error: null });
    const res = await book(req(corps));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.reservation_id).toBe('res-1');
    expect(json.email_sent).toBe(false);
    expect(json.email_error).toContain('RESEND_API_KEY');
  });

  it('refuse la 4e réservation de la même heure depuis une même adresse', async () => {
    rpc.mockResolvedValue({ data: succes, error: null });
    const ip = '198.51.100.4';
    for (let i = 0; i < 3; i += 1) {
      expect((await book(req(corps, ip))).status).toBe(200);
    }
    const appels = rpc.mock.calls.length;
    const res = await book(req(corps, ip));
    expect(res.status).toBe(429);
    expect((await res.json()).reason).toBe('trop_de_tentatives');
    expect(rpc.mock.calls.length).toBe(appels);
  });
});
