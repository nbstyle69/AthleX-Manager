import fs from 'fs';
import path from 'path';
import { COACH_HREFS } from '@/lib/authz/coach-perimeter';
import {
  ECHEC_ENVOI, MEMBRE_RETIRE,
  compteurListe, dateHistorique, envoiPossible, envoyerNotification, filtrerMembres, grouperParLettre,
  libelleDestinataire, membrePreselectionne, resultatEnvoi, resultatHistorique, trierMembres,
  type MembreAZ,
} from '@/lib/boxNotifications';

/**
 * Notifications du gérant (D4b) : règles reprises de l'app (PR #467).
 */
const m = (user_id: string, username: string): MembreAZ => ({ user_id, username });
const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), 'utf8');

const ACTIFS = [m('u3', 'Émile'), m('u1', 'bruno'), m('u2', 'Alix'), m('u4', '42crew'), m('u5', 'éva'), m('u6', 'Eden')];

describe('liste de A à Z', () => {
  it('trie sans accents ni casse, « # » en dernier', () => {
    expect(trierMembres(ACTIFS).map((x) => x.username)).toEqual(['Alix', 'bruno', 'Eden', 'Émile', 'éva', '42crew']);
  });

  it('range par lettre, accents ramenés à leur lettre', () => {
    expect(grouperParLettre(ACTIFS).map((s) => [s.lettre, s.membres.length])).toEqual([
      ['A', 1], ['B', 1], ['E', 3], ['#', 1],
    ]);
  });

  it('filtre sur la saisie sans accents ni casse, et reste trié', () => {
    expect(filtrerMembres(ACTIFS, 'É').map((x) => x.username)).toEqual(['Eden', 'Émile', 'éva', '42crew']);
    expect(filtrerMembres(ACTIFS, 'EMI').map((x) => x.user_id)).toEqual(['u3']);
    expect(filtrerMembres(ACTIFS, '  ')).toHaveLength(6);
  });

  it('compte les membres actifs sans saisie, les résultats sinon', () => {
    expect(compteurListe(155, 155, '')).toBe('155 membres actifs, de A à Z');
    expect(compteurListe(155, 3, 'ka')).toBe('3 résultats');
    expect(compteurListe(155, 1, 'ka')).toBe('1 résultat');
  });
});

describe('présélection par l’URL', () => {
  it('retient un membre actif de la box active', () => {
    expect(membrePreselectionne('u2', ACTIFS)).toBe('u2');
  });

  it('ignore un membre d’une autre box, un paramètre vide ou absent', () => {
    expect(membrePreselectionne('autre-box', ACTIFS)).toBeNull();
    expect(membrePreselectionne('', ACTIFS)).toBeNull();
    expect(membrePreselectionne(null, ACTIFS)).toBeNull();
  });

  it('la page passe `?membre=` au client, qui le valide contre la liste chargée', () => {
    expect(read('app', '(dashboard)', 'notifications', 'page.tsx')).toContain('membreParam={typeof membre === \'string\' ? membre : null}');
    expect(read('app', '(dashboard)', 'notifications', 'NotificationsClient.tsx')).toContain('membrePreselectionne(membreParam, actifs)');
  });
});

describe('résultat de l’envoi', () => {
  it('encadré vert dès qu’un appareil est atteint', () => {
    expect(resultatEnvoi(148, null)).toEqual({ ton: 'success', texte: 'Envoyée à 148 appareils.' });
    expect(resultatEnvoi(1, 'Karim')).toEqual({ ton: 'success', texte: 'Envoyée à 1 appareil.' });
  });

  it('encadré orange à 0, avec le pseudo pour un membre', () => {
    expect(resultatEnvoi(0, 'Karim')).toEqual({
      ton: 'warning',
      texte: 'Non reçue : Karim n’a pas activé les notifications ou n’est connecté sur aucun téléphone.',
    });
    expect(resultatEnvoi(0, null)).toEqual({ ton: 'warning', texte: 'Non reçue : aucun membre n’a activé les notifications.' });
  });
});

describe('historique', () => {
  it('résultat selon delivered_count : vide si NULL', () => {
    expect(resultatHistorique(null)).toBeNull();
    expect(resultatHistorique(undefined)).toBeNull();
    expect(resultatHistorique(0)).toEqual({ ton: 'warning', texte: 'Non reçue' });
    expect(resultatHistorique(1)).toEqual({ ton: 'success', texte: '1 appareil' });
    expect(resultatHistorique(151)).toEqual({ ton: 'success', texte: '151 appareils' });
  });

  it('destinataire : « Tous », le pseudo, ou « Membre retiré »', () => {
    expect(libelleDestinataire('all', ACTIFS)).toBe('Tous');
    expect(libelleDestinataire('u1', ACTIFS)).toBe('bruno');
    expect(libelleDestinataire('parti', ACTIFS)).toBe(MEMBRE_RETIRE);
  });

  it('date et heure de Paris', () => {
    expect(dateHistorique('2026-10-03T13:09:00Z')).toBe('03/10 · 15:09');
  });

  it('sous 640 px : liste empilée ; au-dessus : la Table', () => {
    const src = read('app', '(dashboard)', 'notifications', 'NotificationsClient.tsx');
    expect(src).toMatch(/<ul data-testid="notif-historique-liste"[^>]*className="sm:hidden /);
    expect(src).toMatch(/<div className="hidden sm:block">\s*<Table aria-label="Historique des notifications">/);
  });

  it('lit les 20 dernières de la box active', () => {
    const src = read('app', '(dashboard)', 'notifications', 'NotificationsClient.tsx');
    expect(src).toMatch(/from\('box_notifications'\)[\s\S]*?\.eq\('box_id', id\)[\s\S]*?\.order\('created_at', \{ ascending: false \}\)[\s\S]*?\.limit\(20\)/);
  });
});

describe('bouton Envoyer', () => {
  it('désactivé sans titre et pendant l’envoi', () => {
    expect(envoiPossible('Ouverture', false)).toBe(true);
    expect(envoiPossible('Ouverture', true)).toBe(false);
    expect(envoiPossible('   ', false)).toBe(false);
  });

  it('la page branche cette règle sur `disabled`', () => {
    const src = read('app', '(dashboard)', 'notifications', 'NotificationsClient.tsx');
    expect(src).toContain('const pret = envoiPossible(titre, envoi) && (mode === \'all\' || !!choisi);');
    expect(src).toMatch(/disabled=\{!pret\} onClick=\{envoyer\}/);
  });
});

describe('envoi : insertion RLS puis send-box-notification', () => {
  function fake(opts: { insertError?: unknown; invoke?: { data?: unknown; error?: unknown } }) {
    const calls: { insert?: Record<string, unknown>; invoke?: [string, unknown] } = {};
    const supabase = {
      from: (table: string) => {
        expect(table).toBe('box_notifications');
        return {
          insert: (row: Record<string, unknown>) => {
            calls.insert = row;
            return { select: () => ({ single: async () => (opts.insertError ? { data: null, error: opts.insertError } : { data: { id: 'n1' }, error: null }) }) };
          },
        };
      },
      functions: {
        invoke: async (name: string, o: unknown) => {
          calls.invoke = [name, o];
          return { data: opts.invoke?.data ?? null, error: opts.invoke?.error ?? null };
        },
      },
    };
    return { supabase: supabase as any, calls };
  }
  const N = { boxId: 'b1', userId: 'u0', titre: ' Ouverture ', message: '', target: 'all' };

  it('insère la ligne puis appelle la fonction avec son id ; rend `sent`', async () => {
    const { supabase, calls } = fake({ invoke: { data: { sent: 3, recipients: 4, pref_disabled: 1 } } });
    expect(await envoyerNotification(supabase, N)).toEqual({ ok: true, sent: 3 });
    expect(calls.insert).toEqual({ box_id: 'b1', title: 'Ouverture', body: '', target: 'all', created_by: 'u0' });
    expect(calls.invoke).toEqual(['send-box-notification', { body: { notification_id: 'n1' } }]);
  });

  it('409 « Already sent » : erreur d’envoi, ligne enregistrée', async () => {
    const { supabase } = fake({ invoke: { error: { message: 'Edge Function returned a non-2xx status code', context: { status: 409 } } } });
    expect(await envoyerNotification(supabase, N)).toEqual({ ok: false, erreur: ECHEC_ENVOI, enregistree: true });
  });

  it('insertion refusée : pas d’appel à la fonction', async () => {
    const { supabase, calls } = fake({ insertError: { message: 'new row violates row-level security policy', code: '42501' } });
    const r = await envoyerNotification(supabase, N);
    expect(r).toEqual({ ok: false, erreur: 'new row violates row-level security policy (42501)', enregistree: false });
    expect(calls.invoke).toBeUndefined();
  });

  it('n’utilise jamais la clé serveur côté page', () => {
    for (const f of ['NotificationsClient.tsx', 'page.tsx', 'layout.tsx']) {
      expect(read('app', '(dashboard)', 'notifications', f)).not.toMatch(/SERVICE_ROLE|createServiceClient/);
    }
    expect(read('lib', 'boxNotifications.ts')).not.toMatch(/SERVICE_ROLE|createServiceClient/);
  });
});

describe('accès : gérant et co-gérants seulement', () => {
  const SIDEBAR = read('components', 'layout', 'Sidebar.tsx');

  it('l’entrée « Notifications » suit « Messages » dans le groupe Animation', () => {
    const animation = SIDEBAR.slice(SIDEBAR.indexOf("key: 'animation'"), SIDEBAR.indexOf("key: 'pilotage'"));
    expect(animation).toMatch(/href: '\/messages',[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*\{ href: '\/notifications', label: 'Notifications', icon: Bell \}/);
  });

  it('absente du menu du coach (hors périmètre coach, que la barre latérale filtre)', () => {
    expect(COACH_HREFS).not.toContain('/notifications');
    expect(SIDEBAR).toContain('g.items.filter(i => COACH_HREFS.includes(i.href))');
  });

  it('route refusée au coach par la garde serveur', () => {
    expect(read('app', '(dashboard)', 'notifications', 'layout.tsx')).toContain('await requireOwnerAdminRoute();');
  });

  it('fiche athlète : bouton vers /notifications avec le membre, seulement si `notifiable`', () => {
    const sheet = read('components', 'dashboard', 'AthleteSheet.tsx');
    expect(sheet).toMatch(/\{notifiable && \([\s\S]*?href=\{`\/notifications\?membre=\$\{encodeURIComponent\(memberId\)\}`\}[\s\S]*?Envoyer une notification/);
    expect(read('app', '(dashboard)', 'members', 'page.tsx')).toContain('notifiable={members.some(m => m.id === sheetMemberId && !m.is_banned)}');
  });
});
