import type { WodType } from '@/lib/wodFields';
import type {
  BlockName, DayPage, ImportEntry, ImportResult, ImportWarning, LevelMarkers,
  ParsedMovement, ParsedStrength, PdfPage, RawSection, SourceProfile,
} from './types';
import { detectFormat, timecapOf, type FormatDetection } from './formats';
import { looksLikeMovementLine, parseMovementLine } from './movements';
import { parseStrengthLine } from './strength';
import { serializeImportStrength } from './serialize';
import { applyTypoFixes, normKey, normalizeQuotes, removeArtefacts, stripEmojis, toLines } from './text';

/**
 * Cœur générique de l'importateur (§3–§8, §11). Ne connaît aucun coach : il
 * reçoit des pages déjà découpées en jours puis en sections par le profil et
 * rend des entrées prêtes pour la preview.
 */

const HALTERO_WORDS = /\b(snatch|clean|jerk|pull|balance|haltero|arraché|épaulé|epaule|arrache)\b/i;
const SUBBLOCK_RE = /^\s*(?:(\d{1,2})|([A-H]))\s*[).:-]\s*(.*)$/;
const SUBBLOCK_STRICT_RE = /^\s*(?:(\d{1,2})|([A-H]))\s*\)\s*(.*)$/;
const QUOTE_RE = /^[«"“].+[»"”]\s*(?:[—-]\s*.+)?$/;
const ADVICE_RE = /^(\*|⚠️|attention|focus|règles? simples?|regles? simples?|note ?:)/i;
const OPTION_RE = /^(ou,?\s|ou$|si temps|à faire dans la semaine|a faire dans la semaine|bi-quotidien|environ \d+)/i;
const FORMAT_HEADER_RE = /^(?:[A-Z0-9\s'":à×x()\/\-]|’)*\b(for\s*time|amrap|emom|e\d+(?:'\d{2})?mom|every|tabata|rounds?|death\s*by|tc|time\s*cap|on\s*\/|chipper)\b/i;
const WEEK_RE = /\bS(\d{1,2})\/(\d{1,2})\b|\bsemaine\s+(\d{1,2})\s*\/\s*(\d{1,2})/i;

export function normalizeSectionTitle(title: string): string {
  return stripEmojis(normalizeQuotes(title)).replace(/\s+/g, ' ').trim();
}

/** Block d'une section : table du profil, sinon mots-clés génériques, sinon `blockHint`. */
export function blockForTitle(title: string, profile: SourceProfile, hint?: BlockName | null): BlockName | null {
  const key = normalizeSectionTitle(title).toUpperCase();
  const table = Object.entries(profile.sectionToBlock).map(([k, v]) => [k.toUpperCase(), v] as const);
  const exact = table.find(([k]) => k === key);
  if (exact) return exact[1];
  const partial = table
    .filter(([k]) => key.startsWith(`${k} `) || key.includes(` ${k} `) || key.endsWith(` ${k}`))
    .sort((a, b) => b[0].length - a[0].length)[0];
  if (partial) return partial[1];
  if (/\b(METCON|WOD|MIXT|STRONG|AMRAP|FOR TIME|EMOM|CHIPPER)\b/i.test(key)) return 'wod';
  if (/\b(GYM|SKILL|GYMNASTI)/i.test(key)) return 'skill-gym';
  if (/\b(HALTERO|PAG|SQUAT|BENCH|DEADLIFT|FORCE|STRENGTH|WEIGHTLIFTING)\b/i.test(key)) return 'skill-haltero';
  if (/\b(RENFO|CORE|ZONE\s*2|MOBILIT|CHILL|RUN|ACCESSO|CARDIO|COOL)/i.test(key)) return 'post-wod';
  if (/\b(WARM|ÉCHAUFF|ECHAUFF|ACTIVATION)/i.test(key)) return 'pre-wod';
  return hint ?? null;
}

interface SubBlock { label: string | null; title: string; lines: string[] }

/** Découpe une section en sous-blocs `1)`/`A)` ; le préambule (avant le premier) porte `label = null`. */
export function splitSubBlocks(lines: string[]): SubBlock[] {
  const out: SubBlock[] = [];
  let cur: SubBlock = { label: null, title: '', lines: [] };
  for (const line of lines) {
    const m = line.match(SUBBLOCK_STRICT_RE) ?? line.match(SUBBLOCK_RE);
    if (m && (SUBBLOCK_STRICT_RE.test(line) || (!looksLikeMovementLine(line) && !/^\d+\s*[xX×]/.test(line)))) {
      if (cur.label !== null || cur.lines.length) out.push(cur);
      cur = { label: m[1] ?? m[2], title: m[3].trim(), lines: [] };
    } else {
      cur.lines.push(line);
    }
  }
  if (cur.label !== null || cur.lines.length) out.push(cur);
  return out;
}

function hasOwnTemporalFormat(sb: SubBlock): boolean {
  const t = `${sb.title}\n${sb.lines.join('\n')}`;
  return /\b(EMOM|E\d+(?:'\d{2})?MOM|AMRAP|every\s+\d|for\s*time|tabata|death\s*by)\b/i.test(t);
}

function isLevelLine(line: string, markers?: LevelMarkers): 'open' | 'pro' | 'elite' | null {
  if (!markers) return null;
  if (line.includes(markers.open)) return 'open';
  if (line.includes(markers.pro)) return 'pro';
  if (line.includes(markers.elite)) return 'elite';
  return null;
}

function isWarmupHeader(line: string, markers: string[]): boolean {
  const k = normKey(line);
  return markers.some(m => k.startsWith(normKey(m)));
}

const LEVEL_LABEL = { open: 'Open', pro: 'Pro', elite: 'Elite' } as const;

function formatLevelLines(lines: { level: 'open' | 'pro' | 'elite'; text: string }[], markers: LevelMarkers): string {
  const body = lines.map(l => {
    const text = l.text
      .replace(markers[l.level], '')
      .replace(/^\s*(?:open|pro|elite|rx|scaled|d[eé]butant|interm[eé]diaire|confirm[eé])?\s*[:\-–—]?\s*/i, '')
      .trim();
    return `${markers[l.level]} ${LEVEL_LABEL[l.level]} : ${text}`;
  });
  return `Barème :\n${body.join('\n')}`;
}

function formatWarmup(lines: string[]): string {
  const items = lines.map(l => l.replace(/^\s*[-•·*]\s*/, '').trim()).filter(Boolean);
  return `Échauffement : ${items.join(' — ')}`;
}

/** Titre §8. */
export function buildTitle(args: {
  section: string;
  block: BlockName | null;
  subTitle: string | null;
  movements: ParsedMovement[];
  musculation: ParsedStrength[];
  format: FormatDetection;
  formatLabel: string | null;
  bodyText: string;
  option: 'A' | 'B' | null;
}): string {
  const section = normalizeSectionTitle(args.section).replace(/\s*\(.*\)\s*$/, '').trim();
  const upper = section.toUpperCase();
  let title: string;

  if (/^CHILL/i.test(upper)) title = 'CHILL DAY 🛋️';
  else {
    let sub = args.subTitle?.trim() || null;
    if (!sub) {
      const names = uniq([
        ...args.movements.map(m => m.name),
        ...args.musculation.map(m => m.exercise),
      ]).filter(Boolean);
      if (names.length) sub = names.slice(0, 3).join(' & ');
    }
    if (sub && args.formatLabel && !sub.toLowerCase().includes(args.formatLabel.toLowerCase().split(' ')[0])) {
      sub = `${sub} (${args.formatLabel})`;
    }
    title = sub ? `${upper} — ${sub}` : upper;
    if (/WOD TEAM/i.test(upper)) {
      const team = args.bodyText.match(/(?:équipe|equipe|team)\s+de\s+(\d+)|par\s+(\d+)|(\d+)\s*(?:athl[èe]tes|pers)/i);
      const n = team?.[1] ?? team?.[2] ?? team?.[3];
      if (n) title += ` (équipe de ${n})`;
    }
  }

  if (/m[ée]thode\s+g[ée]orgienne/i.test(args.bodyText)) title += ' (Méthode Géorgienne)';
  const w = args.bodyText.match(WEEK_RE);
  if (w) title += ` (Semaine ${w[1] ?? w[3]}/${w[2] ?? w[4]})`;
  if (args.option) title += ` · Option ${args.option}`;
  return title.replace(/\s+/g, ' ').trim();
}

function uniq<T>(xs: T[]): T[] { return Array.from(new Set(xs)); }

function formatLabel(text: string): string | null {
  const m = text.match(/\b(E\d+(?:'\d{2})?MOM\s*[x×]\s*\d+|EMOM\s*\d+'?|AMRAP\s*\d+(?:\s*à\s*\d+)?'?|every\s+\d+(?:'\d{2}?|")\s*[x×]\s*\d+|\d+\s*rounds?\s*for\s*time|for\s*time|tabata|death\s*by)/i);
  if (!m) return null;
  return m[1].replace(/\s*[x×]\s*/i, ' × ').replace(/\s+/g, ' ').trim();
}

function isStrengthEntry(block: BlockName | null, sectionTitle: string, lines: string[]): boolean {
  const t = normalizeSectionTitle(sectionTitle);
  if (block === 'skill-haltero' && !/haltero/i.test(t) && !HALTERO_WORDS.test(t)) return true;
  if (block === 'post-wod' && /renfo|p\d\s*core|accessoire/i.test(t)) {
    const mv = lines.filter(looksLikeMovementLine);
    const sets = mv.filter(l => /^\s*[-•·*]?\s*\d+(?:\s*à\s*\d+)?\s*[xX×]\s*\d+\s+\S/.test(normalizeQuotes(l)));
    return mv.length > 0 && sets.length >= Math.ceil(mv.length / 2);
  }
  return false;
}

interface EntryDraft {
  section: RawSection;
  subTitle: string | null;
  lines: string[];
  option: 'A' | 'B' | null;
  alternativeWith: string | null;
}

function draftsForSection(section: RawSection): EntryDraft[] {
  const rawTitle = normalizeSectionTitle(section.title);
  const alt = rawTitle.match(/^(.+?)\s+OU\s+(.+)$/i);
  const drafts: EntryDraft[] = [];

  const subs = splitSubBlocks(section.lines);
  const preamble = subs.find(s => s.label === null);
  const labelled = subs.filter(s => s.label !== null);

  const grouped: SubBlock[] = [];
  const separate: SubBlock[] = [];
  for (const sb of labelled) {
    if (hasOwnTemporalFormat(sb)) separate.push(sb);
    else if (/\b(PAG|X\s*PAG)\b/i.test(sb.title) && /haltero/i.test(rawTitle)) separate.push(sb);
    else grouped.push(sb);
  }

  const mainLines = [
    ...(preamble?.lines ?? []),
    ...grouped.flatMap(sb => [sb.title ? `${sb.label}) ${sb.title}` : '', ...sb.lines].filter(Boolean)),
  ];
  if (mainLines.length || labelled.length === 0) {
    const firstSub = grouped.length === 1 && grouped[0].title ? grouped[0].title : null;
    drafts.push({ section, subTitle: firstSub, lines: mainLines, option: null, alternativeWith: null });
  }
  for (const sb of separate) {
    drafts.push({
      section: { ...section, title: /\bPAG\b/i.test(sb.title) ? sb.title : section.title },
      subTitle: /\bPAG\b/i.test(sb.title) ? null : sb.title,
      lines: sb.lines,
      option: null,
      alternativeWith: null,
    });
  }

  if (alt) {
    // Une entrée par alternative, même corps : le coach ajuste en preview.
    return drafts.flatMap(d => [
      { ...d, section: { ...d.section, title: alt[1] }, option: 'A' as const, alternativeWith: alt[2] },
      { ...d, section: { ...d.section, title: alt[2] }, option: 'B' as const, alternativeWith: alt[1] },
    ]);
  }
  return drafts;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function buildEntry(draft: EntryDraft, profile: SourceProfile, weekStart: string, order: number): ImportEntry | null {
  const { section, lines } = draft;
  const warnings = new Set<ImportWarning>();
  const block = blockForTitle(section.title, profile, section.blockHint ?? null);
  if (!block) warnings.add('enum-fallback');

  const bodyText = [draft.subTitle ?? '', ...lines].join('\n');
  const format = detectFormat(bodyText);
  format.warnings.forEach(w => warnings.add(w));

  const strengthMode = isStrengthEntry(block, section.title, lines);
  const movements: ParsedMovement[] = [];
  const musculation: ParsedStrength[] = [];
  const warmup: string[] = [];
  const levelLines: { level: 'open' | 'pro' | 'elite'; text: string }[] = [];
  const advice: string[] = [];
  const options: string[] = [];
  const paragraphs: string[] = [];
  let chargeAmbiguous = false;
  let inWarmup = false;
  let lastExercise = '';

  const explicitLevel = section.levelLines ?? [];
  for (const raw of [...lines]) {
    const line = normalizeQuotes(raw).trim();
    if (!line) continue;

    if (isWarmupHeader(line, profile.warmupMarkers)) { inWarmup = true; continue; }
    const lvl = isLevelLine(line, profile.levelMarkers);
    if (lvl || explicitLevel.includes(raw)) {
      levelLines.push({ level: lvl ?? 'open', text: line });
      continue;
    }
    if (inWarmup) {
      // L'échauffement s'arrête à la première ligne de travail (séries × reps, `@`, `%`, RPE)
      const isWork = /^\s*[-•·*]?\s*\d+(?:\s*à\s*\d+)?\s*[xX×]\s*\d+\s+\S/.test(line) || /[@%]|\bRPE\b/i.test(line);
      if (!isWork && (looksLikeMovementLine(line) || /^[-•·*]/.test(line))) { warmup.push(line); continue; }
      inWarmup = false;
    }
    if (/(rest|repos)\b/i.test(line) && /^\d+(?:'\d{0,2}|")/.test(line)) continue; // repos → format.rests
    if (format.matched && !looksLikeMovementLine(line) && line.length <= 60 && FORMAT_HEADER_RE.test(line)) continue;
    if (QUOTE_RE.test(line) || ADVICE_RE.test(line)) { advice.push(line); continue; }
    if (OPTION_RE.test(line)) { options.push(line); continue; }

    if (looksLikeMovementLine(line)) {
      if (strengthMode) {
        const s = parseStrengthLine(line, { synonyms: profile.synonyms, typoFixes: profile.typoFixes, defaultSets: format.rounds });
        if (s) {
          if (!s.exercise && lastExercise) s.exercise = lastExercise;
          if (s.exercise) lastExercise = s.exercise;
          musculation.push(s);
          continue;
        }
      }
      const mv = parseMovementLine(line, { chargeOrder: profile.chargeOrder, synonyms: profile.synonyms, typoFixes: profile.typoFixes });
      if (mv) {
        if (mv.chargeAmbiguous) chargeAmbiguous = true;
        movements.push(mv.movement);
        continue;
      }
    }
    if (/^[-•·*]/.test(line)) { paragraphs.push(line.replace(/^[-•·*]\s*/, '')); continue; }
    if (SUBBLOCK_STRICT_RE.test(line)) continue;
    if (!SUBBLOCK_RE.test(line) || looksLikeMovementLine(line)) paragraphs.push(line);
  }

  const empty = movements.length === 0 && musculation.length === 0 && paragraphs.length === 0
    && advice.length === 0 && warmup.length === 0 && options.length === 0 && !draft.subTitle;
  if (empty) return null;

  if (movements.some(m => !m.resolved) || musculation.some(m => !m.resolved)) warnings.add('movement-unresolved');
  if (movements.some(m => m.reps === 'selon niveau') && levelLines.length === 0) warnings.add('level-scale-missing');
  if (chargeAmbiguous) warnings.add('charge-order-ambiguous');
  if (serializeImportStrength(musculation).unstructured.length > 0) warnings.add('strength-unstructured');
  if (profile.slug === 'generic') warnings.add('generic-profile');
  if (/\b(TC|time\s*cap|cap\s+à)\b/i.test(bodyText) && format.timecapSec == null) warnings.add('timecap-unparsed');

  let type: WodType | null = format.type;
  if (type == null && !format.matched) type = block === 'skill-haltero' ? 'strength' : null;
  if (type == null && format.matched && block === 'skill-haltero') type = 'strength';
  if (type == null && musculation.length > 0 && !format.matched) type = 'strength';
  if (type == null && format.matched) type = 'custom';

  const rank = block === 'wod' && format.scored && !(advice.length > 0 && movements.length === 0);

  const notes: string[] = [];
  if (draft.alternativeWith) notes.push(`Au choix avec ${normalizeSectionTitle(draft.alternativeWith)}`);
  if (advice.length) notes.push(uniq(advice).join('\n'));
  if (format.intervalNote) notes.push(format.intervalNote);
  if (warmup.length) notes.push(formatWarmup(warmup));
  if (levelLines.length && profile.levelMarkers) notes.push(formatLevelLines(levelLines, profile.levelMarkers));
  if (format.rests.length) notes.push(`Repos : ${format.rests.join(', ')}`);
  if (paragraphs.length) notes.push(uniq(paragraphs).join('\n'));
  if (options.length) notes.push(uniq(options).join('\n'));
  if (block === null) notes.push(`Section « ${normalizeSectionTitle(section.title)} » : block non reconnu, à choisir.`);

  const label = formatLabel(bodyText);
  const title = buildTitle({
    section: section.title,
    block, subTitle: draft.subTitle, movements, musculation, format, formatLabel: label, bodyText, option: draft.option,
  });

  return {
    key: `${section.pageIndex}-${order}-${draft.option ?? ''}`,
    date: addDays(weekStart, section.day),
    order,
    block,
    type,
    title,
    movements,
    musculation,
    timecap: timecapOf(format),
    rounds: format.rounds,
    emom_interval_minutes: type === 'emom' ? format.emomIntervalMin : null,
    tabata_work_seconds: format.tabataWorkSec,
    tabata_rest_seconds: format.tabataRestSec,
    notes_coach: notes.join('\n\n'),
    video_url: null,
    groups: [...profile.defaultGroups],
    programs: [],
    published: true,
    rank,
    source_profile: profile.slug,
    source_page: section.pageIndex,
    warnings: Array.from(warnings),
  };
}

/** Applique typos + artefacts du profil aux pages (les notes de semaine lisent les pages brutes). */
export function cleanPages(pages: PdfPage[], profile: SourceProfile): PdfPage[] {
  return pages.map(p => ({ index: p.index, text: applyTypoFixes(normalizeQuotes(p.text), profile.typoFixes) }));
}

export function cleanDay(day: DayPage, profile: SourceProfile): DayPage {
  return { ...day, lines: removeArtefacts(day.lines, profile.artefacts) };
}

export function parseDocument(
  pages: PdfPage[],
  profile: SourceProfile,
  weekStart: string,
  detectedScores: Record<string, number> = {},
  days?: DayPage[],
): ImportResult {
  const cleaned = cleanPages(pages, profile);
  const dayPages = (days ?? profile.splitDays(cleaned)).map(d => cleanDay(d, profile));
  const entries: ImportEntry[] = [];
  for (const day of dayPages) {
    let order = 1;
    for (const section of profile.splitSections(day)) {
      for (const draft of draftsForSection(section)) {
        const entry = buildEntry(draft, profile, weekStart, order);
        if (entry) { entries.push(entry); order += 1; }
      }
    }
  }
  const unresolved = uniq([
    ...entries.flatMap(e => e.movements.filter(m => !m.resolved).map(m => m.name)),
    ...entries.flatMap(e => e.musculation.filter(m => !m.resolved).map(m => m.exercise)),
  ]).filter(Boolean).sort((a, b) => a.localeCompare(b, 'fr'));

  return {
    week_start: weekStart,
    source_profile: profile.slug,
    detected_scores: detectedScores,
    week_notes: profile.weekNotes?.(pages) ?? null,
    programs: [],
    entries,
    unresolved_movements: unresolved,
  };
}

export { toLines };
