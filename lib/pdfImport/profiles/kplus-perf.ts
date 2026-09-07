import type { DayPage, PdfPage, RawSection, SourceProfile } from '../types';
import { stripAccents, stripEmojis, toLines } from '../text';

/**
 * Profil K+ Perf (§2, §6, §10 de la spec). Tout ce qui est propre à ce coach
 * vit ici : header de jour, 🎯 de section, DELOAD parasite, marqueurs 🟣🔴🥇,
 * ordre des charges F/H, typos récurrentes.
 */

const DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
/** `LUNDI |`, `lundi`, `SAMEDI` seuls sur leur ligne. */
const DAY_HEADER_RE = new RegExp(`^\\s*(${DAY_NAMES.join('|')})\\s*(?:\\||$)`, 'i');
/** Bandeau collé au début d'une ligne utile : `vendredi🎯 HALTERO`, `DELOAD🎯 GYM`. */
const DAY_PREFIX_RE = new RegExp(`^\\s*(?:DELOAD\\s*)?(?:${DAY_NAMES.join('|')})?\\s*(?=🎯)`, 'iu');
const SECTION_RE = /^\s*🎯\s*(.+)$/u;
const SUBBLOCK_RE = /^\s*(\d{1,2})\s*[).]\s*(.+)$/;
const HALTERO_RE = /\b(snatch|clean|jerk|pull|balance|arraché|epaule)\b/i;
const PARASITE = 'DPRDELOEPOLFROAIOLPADFRCDIOLSFCILB&CC';
/** Sections que ce coach écrit parfois sans 🎯 (`RENFO 💪 (Si temps et énergie)`). */
const BARE_SECTION_RE = /^\s*(HALTERO|GYM|RENFO|METCON|SQUAT X PAG|FRONT SQUAT|DEADLIFT X PAG|BENCH X PAG|ZONE 2|MOBILIT[ÉE]|RUN|WOD TEAM|MIXT WORK|STRONG|CHILL DAY|P3 CORE)\b/i;

function dayOf(line: string): number | null {
  const m = stripAccents(line).match(DAY_HEADER_RE);
  if (!m) return null;
  return DAY_NAMES.indexOf(m[1].toLowerCase());
}

/** Jour glissé en préfixe d'une ligne de section (`vendredi🎯 …`). */
function dayPrefix(line: string): number | null {
  const m = stripAccents(line).match(new RegExp(`^\\s*(?:DELOAD\\s*)?(${DAY_NAMES.join('|')})\\s*🎯`, 'iu'));
  return m ? DAY_NAMES.indexOf(m[1].toLowerCase()) : null;
}

/** Une ligne de section sans 🎯 : mot-clé connu, puis seulement emojis / parenthèses / `OU …`. */
function bareSectionTitle(line: string): string | null {
  if (/^\s*[-•·*]/.test(line) || SUBBLOCK_RE.test(line)) return null;
  const clean = stripEmojis(line).replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  const m = clean.match(BARE_SECTION_RE);
  if (!m) return null;
  const rest = clean.slice(m[0].length).trim();
  if (rest && !/^OU\b/i.test(rest)) return null;
  return stripEmojis(line).replace(/\s+/g, ' ').trim();
}

function isIntroPage(lines: string[]): boolean {
  return !lines.some(l => dayOf(l) != null || dayPrefix(l) != null || SECTION_RE.test(l) || SUBBLOCK_RE.test(l));
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
    if (/K\+\s*PERF|KPLUS\s*PERF|K PLUS PERF|P E R F O R M A N C E|PROFILS? [BC]/i.test(all)) score += 0.3;
    if (/🎯/u.test(all)) score += 0.25;
    if (all.includes(PARASITE) || /\bDELOAD\b/.test(all)) score += 0.15;
    const dayHeaders = pages.filter(p => toLines(p.text).some(l => dayOf(l) != null || dayPrefix(l) != null)).length;
    if (dayHeaders >= 3) score += 0.2;
    if (/🟣|🔴|🥇/u.test(all)) score += 0.1;
    return Math.min(1, score);
  },

  splitDays(pages: PdfPage[]): DayPage[] {
    const out: DayPage[] = [];
    let lastDay = -1;
    for (const page of pages) {
      const lines = toLines(page.text);
      if (isIntroPage(lines)) continue;
      // Bandeau `LUNDI |` (haut ou bas de page), sinon jour collé à un 🎯, sinon page suivante = jour suivant.
      const marker = lines.map(dayOf).find(d => d != null) ?? lines.map(dayPrefix).find(d => d != null);
      const day = marker ?? lastDay + 1;
      if (day > 6) continue;
      const body = lines
        .filter(l => dayOf(l) == null)
        .map(l => l.replace(DAY_PREFIX_RE, ''));
      const prev = out.find(d => d.day === day);
      if (prev) { prev.lines.push(...body); continue; }
      lastDay = day;
      out.push({ day, pageIndex: page.index, lines: body });
    }
    return out;
  },

  splitSections(day: DayPage): RawSection[] {
    const sections: RawSection[] = [];
    let cur: RawSection | null = null;
    const orphan: string[] = [];

    for (const line of day.lines) {
      const sec = line.match(SECTION_RE);
      const title = sec ? stripEmojis(sec[1]) : bareSectionTitle(line);
      if (title) {
        if (cur) sections.push(cur);
        cur = { title, lines: [], day: day.day, pageIndex: day.pageIndex };
        continue;
      }
      if (cur) cur.lines.push(line);
      else orphan.push(line);
    }
    if (cur) sections.push(cur);

    // Avant le premier 🎯 : sous-blocs `1)` → section implicite (HALTERO le lundi S37, §2.2) ;
    // simple texte (citation, « OFF SAISON ») → préambule de la première section.
    const meaningful = orphan.filter(l => !/^\s*(page\s*)?\d+\s*$/i.test(l) && l.trim());
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
    } else if (meaningful.length && sections.length) {
      sections[0].preamble = meaningful;
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
    /^\s*PROFILS?\s+[BC].*$/i,
    /^\s*puis,?\s*$/i,
    new RegExp(`^\\s*(${DAY_NAMES.join('|')})\\s*\\|\\s*`, 'i'),
  ],

  warmupMarkers: ['WARM-UPS', 'WARM UPS', 'WARM-UP', 'WARMUP', 'Échauffement', 'Echauffement'],

  weekNotes(pages) {
    const first = pages[0];
    if (!first) return null;
    const raw = toLines(first.text);
    if (!isIntroPage(raw)) return null;
    const lines = raw.filter(l => !l.includes(PARASITE) && !/^\s*\d+\s*$/.test(l) && !/^P( [A-Z])+$/.test(l.trim()));
    const text = lines.join('\n').trim();
    return text || null;
  },
};
