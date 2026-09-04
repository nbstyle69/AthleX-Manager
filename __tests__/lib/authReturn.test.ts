import {
  EMAIL_CONFIRMED_PATH,
  UPDATE_PASSWORD_PATH,
  classifyAuthReturn,
  readAuthReturnType,
  resolveAuthReturnPath,
} from '@/lib/authReturn';

describe('retour des liens e-mail Supabase Auth', () => {
  it('un lien « Confirm signup » (implicit) atterrit sur /email-confirme', () => {
    expect(resolveAuthReturnPath('#access_token=a&refresh_token=b&type=signup', '')).toBe(EMAIL_CONFIRMED_PATH);
  });

  it('un lien « Reset password » (implicit) atterrit sur le formulaire de mot de passe', () => {
    expect(resolveAuthReturnPath('#access_token=a&refresh_token=b&type=recovery', '')).toBe(UPDATE_PASSWORD_PATH);
  });

  it('le type est aussi lu dans la query (PKCE)', () => {
    expect(resolveAuthReturnPath('', '?code=xyz&type=signup')).toBe(EMAIL_CONFIRMED_PATH);
    expect(resolveAuthReturnPath('', '?code=xyz&type=recovery')).toBe(UPDATE_PASSWORD_PATH);
  });

  it('sans type (PKCE recovery web), on reste sur le formulaire de mot de passe', () => {
    expect(resolveAuthReturnPath('', '?code=xyz')).toBe(UPDATE_PASSWORD_PATH);
    expect(readAuthReturnType('', '?code=xyz')).toBeNull();
  });

  it('classe email_change / invite / magiclink comme confirmation, le reste comme inconnu', () => {
    expect(classifyAuthReturn('email_change')).toBe('signup');
    expect(classifyAuthReturn('invite')).toBe('signup');
    expect(classifyAuthReturn('magiclink')).toBe('signup');
    expect(classifyAuthReturn('recovery')).toBe('recovery');
    expect(classifyAuthReturn('bidule')).toBe('unknown');
    expect(classifyAuthReturn(null)).toBe('unknown');
  });
});
