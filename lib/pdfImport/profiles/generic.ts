import type { BlockName, DayPage, PdfPage, RawSection, SourceProfile } from '../types';
import { stripEmojis, toLines } from '../text';

/**
 * Profil `generic` (§16.4) : source inconnue. Le découpage jours/sections est
 * délégué à Claude Haiku (une passe par page, JSON strict, température 0) ;
 * le résultat entre dans le même cœur. Le LLM ne produit jamais une entrée WOD.
 *
 * `splitDays` / `splitSections` ci-dessous sont des replis sans LLM (jour par
 * position de page, une section par page) ; la route API remplace le
 * découpage par `llmSplit` quand la clé Anthropic est disponible.
 */

export interface LlmSection {
  title: string;
  block_hint: BlockName | null;
  level_lines: string[];
  lines: string[];
}

export interface LlmDay {
  /** 0 = lundi … 6 = dimanche ; null si la page n'est pas une journée. */
  day: number | null;
  sections: LlmSection[];
}

export const GENERIC_SYSTEM_PROMPT = `Tu découpes une page de programmation sportive (CrossFit / haltérophilie / renfo) en jours et sections.
Réponds UNIQUEMENT par un JSON strict de la forme :
{ "day": 0-6 ou null, "sections": [ { "title": string, "block_hint": "skill-gym"|"skill-haltero"|"wod"|"pre-wod"|"post-wod"|null, "level_lines": string[], "lines": string[] } ] }
Règles :
- "day" : 0 = lundi, 6 = dimanche, d'après le texte de la page ; null si la page n'est pas une journée (intro, citation, sommaire).
- Une section = un bloc de séance (échauffement, haltéro, gym, metcon, renfo, cardio…). Recopie les lignes TELLES QUELLES dans "lines", sans reformuler ni traduire ni fusionner ; une ligne d'exercice commence par "- ".
- "level_lines" : lignes qui décrivent un barème de niveau (RX / Scaled, Open / Pro / Elite, débutant / confirmé…), recopiées telles quelles et retirées de "lines".
- "block_hint" : skill-haltero (haltérophilie, force, squat, bench, deadlift), skill-gym (gymnastique, skill), wod (metcon, for time, amrap, team), pre-wod (échauffement), post-wod (renfo, core, mobilité, zone 2, run, accessoire) ; null si indécidable.
- N'invente rien : si la page ne contient aucune séance, "sections": [].`;

export function llmDayToDayPage(page: PdfPage, day: LlmDay): DayPage | null {
  if (day.day == null) return null;
  return {
    day: day.day,
    pageIndex: page.index,
    lines: day.sections.flatMap(s => [
      `## ${s.title}${s.block_hint ? ` ||${s.block_hint}` : ''}`,
      ...s.level_lines.map(l => `## level ${l}`),
      ...s.lines,
    ]),
  };
}

const BLOCKS: BlockName[] = ['skill-gym', 'skill-haltero', 'wod', 'pre-wod', 'post-wod'];
const SECTION_MARK = /^## (?!level )(.+?)(?:\s*\|\|([a-z-]+))?$/;
const LEVEL_MARK = /^## level (.+)$/;

export const generic: SourceProfile = {
  slug: 'generic',
  label: 'Source non reconnue (générique)',
  defaultGroups: [],
  chargeOrder: 'unknown',
  sectionToBlock: {},
  synonyms: {},
  typoFixes: {},
  artefacts: [/^\s*(?:page\s*)?\d{1,2}\s*(?:\/\s*\d{1,2})?\s*$/i],
  warmupMarkers: ['WARM-UP', 'WARM UP', 'WARMUP', 'Échauffement', 'Echauffement'],

  detect() { return 0; },

  splitDays(pages: PdfPage[]): DayPage[] {
    // Repli sans LLM : chaque page à partir de la 2e = un jour, dans l'ordre.
    const body = pages.length > 1 ? pages.slice(1) : pages;
    return body.slice(0, 7).map((p, i) => ({ day: i, pageIndex: p.index, lines: toLines(p.text) }));
  },

  splitSections(day: DayPage): RawSection[] {
    const sections: RawSection[] = [];
    let cur: RawSection | null = null;
    for (const line of day.lines) {
      const sec = line.match(SECTION_MARK);
      if (sec) {
        if (cur) sections.push(cur);
        const hint = BLOCKS.find(b => b === sec[2]) ?? null;
        cur = { title: stripEmojis(sec[1]), lines: [], levelLines: [], day: day.day, pageIndex: day.pageIndex, blockHint: hint };
        continue;
      }
      const lvl = line.match(LEVEL_MARK);
      if (!cur) cur = { title: 'SÉANCE', lines: [], levelLines: [], day: day.day, pageIndex: day.pageIndex };
      if (lvl) { cur.levelLines!.push(lvl[1]); cur.lines.push(lvl[1]); continue; }
      cur.lines.push(line);
    }
    if (cur) sections.push(cur);
    return sections.filter(s => s.lines.length > 0);
  },

  weekNotes(pages) {
    const first = pages[0];
    if (!first || pages.length < 2) return null;
    const text = toLines(first.text).join('\n').trim();
    return text.length > 0 && text.length < 1500 ? text : null;
  },
};
