import type { DayPage, PdfPage, RawSection, SourceProfile } from '../types';
import { stripAccents, stripEmojis, toLines } from '../text';

/**
 * Profil K+ Perf (§2, §6, §10 de la spec). Tout ce qui est propre à ce coach
 * vit ici : header de jour, 🎯 de section, DELOAD parasite, marqueurs 🟣🔴🥇,
 * ordre des charges F/H, typos récurrentes.
 */

const DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const DAY_HEADER_RE = new RegExp(`^\\s*(${DAY_NAMES.join('|')})\\s*(?:\\||$)`, 'i');
const SECTION_RE = /^\s*🎯\s*(.+)$/u;
const SUBBLOCK_RE = /^\s*(\d{1,2})\s*[).]\s*(.+)$/;
const HALTERO_RE = /\b(snatch|clean|jerk|pull|balance|arraché|epaule)\b/i;
const PARASITE = 'DPRDELOEPOLFROAIOLPADFRCDIOLSFCILB&CC';

function dayOf(line: string): number | null {
  const m = stripAccents(line).match(DAY_HEADER_RE);
  if (!m) return null;
  return DAY_NAMES.indexOf(m[1].toLowerCase());
}

export const kplusPerf: SourceProfile = {
  slug: 'kplus-perf',
  label: 'K+ Perf',
  defaultGroups: ['K+ Perf'],
  chargeOrder: 'FH',
  levelMarkers: { open: '🟣', pro: '🔴', elite: '🥇' },

  detect(pages) {
    const all = pages.map(p => p.text).join('\n');
    let score = 0;
    if (/K\+\s*PERF|KPLUS\s*PERF|K PLUS PERF/i.test(all)) score += 0.5;
    if (/🎯/u.test(all)) score += 0.2;
    if (all.includes(PARASITE) || /\bDELOAD\b/.test(all)) score += 0.15;
    const dayHeaders = pages.filter(p => toLines(p.text).some(l => dayOf(l) != null)).length;
    if (dayHeaders >= 3) score += 0.15;
    if (/🟣|🔴|🥇/u.test(all)) score += 0.1;
    return Math.min(1, score);
  },

  splitDays(pages: PdfPage[]): DayPage[] {
    const out: DayPage[] = [];
    let lastDay = -1;
    for (const page of pages) {
      const lines = toLines(page.text);
      const header = lines.find(l => dayOf(l) != null);
      if (!header) continue;
      const day = dayOf(header)!;
      if (day <= lastDay && out.length) {
        // Même jour sur deux pages : on complète la première.
        const prev = out.find(d => d.day === day);
        if (prev) { prev.lines.push(...lines.filter(l => dayOf(l) == null)); continue; }
      }
      lastDay = day;
      out.push({ day, pageIndex: page.index, lines: lines.filter(l => dayOf(l) == null) });
    }
    return out;
  },

  splitSections(day: DayPage): RawSection[] {
    const sections: RawSection[] = [];
    let cur: RawSection | null = null;
    const orphan: string[] = [];

    for (const line of day.lines) {
      const sec = line.match(SECTION_RE);
      if (sec) {
        if (cur) sections.push(cur);
        cur = { title: stripEmojis(sec[1]), lines: [], day: day.day, pageIndex: day.pageIndex };
        continue;
      }
      if (cur) cur.lines.push(line);
      else orphan.push(line);
    }
    if (cur) sections.push(cur);

    // Section implicite : sous-blocs `1)` avant tout 🎯 (cas lundi S37).
    const meaningful = orphan.filter(l => !/^\s*(page\s*)?\d+\s*$/i.test(l));
    if (meaningful.some(l => SUBBLOCK_RE.test(l) || /^[-•]/.test(l))) {
      const isHaltero = meaningful.some(l => HALTERO_RE.test(l));
      const firstSub = meaningful.find(l => SUBBLOCK_RE.test(l))?.match(SUBBLOCK_RE)?.[2] ?? 'RENFO';
      sections.unshift({
        title: isHaltero ? 'HALTERO' : stripEmojis(firstSub),
        lines: meaningful,
        day: day.day,
        pageIndex: day.pageIndex,
        blockHint: isHaltero ? 'skill-haltero' : 'post-wod',
      });
    }
    return sections.filter(s => s.lines.length > 0);
  },

  sectionToBlock: {
    'HALTERO': 'skill-haltero',
    'SQUAT X PAG': 'skill-haltero',
    'FRONT SQUAT': 'skill-haltero',
    'DEADLIFT X PAG': 'skill-haltero',
    'BENCH X PAG': 'skill-haltero',
    'PAG': 'skill-haltero',
    'GYM': 'skill-gym',
    'GYM HIGH SKILL': 'skill-gym',
    'SKILL': 'skill-gym',
    'STRONGMAN X GYM': 'skill-gym',
    'METCON': 'wod',
    'WOD TEAM': 'wod',
    'MIXT WORK': 'wod',
    'STRONG': 'wod',
    'RENFO': 'post-wod',
    'P3 CORE': 'post-wod',
    'ZONE 2': 'post-wod',
    'MOBILITÉ': 'post-wod',
    'MOBILITE': 'post-wod',
    'CHILL DAY': 'post-wod',
    'RUN': 'post-wod',
  },

  synonyms: {
    'tirage bucherons': 'Tirage bûcherons',
    'tirage bûcherons': 'Tirage bûcherons',
    'snatch high pull': 'Snatch High Pull',
    'clean pull': 'Clean Pull',
    'snatch pull': 'Snatch Pull',
    'squat snatch': 'Squat Snatch',
    'power snatch': 'Power Snatch',
    'squat clean': 'Squat Clean',
    'power clean': 'Power Clean',
    'push jerk': 'Push Jerk',
    'split jerk': 'Split Jerk',
    'ww': 'Wall Walk',
    'wall walk': 'Wall Walk',
    'ubk t2b': 'Toes-to-Bar',
    'strict hspu': 'Handstand Push-ups',
    'kipping hspu': 'Handstand Push-ups',
    'strict pull-ups': 'Pull-ups',
    'strict pull ups': 'Pull-ups',
    'strict chin-ups': 'Chin-ups',
    'strict chin ups': 'Chin-ups',
  },

  typoFixes: {
    'HATLERO': 'HALTERO',
    'WAMR-UPS': 'WARM-UPS',
    'WAMR UPS': 'WARM-UPS',
    'AMQAP': 'AMRAP',
    'SPlit': 'Split',
    'Spleet': 'Split',
    'Gobelet': 'Goblet',
    'recéption': 'réception',
    'bra tendu': 'bras tendu',
    'No hipe': 'No hip',
    'tete': 'tête',
    'meme': 'même',
    'depart': 'départ',
    'bucherons': 'bûcherons',
    'reserve': 'réserve',
    'a la meme charges': 'à la même charge',
    'a la même charges': 'à la même charge',
  },

  artefacts: [
    new RegExp(PARASITE.replace(/[&]/g, '\\&'), 'g'),
    /^\s*DELOAD\s*$/i,
    /^\s*(?:page\s*)?\d{1,2}\s*(?:\/\s*\d{1,2})?\s*$/i,
    new RegExp(`^\\s*(${DAY_NAMES.join('|')})\\s*\\|\\s*`, 'i'),
  ],

  warmupMarkers: ['WARM-UPS', 'WARM UPS', 'WARM-UP', 'WARMUP', 'Échauffement', 'Echauffement'],

  weekNotes(pages) {
    const first = pages[0];
    if (!first) return null;
    const lines = toLines(first.text).filter(l => !l.includes(PARASITE) && dayOf(l) == null && !/^\s*\d+\s*$/.test(l));
    const text = lines.join('\n').trim();
    return text || null;
  },
};
