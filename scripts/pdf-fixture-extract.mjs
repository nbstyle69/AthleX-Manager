// Extrait le texte page par page d'un PDF de programmation (même chemin que la route
// /api/wods/import-pdf : pdf-parse) vers un JSON consommé par les tests jest, qui ne
// peuvent pas charger le worker pdf.js.
//   node scripts/pdf-fixture-extract.mjs __tests__/__fixtures__/kplus-perf/S37.pdf
import fs from 'node:fs';
import { PDFParse } from 'pdf-parse';

const [, , pdfPath] = process.argv;
if (!pdfPath) {
  console.error('usage: node scripts/pdf-fixture-extract.mjs <fichier.pdf>');
  process.exit(1);
}

const parser = new PDFParse({ data: fs.readFileSync(pdfPath) });
const text = await parser.getText();
await parser.destroy();

const pages = text.pages.map(p => ({ index: p.num, text: p.text }));
const out = pdfPath.replace(/\.pdf$/i, '.pages.json');
fs.writeFileSync(out, JSON.stringify(pages, null, 2) + '\n');
console.log(`${pages.length} pages → ${out}`);
