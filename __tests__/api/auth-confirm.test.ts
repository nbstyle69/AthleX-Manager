// Vérification serveur des liens d'e-mail (`/auth/confirm`).
//
// Ce qui est verrouillé ici : le lien est vérifié sur son `token_hash`, donc
// sans aucun état du navigateur d'origine (c'est la panne « PKCE code verifier
// not found in storage ») ; un lien incomplet, expiré ou déjà utilisé n'expose
// jamais le message brut de GoTrue ; une vérification réussie ouvre la session
// du back-office ; et `next` ne peut pas emmener l'utilisateur — session
// fraîche en poche — vers un autre domaine.

const verifyOtp = jest.fn();

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({ auth: { verifyOtp } })),
}));

import { GET } from '../../app/auth/confirm/route';
import { safeNext, recoveryErrorFrom } from '../../lib/auth/recovery';

const SITE = 'https://athlexapp.eu';

function req(query: string): any {
  return { url: `${SITE}/auth/confirm${query}` };
}

type Redirect = {
  _redirect: URL;
  cookies: { get: (name: string) => { name: string; value: string } | undefined };
};

async function call(query: string) {
  const res = (await GET(req(query))) as unknown as Redirect;
  return { url: new URL(res._redirect.toString()), res };
}

const SESSION = {
  session: { access_token: 'jeton-acces', refresh_token: 'jeton-rafraichissement' },
};

describe('GET /auth/confirm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://exemple.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'cle-publique';
  });

  it('vérifie le token_hash et renvoie vers next avec la session du back-office', async () => {
    verifyOtp.mockResolvedValue({ data: SESSION, error: null });

    const { url, res } = await call('?token_hash=abc&type=recovery&next=/update-password');

    expect(verifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: 'abc' });
    expect(url.pathname).toBe('/update-password');
    expect(url.searchParams.get('error')).toBeNull();
    expect(res.cookies.get('sb-access-token')?.value).toBe('jeton-acces');
    expect(res.cookies.get('sb-refresh-token')?.value).toBe('jeton-rafraichissement');
  });

  it('accepte le redirectTo absolu du template partagé, réduit à son chemin', async () => {
    verifyOtp.mockResolvedValue({ data: SESSION, error: null });

    const { url } = await call(
      `?token_hash=abc&type=recovery&next=${encodeURIComponent(`${SITE}/update-password`)}`,
    );

    expect(url.origin).toBe(SITE);
    expect(url.pathname).toBe('/update-password');
  });

  it("refuse d'emmener la session vers un autre domaine", async () => {
    verifyOtp.mockResolvedValue({ data: SESSION, error: null });

    const { url } = await call(
      `?token_hash=abc&type=recovery&next=${encodeURIComponent('https://exemple-pirate.tld/vol')}`,
    );

    expect(url.origin).toBe(SITE);
    expect(url.pathname).toBe('/update-password');
  });

  it('jeton invalide : code lisible, message de GoTrue jamais transmis', async () => {
    verifyOtp.mockResolvedValue({
      data: { session: null },
      error: { message: 'Email link is invalid or has expired' },
    });

    const { url, res } = await call('?token_hash=perime&type=recovery');

    expect(url.pathname).toBe('/update-password');
    expect(url.searchParams.get('error')).toBe('expired');
    expect(url.toString()).not.toMatch(/GoTrue|Email link/i);
    expect(res.cookies.get('sb-access-token')).toBeUndefined();
  });

  it('type manquant ou inconnu : aucune vérification tentée', async () => {
    const sansType = await call('?token_hash=abc');
    expect(sansType.url.searchParams.get('error')).toBe('incomplete');

    const typeInconnu = await call('?token_hash=abc&type=whatever');
    expect(typeInconnu.url.searchParams.get('error')).toBe('incomplete');

    const sansJeton = await call('?type=recovery');
    expect(sansJeton.url.searchParams.get('error')).toBe('incomplete');

    expect(verifyOtp).not.toHaveBeenCalled();
  });
});

describe('safeNext', () => {
  it('garde un chemin du site, rejette tout le reste', () => {
    expect(safeNext('/update-password')).toBe('/update-password');
    expect(safeNext(`${SITE}/update-password?lang=en`)).toBe('/update-password?lang=en');
    expect(safeNext(null)).toBe('/update-password');
    expect(safeNext('//exemple-pirate.tld')).toBe('/update-password');
    expect(safeNext('https://exemple-pirate.tld/vol')).toBe('/update-password');
    expect(safeNext('athlex://update-password')).toBe('/update-password');
  });
});

describe('recoveryErrorFrom', () => {
  it('un lien expiré et un lien déjà consommé se disent de la même façon', () => {
    expect(recoveryErrorFrom('Email link is invalid or has expired')).toBe('expired');
    expect(recoveryErrorFrom('Token has already been used')).toBe('expired');
    expect(recoveryErrorFrom('unexpected_failure')).toBe('invalid');
    expect(recoveryErrorFrom(undefined)).toBe('invalid');
  });
});
