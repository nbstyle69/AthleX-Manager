import fs from 'fs';
import path from 'path';
import type { ReactElement, ReactNode } from 'react';

// Le shim `react` de jest.config (pour `cache`) ne porte pas createElement : ici on rend un composant.
jest.mock('react', () => jest.requireActual('../../node_modules/react/index.js'));

import { ConfirmationNotice } from '../../app/rejoindre/[token]/ConfirmationNotice';
import { translations } from '../../lib/translations';

/**
 * Tunnel d'invitation : le compte est créé avec confirmation d'e-mail active,
 * et l'adhérent ouvrait l'app sans savoir qu'un mail l'attendait
 * (`email_not_confirmed` à la connexion, cas nbstylz+r2). La page doit le dire,
 * avec l'adresse, avant « télécharge l'app ».
 */
const j = translations.fr.funnel.join;

/** Texte visible d'un arbre d'éléments (sans DOM : le composant est une fonction pure). */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  const el = node as ReactElement<{ children?: ReactNode }>;
  return textOf(el.props?.children);
}

describe('/rejoindre — confirmation visible', () => {
  it('needsConfirmation: true → le message est rendu avec l’e-mail', () => {
    const text = textOf(ConfirmationNotice({ needsConfirmation: true, email: 'lea@example.com', j }));
    expect(text).toContain('lea@example.com');
    expect(text).toContain('Confirme ton adresse');
    expect(text).toContain('puis connecte-toi dans l');
  });

  it('needsConfirmation: false → rien n’est rendu', () => {
    expect(ConfirmationNotice({ needsConfirmation: false, email: 'lea@example.com', j })).toBeNull();
  });

  it('la page lit needsConfirmation de la route et place le message avant « télécharge l’app »', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'app/rejoindre/[token]/JoinInvitationClient.tsx'), 'utf8',
    );
    expect(src).toContain('needsConfirmation: !!json.needsConfirmation');
    const notice = src.indexOf('<ConfirmationNotice');
    const welcome = src.indexOf('j.welcomeStripe : j.welcomeBox');
    expect(notice).toBeGreaterThan(0);
    expect(notice).toBeLessThan(welcome);
  });

  it('EN traduit aussi', () => {
    expect(translations.en.funnel.join.confirmBefore).toContain('Confirm your address');
  });
});
