import { returnOrigin } from '@/lib/returnOrigin';
import { SITE_URL } from '@/lib/site-url';

const PREVIEW = 'the-iibg3y2ne-nabilselmane-4786s-projects.vercel.app';
const BRANCH = 'the-hub-git-feat-lot3-nabilselmane-4786s-projects.vercel.app';
const saved = { url: process.env.VERCEL_URL, branch: process.env.VERCEL_BRANCH_URL };

afterEach(() => {
  process.env.VERCEL_URL = saved.url;
  process.env.VERCEL_BRANCH_URL = saved.branch;
  if (saved.url === undefined) delete process.env.VERCEL_URL;
  if (saved.branch === undefined) delete process.env.VERCEL_BRANCH_URL;
});

describe('returnOrigin', () => {
  it('production : toujours le site public, comme avant', () => {
    process.env.VERCEL_URL = 'the-prod123-nabilselmane-4786s-projects.vercel.app';
    for (const o of ['https://www.athlexapp.eu', 'https://athlexapp.eu', null, undefined, '']) {
      expect(returnOrigin(o)).toBe(SITE_URL);
    }
  });

  it('preview : l’adresse du déploiement qui répond, ou son alias de branche', () => {
    process.env.VERCEL_URL = PREVIEW;
    process.env.VERCEL_BRANCH_URL = BRANCH;
    expect(returnOrigin(`https://${PREVIEW}`)).toBe(`https://${PREVIEW}`);
    expect(returnOrigin(`https://${BRANCH}`)).toBe(`https://${BRANCH}`);
  });

  it('refuse toute autre origine : autre projet Vercel, imitation, http, sous-chemin', () => {
    process.env.VERCEL_URL = PREVIEW;
    for (const o of [
      'https://the-evil-nabilselmane-4786s-projects.vercel.app',
      'https://attaquant.vercel.app',
      `http://${PREVIEW}`,
      `https://${PREVIEW}.evil.com`,
      `https://${PREVIEW}/box`,
      'https://evil.com',
    ]) {
      expect(returnOrigin(o)).toBe(SITE_URL);
    }
  });

  it('hors Vercel (local, tests) : le site public', () => {
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_BRANCH_URL;
    expect(returnOrigin('http://localhost:3000')).toBe(SITE_URL);
  });
});
