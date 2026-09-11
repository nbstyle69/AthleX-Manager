#!/usr/bin/env node
/**
 * Génère les modules dérivés de `content/tutorials/{fr,en}` :
 *
 * - `lib/tutorials/content.generated.ts` : MDX brut (frontmatter + corps) pour
 *   l'index, la recherche et les métadonnées, plus la liste des captures
 *   réellement présentes dans `public/tutorials`.
 * - `lib/tutorials/generated/{fr,en}/<slug>.tsx` : le MDX compilé en composants
 *   TSX, transpilés comme le reste de l'application. Passer par des sources du
 *   projet plutôt que par un chargeur webpack garantit un seul exemplaire de
 *   React côté serveur (sinon : « A React Element from an older version of
 *   React was rendered »).
 * - `lib/tutorials/components.generated.ts` : la table slug → composant.
 *
 * Le back-office est déployé en fonctions serverless : ni `content/` ni
 * `public/` n'y sont garantis présents, donc tout est résolu au build.
 * Lancé par `prebuild` et par `npm run gen:tutorials`, vérifié par les tests.
 */
import fs from 'fs';
import path from 'path';
import url from 'url';
import { compile } from '@mdx-js/mdx';
import remarkFrontmatter from 'remark-frontmatter';

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'tutorials');
const SCREENSHOT_DIR = path.join(ROOT, 'public', 'tutorials');
const OUT_CONTENT = path.join(ROOT, 'lib', 'tutorials', 'content.generated.ts');
const OUT_COMPONENTS = path.join(ROOT, 'lib', 'tutorials', 'components.generated.ts');
const OUT_TSX_DIR = path.join(ROOT, 'lib', 'tutorials', 'generated');
const LOCALES = ['fr', 'en'];

export function collect() {
  const byLocale = {};
  for (const locale of LOCALES) {
    const dir = path.join(CONTENT_DIR, locale);
    const files = fs.existsSync(dir)
      ? fs
          .readdirSync(dir)
          .filter((f) => f.endsWith('.mdx'))
          .sort()
      : [];
    byLocale[locale] = Object.fromEntries(
      files.map((f) => [f.replace(/\.mdx$/, ''), fs.readFileSync(path.join(dir, f), 'utf8')]),
    );
  }
  return byLocale;
}

/** Chemins publics des captures présentes sur le disque, ex. `/tutorials/creer-un-wod/1.png`. */
export function collectScreenshots(dir = SCREENSHOT_DIR, prefix = '/tutorials') {
  if (!fs.existsSync(dir)) return [];
  const found = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const asPath = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) found.push(...collectScreenshots(path.join(dir, entry.name), asPath));
    else found.push(asPath);
  }
  return found;
}

export function render(byLocale, screenshots) {
  const body = LOCALES.map((locale) => {
    const entries = Object.entries(byLocale[locale])
      .map(([slug, raw]) => `    ${JSON.stringify(slug)}: ${JSON.stringify(raw)},`)
      .join('\n');
    return `  ${locale}: {\n${entries}\n  },`;
  }).join('\n');

  const shots = screenshots.map((s) => `  ${JSON.stringify(s)},`).join('\n');

  return `// Fichier généré par scripts/generate-tutorials-content.mjs — ne pas éditer à la main.
// Source : content/tutorials/{fr,en}/*.mdx ; régénérer avec \`npm run gen:tutorials\`.
import type { Locale } from './i18n';

export const RAW_TUTORIALS: Record<Locale, Record<string, string>> = {
${body}
};

/** Captures livrées dans \`public/tutorials\` au moment du build. */
export const SCREENSHOTS: readonly string[] = [
${shots}
];
`;
}

/** Compile un MDX en source TSX autonome (frontmatter YAML retiré du corps). */
export async function compileTutorial(raw) {
  const compiled = await compile(raw, {
    remarkPlugins: [remarkFrontmatter],
    jsx: true,
    outputFormat: 'program',
    development: false,
  });

  return [
    '/* eslint-disable */',
    '// @ts-nocheck',
    '// Fichier généré par scripts/generate-tutorials-content.mjs — ne pas éditer à la main.',
    String(compiled),
  ].join('\n');
}

export function renderComponents(byLocale) {
  const imports = [];
  const maps = [];
  for (const locale of LOCALES) {
    const entries = Object.keys(byLocale[locale]).map((slug) => {
      const ident = `Mdx_${locale}_${slug.replace(/[^a-zA-Z0-9]/g, '_')}`;
      imports.push(`import ${ident} from './generated/${locale}/${slug}';`);
      return `    ${JSON.stringify(slug)}: ${ident},`;
    });
    maps.push(`  ${locale}: {\n${entries.join('\n')}\n  },`);
  }

  return `// Fichier généré par scripts/generate-tutorials-content.mjs — ne pas éditer à la main.
// Source : content/tutorials/{fr,en}/*.mdx ; régénérer avec \`npm run gen:tutorials\`.
import type { MDXComponents } from 'mdx/types';
import type { Locale } from './i18n';

${imports.join('\n')}

export type TutorialComponent = (props: { components?: MDXComponents }) => JSX.Element;

/** MDX compilé au build : aucun compilateur ni lecture disque à la requête. */
export const TUTORIAL_COMPONENTS: Record<Locale, Record<string, TutorialComponent>> = {
${maps.join('\n')}
};
`;
}

function writeIfChanged(file, out) {
  const previous = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (previous !== out) fs.writeFileSync(file, out);
}

/** Écrit les composants TSX et retire ceux dont le MDX source a disparu. */
export async function writeComponents(byLocale) {
  for (const locale of LOCALES) {
    const dir = path.join(OUT_TSX_DIR, locale);
    fs.mkdirSync(dir, { recursive: true });
    const expected = new Set(Object.keys(byLocale[locale]).map((slug) => `${slug}.tsx`));
    for (const file of fs.readdirSync(dir)) {
      if (!expected.has(file)) fs.rmSync(path.join(dir, file));
    }
    for (const [slug, raw] of Object.entries(byLocale[locale])) {
      writeIfChanged(path.join(dir, `${slug}.tsx`), await compileTutorial(raw));
    }
  }
}

if (import.meta.url === url.pathToFileURL(process.argv[1] ?? '').href) {
  const byLocale = collect();
  const screenshots = collectScreenshots();
  writeIfChanged(OUT_CONTENT, render(byLocale, screenshots));
  writeIfChanged(OUT_COMPONENTS, renderComponents(byLocale));
  await writeComponents(byLocale);
  const total = LOCALES.reduce((n, l) => n + Object.keys(byLocale[l]).length, 0);
  console.log(`lib/tutorials : ${total} tutoriels compilés, ${screenshots.length} captures référencées.`);
}
