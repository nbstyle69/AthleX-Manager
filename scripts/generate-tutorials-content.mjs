#!/usr/bin/env node
/**
 * Génère `lib/tutorials/content.generated.ts` depuis `content/tutorials/{fr,en}`.
 *
 * Le back-office est déployé en fonctions serverless : le dossier `content/`
 * n'y est pas garanti présent, donc le MDX est embarqué dans le bundle au build
 * plutôt que lu sur le disque à la requête. Lancé par `prebuild` et par
 * `npm run gen:tutorials`, vérifié par les tests.
 */
import fs from 'fs';
import path from 'path';
import url from 'url';

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'tutorials');
const OUT = path.join(ROOT, 'lib', 'tutorials', 'content.generated.ts');
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

export function render(byLocale) {
  const body = LOCALES.map((locale) => {
    const entries = Object.entries(byLocale[locale])
      .map(([slug, raw]) => `    ${JSON.stringify(slug)}: ${JSON.stringify(raw)},`)
      .join('\n');
    return `  ${locale}: {\n${entries}\n  },`;
  }).join('\n');

  return `// Fichier généré par scripts/generate-tutorials-content.mjs — ne pas éditer à la main.
// Source : content/tutorials/{fr,en}/*.mdx ; régénérer avec \`npm run gen:tutorials\`.
import type { Locale } from './i18n';

export const RAW_TUTORIALS: Record<Locale, Record<string, string>> = {
${body}
};
`;
}

if (import.meta.url === url.pathToFileURL(process.argv[1] ?? '').href) {
  const byLocale = collect();
  const out = render(byLocale);
  const previous = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
  if (previous !== out) fs.writeFileSync(OUT, out);
  const total = LOCALES.reduce((n, l) => n + Object.keys(byLocale[l]).length, 0);
  console.log(`lib/tutorials/content.generated.ts : ${total} tutoriels embarqués.`);
}
