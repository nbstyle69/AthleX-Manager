import fs from 'fs';
import path from 'path';

/**
 * Contrôle mécanique du lot 5-C : toute route d'API est classée, et sa classe
 * impose la garde que son code doit porter.
 *
 * L'inventaire est dérivé du disque, pas écrit à la main : une route qui naît
 * sans classification fait échouer la suite. C'est le défaut de 5-B dans une
 * autre robe — `/programs` manquait à une liste tenue à la main.
 *
 * `create-programming-checkout` acceptait `role in ('owner','coach')` : le coach
 * engageait la box dans un abonnement payant. `box/dunning` et `box/invite-code`
 * s'appuyaient sur `getActiveBox`, que le lot 5-B vient d'ouvrir au coach — la
 * box active ne suffit plus à autoriser, il faut le titre.
 */
const API_DIR = path.join(process.cwd(), 'app', 'api');

type Classe =
  /** Argent ou frontière de box : gérant ou co-gérant, jamais le coach. */
  | 'owner_admin'
  /** Contrat Stripe : gérant principal seul. */
  | 'primary_owner'
  /** Facturation du compte gérant lui-même, scopée par `owner_id`. */
  | 'owner_self'
  /** Console plateforme : rôle `admin` / `super_admin`. */
  | 'platform_admin'
  /** Webhook Stripe : autorisé par la signature. */
  | 'webhook'
  /** Session / inscription : pas de box à autoriser. */
  | 'auth'
  /** Autorisé par la possession du jeton d'invitation, pas par une session. */
  | 'token'
  /** L'appelant agit pour lui-même, ou tunnel public d'achat. */
  | 'self_service'
  /** Écriture anonyme : aucune session à lire, donc un plafond de débit par IP. */
  | 'public_debit';

const CLASSIFICATION: Record<string, Classe> = {
  'admin/boxes': 'platform_admin',
  'admin/boxes/[id]': 'platform_admin',
  'admin/daily-tournaments': 'platform_admin',
  'admin/geocode-boxes': 'platform_admin',
  'admin/inter-competitions': 'platform_admin',
  'auth/browser-session': 'auth',
  'auth/clear-session': 'auth',
  'auth/login': 'auth',
  'auth/set-session': 'auth',
  'auth/signup': 'auth',
  'box-export': 'owner_admin',
  'box-revenue': 'owner_admin',
  'box/dunning': 'owner_admin',
  'box/invite-code': 'owner_admin',
  'cancel-membership': 'self_service',
  'cancellation-doc': 'owner_admin',
  'cancellation-request': 'self_service',
  'cancellation-request/review': 'owner_admin',
  'change-membership-plan': 'self_service',
  'connect/onboard': 'primary_owner',
  'connect/status': 'primary_owner',
  'create-box': 'auth',
  'create-checkout': 'primary_owner',
  'create-membership-checkout': 'self_service',
  'create-owner-checkout': 'owner_self',
  'create-program-checkout': 'self_service',
  'create-programming-checkout': 'owner_admin',
  dunning: 'owner_admin',
  'invitations/accept': 'token',
  'invitations/send': 'owner_admin',
  'pause-membership': 'owner_admin',
  'promo-codes': 'owner_admin',
  'promo-codes/[id]': 'owner_admin',
  'stripe-connect-webhook': 'webhook',
  'stripe-portal': 'primary_owner',
  'stripe-webhook': 'webhook',
  'subscriber-invoices': 'owner_admin',
  'trial/book': 'public_debit',
  'trial/slots': 'public_debit',
  'upload-box-logo': 'owner_admin',
  'verify-subscription': 'primary_owner',
};

/** Jeton que le code de la route doit contenir pour sa classe. */
const GARDE: Record<Classe, string | null> = {
  owner_admin: 'isBoxOwnerAdmin(',
  primary_owner: 'requireBoxOwner(',
  owner_self: "eq('owner_id', user.id)",
  platform_admin: 'super_admin',
  webhook: 'constructEvent',
  auth: null,
  token: 'peek_box_invitation',
  self_service: null,
  public_debit: 'takeToken(',
};

/**
 * Classes dont la route doit elle-même lire la session. `primary_owner` en est
 * exclue : `requireBoxOwner` authentifie et refuse, la route ne fait que suivre.
 */
const SESSION_REQUISE: Classe[] = [
  'owner_admin',
  'owner_self',
  'platform_admin',
  'self_service',
];

/** Une route self-service ne s'autorise que sur l'appelant. */
const SELF_SCOPE = ['user.id', 'userId', 'buyerIdentity', 'invitation'];

function routes(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const nom = prefix ? `${prefix}/${entry.name}` : entry.name;
    const complet = path.join(dir, entry.name);
    if (fs.existsSync(path.join(complet, 'route.ts'))) out.push(nom);
    out.push(...routes(complet, nom));
  }
  return out.sort();
}

function source(route: string): string {
  return fs.readFileSync(path.join(API_DIR, ...route.split('/'), 'route.ts'), 'utf8');
}

describe('gardes des routes d’API (inventaire dérivé du disque)', () => {
  const inventaire = routes(API_DIR);
  let examinees = 0;

  it('trouve les routes sur le disque', () => {
    expect(inventaire.length).toBeGreaterThan(30);
  });

  it.each(inventaire)('la route /api/%s est classée', (route) => {
    expect(CLASSIFICATION[route]).toBeDefined();
  });

  it('aucune classification ne désigne une route disparue', () => {
    for (const route of Object.keys(CLASSIFICATION)) {
      expect(inventaire).toContain(route);
    }
  });

  it.each(inventaire)('la route /api/%s porte la garde de sa classe', (route) => {
    examinees += 1;
    const classe = CLASSIFICATION[route];
    const code = source(route);
    const jeton = GARDE[classe];

    if (jeton) expect(code).toContain(jeton);
    if (SESSION_REQUISE.includes(classe)) {
      expect(code).toMatch(/getServerUser|auth\.getUser/);
    }
    if (classe === 'self_service') {
      expect(SELF_SCOPE.some((s) => code.includes(s))).toBe(true);
    }
  });

  it('aucune route d’argent n’autorise un coach', () => {
    for (const [route, classe] of Object.entries(CLASSIFICATION)) {
      if (classe === 'auth' || classe === 'webhook') continue;
      expect(source(route)).not.toMatch(/\[['"]owner['"], ?['"]coach['"]\]/);
    }
  });

  it('aucune route publique anonyme ne détient la clé de service', () => {
    const publiques = Object.entries(CLASSIFICATION)
      .filter(([, classe]) => classe === 'public_debit')
      .map(([route]) => route);
    expect(publiques.length).toBeGreaterThan(0);
    for (const route of publiques) {
      expect(source(route)).not.toMatch(/SERVICE_ROLE/);
    }
  });

  it('a bien examiné toutes les routes trouvées', () => {
    expect(examinees).toBe(inventaire.length);
  });
});
