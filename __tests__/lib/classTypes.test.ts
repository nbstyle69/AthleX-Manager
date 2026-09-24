// Sous Jest, `react` est un shim (__mocks__/react-shim.js) qui ne porte que
// `cache` : ce fichier rend un composant, il lui faut le vrai React.
jest.mock('react', () => jest.requireActual(require('path').join(process.cwd(), 'node_modules', 'react', 'index.js')));

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CLASS_TYPES, classTypeFormFromTitle, classTypeTitleToSave, normalizeClassType,
} from '@/lib/classTypes';
import ClassTypeField from '@/components/ClassTypeField';

// ts-jest compile le JSX en `React.createElement` (runtime classique).
(globalThis as unknown as { React: typeof React }).React = React;

describe('normalizeClassType', () => {
  it('ramène l’ancienne orthographe du panneau à la valeur canonique', () => {
    expect(normalizeClassType('Halterophilie')).toBe('Haltérophilie');
  });
  it('laisse la valeur canonique inchangée', () => {
    expect(normalizeClassType('Haltérophilie')).toBe('Haltérophilie');
  });
  it('laisse une valeur hors liste inchangée', () => {
    expect(normalizeClassType('Yoga du dimanche')).toBe('Yoga du dimanche');
  });
  it('laisse la chaîne vide inchangée', () => {
    expect(normalizeClassType('')).toBe('');
  });
});

describe('CLASS_TYPES', () => {
  it('porte une seule orthographe d’Haltérophilie, accentuée', () => {
    expect(CLASS_TYPES).toContain('Haltérophilie');
    expect(CLASS_TYPES).not.toContain('Halterophilie');
  });
});

describe('classTypeFormFromTitle', () => {
  it('ouvre un créneau à l’ancienne orthographe sur le bon type', () => {
    expect(classTypeFormFromTitle('Halterophilie')).toEqual({ title: 'Haltérophilie', customTitle: '' });
  });
  it('ouvre une valeur hors liste en « Autre » avec le nom réel', () => {
    expect(classTypeFormFromTitle('Yoga du dimanche')).toEqual({ title: 'Autre', customTitle: 'Yoga du dimanche' });
  });
  it('ouvre un titre enregistré « Autre » en « Autre »', () => {
    expect(classTypeFormFromTitle('Autre')).toEqual({ title: 'Autre', customTitle: 'Autre' });
  });
  it('ouvre une chaîne vide en « Autre » sans nom', () => {
    expect(classTypeFormFromTitle('')).toEqual({ title: 'Autre', customTitle: '' });
  });
});

describe('classTypeTitleToSave', () => {
  it('enregistre le type choisi', () => {
    expect(classTypeTitleToSave({ title: 'Haltérophilie', customTitle: '' })).toBe('Haltérophilie');
  });
  it('conserve tel quel le nom réel d’une valeur hors liste', () => {
    const form = classTypeFormFromTitle(' Yoga  du dimanche ');
    expect(classTypeTitleToSave(form)).toBe(' Yoga  du dimanche ');
  });
  it('garde « Autre » quand aucun nom n’est saisi', () => {
    expect(classTypeTitleToSave({ title: 'Autre', customTitle: '  ' })).toBe('Autre');
  });
  it('réécrit l’ancienne orthographe à l’enregistrement seulement', () => {
    expect(classTypeTitleToSave(classTypeFormFromTitle('Halterophilie'))).toBe('Haltérophilie');
  });
});

describe('ClassTypeField', () => {
  const render = (title: string) => {
    const form = classTypeFormFromTitle(title);
    return renderToStaticMarkup(React.createElement(ClassTypeField, {
      ...form, onTitleChange: () => {}, onCustomTitleChange: () => {}, labelClassName: '', selectClassName: '',
    }));
  };
  const selected = (html: string) => html.match(/<option[^>]*selected=""[^>]*>([^<]*)<\/option>/)?.[1];

  it('affiche « Autre » et le nom réel pour une valeur hors liste, jamais « WOD »', () => {
    const html = render('Yoga du dimanche');
    expect(selected(html)).toBe('Autre');
    expect(html).toContain('value="Yoga du dimanche"');
  });
  it('affiche le bon type pour l’ancienne orthographe, sans champ de nom', () => {
    const html = render('Halterophilie');
    expect(selected(html)).toBe('Haltérophilie');
    expect(html).not.toContain('Nom personnalisé');
  });
});
