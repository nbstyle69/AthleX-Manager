import type { WodType } from '@/lib/wodFields';
import type {
  BlockName, DayPage, ImportEntry, ImportResult, ImportWarning, LevelMarkers,
  ParsedMovement, ParsedStrength, PdfPage, RawSection, SourceProfile,
} from './types';
import { detectFormat, timecapOf, type FormatDetection } from './formats';
import { looksLikeMovementLine, parseMovementLine, resolveMovementName } from './movements';
import { parseStrengthLine } from './strength';
import { serializeImportStrength } from './serialize';
import { applyTypoFixes, normKey, normalizeQuotes, removeArtefacts, secondsToTimecap, stripEmojis, toLines } from './text';

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

function hasOwnFormat(sb: SubBlock): boolean {
  const t = `${sb.title}\n${sb.lines.join('\n')}`;
  return /\b(EMOM|E\d+(?:'\d{2})?MOM|AMRAP|AMQAP|every\s+\d|for\s*time|tabata|death\s*by|\d+\s*rounds?)\b/i.test(t);
}

/**
 * Échauffement du préambule (marqueur sur une ligne, pas de sous-bloc) : tout ce qui
 * suit jusqu'à la première ligne qui n'est ni puce, ni consigne de tours/barre à vide.
 */
const SETS_LINE_RE = /^\s*[-•·*]?\s*\d+(?:\s*à\s*\d+)?\s*[xX×]\s*\d+(?:\s+\S|\s*@)/;

function extractInlineWarmup(lines: string[], markers: string[]): { rest: string[]; warmup: string[] } {
  const rest: string[] = [];
  const warmup: string[] = [];
  let inWarmup = false;
  for (const raw of lines) {
    const line = normalizeQuotes(raw).trim();
    if (!line) continue;
    if (isWarmupHeader(line, markers)) { inWarmup = true; continue; }
    if (inWarmup) {
      // Le warm-up s'arrête au sous-bloc numéroté suivant ou à une ligne `séries × reps` ;
      // jamais sur `@` / `%` seuls (`4 Rounds : de barre à vide à 30%` est l'entête du warm-up).
      const isWork = SETS_LINE_RE.test(line);
      if (!isWork && (/^[-•·*]/.test(line) || /\b(rounds?|tours?)\b|à vide|barre vide/i.test(line))) { warmup.push(line); continue; }
      inWarmup = false;
    }
    rest.push(line);
  }
  return { rest, warmup };
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
    if (sub && sub.toUpperCase() === upper) sub = null;
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

function titleCaseExercise(s: string): string {
  return s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase()).trim();
}

function formatLabel(text: string): string | null {
  const m = text.match(/\b(E\d+(?:'\d{2})?MOM\s*[x×]\s*\d+|EMOM\s*\d+'?|AMRAP\s*\d+(?:\s*à\s*\d+)?'?|every\s+\d+(?:'\d{2}?|")\s*[x×]\s*\d+|\d+\s*rounds?\s*for\s*time|for\s*time|tabata|death\s*by)/i);
  if (!m) return null;
  return m[1].replace(/\s*[x×]\s*/i, ' × ').replace(/\s+/g, ' ').trim();
}

/**
 * Mode force : PAG / Front Squat / Bench (toujours), sinon toute section hors WOD dont la
 * majorité des lignes sont des `séries × reps` sans format temporel (`2) SNATCH - 1X3 … @65%`).
 */
function isStrengthEntry(block: BlockName | null, sectionTitle: string, lines: string[], temporal: boolean): boolean {
  const t = normalizeSectionTitle(sectionTitle);
  if (block === 'skill-haltero' && !/haltero/i.test(t) && !HALTERO_WORDS.test(t)) return true;
  if (block === 'wod' || temporal) return false;
  const mv = lines.filter(looksLikeMovementLine);
  const sets = mv.filter(l => SETS_LINE_RE.test(normalizeQuotes(l)));
  return mv.length > 0 && sets.length >= Math.ceil(mv.length / 2);
}

const RM_COMPLEX_RE = /^\s*[-•·*]?\s*(\d+)\s*RM\s+sur\s+le\s+complexe\*?\s*(.*)$/i;
const COMPLEX_FOOTNOTE_RE = /^\s*\*\s*\d+\s+[^+]+(?:\+\s*\d+\s+[^+]+)+$/;
const DURATION_ACTIVITY_RE = /^\s*[-•·*]?\s*(\d+)(?:\s*(?:à|-)\s*(\d+))?\s*(?:'|min)\s+(\p{L}[\p{L} '-]*)$/iu;

/**
 * `1 Power Clean + 1 Push Press + 1 Power Jerk @50% (RM JERK)` →
 * parts `['1 Power Clean', '1 Push Press', '1 Power Jerk']`, tail ` @50% (RM JERK)`.
 */
function splitComplexLine(line: string): { parts: string[]; tail: string } | null {
  const body = line.replace(/^\s*[-•·*]\s*/, '');
  const cut = body.search(/\s*(?:@|\(|RPE\s*\d)/i);
  const head = cut >= 0 ? body.slice(0, cut) : body;
  const tail = cut >= 0 ? ` ${body.slice(cut).trim()}` : '';
  const parts = head.split(/\s*\+\s*/).map(p => p.trim()).filter(Boolean);
  if (parts.length < 2 || !parts.every(p => /^\d+\s+\p{L}/u.test(p))) return null;
  return { parts, tail };
}

/** `- Min 1/3/5 : 25% T2B (…)` → mouvement `25% T2B` annoté `Min 1/3/5`. */
const MINUTE_PREFIX_RE = /^\s*[-•·*]?\s*(min(?:ute)?s?\s+[\d\/,\-\s]+?)\s*:\s*(.+)$/i;

/**
 * Recolle les retours à la ligne du PDF : parenthèse ouverte non fermée, ou ligne suivante
 * qui commence en minuscule / par une parenthèse sans être une puce.
 */
function mergeWrappedLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const prev = out[out.length - 1];
    if (prev !== undefined) {
      const open = (prev.match(/\(/g) ?? []).length > (prev.match(/\)/g) ?? []).length;
      const notBullet = !/^[-•·*\d🟣🔴🥇*]/u.test(line);
      const continuation = notBullet && !/[.:!?"»]$/.test(prev)
        && (/^[a-zà-ü(]/.test(line) || (open && !/^[A-Z]\)/.test(line)) || MINUTE_PREFIX_RE.test(prev));
      if (open || continuation) { out[out.length - 1] = `${prev} ${line}`; continue; }
    }
    out.push(line);
  }
  return out;
}

interface EntryDraft {
  section: RawSection;
  subTitle: string | null;
  lines: string[];
  /** Lignes du sous-bloc WARM-UPS (ou du warm-up inline du préambule) → notes, jamais des mouvements. */
  warmupLines: string[];
  /** Texte partagé par tous les sous-blocs d'une section (méthodo RENFO, consignes). */
  sharedLines: string[];
  option: 'A' | 'B' | null;
  alternativeWith: string | null;
}

interface AltInfo { title: string; option: 'A' | 'B' | null; alternativeWith: string | null }

/**
 * `RENFO OU RUN` : si une section `RUN … OU RENFO` existe le même jour, chacune est une
 * option (A puis B) avec la note « Au choix avec … ». Sinon une seule entrée, annotée.
 */
function resolveAlternatives(sections: RawSection[]): AltInfo[] {
  const parsed = sections.map(s => {
    const t = normalizeSectionTitle(s.title).replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
    const m = t.match(/^(.+?)\s+OU\s+(.+)$/i);
    return m ? { title: m[1].trim(), other: m[2].trim() } : { title: t, other: null };
  });
  return parsed.map((p, i) => {
    if (!p.other) return { title: p.title, option: null, alternativeWith: null };
    const j = parsed.findIndex((q, k) => k !== i && q.title.toUpperCase() === p.other!.toUpperCase());
    if (j < 0) return { title: p.title, option: null, alternativeWith: p.other };
    return { title: p.title, option: j > i ? 'A' : 'B', alternativeWith: p.other };
  });
}

function draftsForSection(section: RawSection, profile: SourceProfile, alt: AltInfo): EntryDraft[] {
  const rawTitle = alt.title;
  const drafts: EntryDraft[] = [];

  const subs = splitSubBlocks(section.lines);
  const preamble = subs.find(s => s.label === null);
  const labelled = subs.filter(s => s.label !== null && !isWarmupHeader(s.title, profile.warmupMarkers));
  const warmupSubs = subs.filter(s => s.label !== null && isWarmupHeader(s.title, profile.warmupMarkers));
  const inline = extractInlineWarmup(preamble?.lines ?? [], profile.warmupMarkers);
  const warmupLines = [...inline.warmup, ...warmupSubs.flatMap(s => s.lines)];

  // Dès qu'un sous-bloc porte son propre format (EMOM, AMRAP, N rounds…), chaque sous-bloc
  // devient une entrée ; sinon (`2) SNATCH` / `3) SNATCH PULL`) ils forment une seule entrée force.
  const splitAll = labelled.some(hasOwnFormat);
  const grouped: SubBlock[] = [];
  const separate: SubBlock[] = [];
  for (const sb of labelled) {
    if (splitAll) separate.push(sb);
    else if (/\b(PAG|X\s*PAG)\b/i.test(sb.title) && /haltero/i.test(rawTitle)) separate.push(sb);
    else grouped.push(sb);
  }

  const base = { section: { ...section, title: rawTitle }, option: alt.option, alternativeWith: alt.alternativeWith };
  const mainLines = [
    ...(separate.length ? [] : inline.rest),
    ...grouped.flatMap(sb => [sb.title ? `${sb.label}) ${sb.title}` : '', ...sb.lines].filter(Boolean)),
  ];
  if (mainLines.length || labelled.length === 0) {
    const firstSub = grouped.length === 1 && grouped[0].title ? grouped[0].title : null;
    drafts.push({ ...base, subTitle: firstSub, lines: mainLines, warmupLines, sharedLines: [] });
  }
  separate.forEach((sb, i) => {
    const pag = /\bPAG\b/i.test(sb.title);
    drafts.push({
      ...base,
      section: { ...base.section, title: pag ? sb.title : rawTitle },
      subTitle: pag ? null : sb.title,
      lines: sb.lines,
      warmupLines: i === 0 && !drafts.length ? warmupLines : [],
      sharedLines: inline.rest,
    });
  });
  return drafts;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function buildEntry(draft: EntryDraft, profile: SourceProfile, weekStart: string, order: number): ImportEntry | null {
  const { section } = draft;
  const warnings = new Set<ImportWarning>();
  const block = blockForTitle(section.title, profile, section.blockHint ?? null);
  if (!block) warnings.add('enum-fallback');

  const lines = mergeWrappedLines(draft.lines);
  const bodyText = [draft.subTitle ?? '', ...lines].join('\n');
  const format = detectFormat(bodyText);
  format.warnings.forEach(w => warnings.add(w));

  const temporal = format.matched && format.type != null && format.type !== 'strength';
  const strengthMode = isStrengthEntry(block, section.title, lines, temporal);
  const movements: ParsedMovement[] = [];
  const musculation: ParsedStrength[] = [];
  const warmup: string[] = [...draft.warmupLines];
  const levelLines: { level: 'open' | 'pro' | 'elite'; text: string }[] = [];
  const advice: string[] = [];
  const options: string[] = [];
  const paragraphs: string[] = [];
  let chargeAmbiguous = false;
  let lastExercise = '';
  let subTitle = draft.subTitle ?? '';

  let extraTimecapSec: number | null = null;

  // `- 1 RM sur le complexe*` + renvoi `*1 Power Clean + 1 Push Press + …` → une ligne force non
  // structurée portant le complexe ; le renvoi est consommé (pas de note dupliquée).
  const allLines = [...mergeWrappedLines(draft.sharedLines), ...lines];
  const rmIdx = allLines.findIndex(l => RM_COMPLEX_RE.test(normalizeQuotes(l)));
  const footIdx = rmIdx >= 0 ? allLines.findIndex(l => COMPLEX_FOOTNOTE_RE.test(normalizeQuotes(l))) : -1;
  if (rmIdx >= 0) {
    const rm = normalizeQuotes(allLines[rmIdx]).match(RM_COMPLEX_RE)!;
    const complex = footIdx >= 0 ? normalizeQuotes(allLines[footIdx]).replace(/^\s*\*\s*/, '').trim() : null;
    musculation.push({
      exercise: complex ? `Complexe : ${complex}` : 'Complexe',
      resolved: true, // pseudo-exercice, jamais soumis à la résolution
      sets: 1,
      reps: 1,
      percent: null,
      rpe: null,
      charge_note: `${rm[1]} RM sur le complexe${rm[2] ? ` · ${rm[2].trim().replace(/^\((.*)\)$/, '$1')}` : ''}`,
      tempo: null,
      rest: null,
    });
  }

  const explicitLevel = section.levelLines ?? [];
  for (const [idx, raw] of allLines.entries()) {
    if (idx === rmIdx || idx === footIdx) continue;
    let line = normalizeQuotes(raw).trim();
    if (!line) continue;

    // `- 15 à 25' Mobilité` : durée + activité hors catalogue → time cap + texte en notes.
    const dur = line.match(DURATION_ACTIVITY_RE);
    if (dur && !/^(?:rest|repos)\b/i.test(dur[3]) && !resolveMovementName(dur[3], profile.synonyms).resolved) {
      extraTimecapSec = Math.max(extraTimecapSec ?? 0, parseInt(dur[2] ?? dur[1], 10) * 60);
      paragraphs.push(line.replace(/^[-•·*]\s*/, ''));
      continue;
    }

    // Complexe `1 Power Clean + 1 Push Press + 1 Power Jerk @50% (RM JERK)` : une ligne force
    // par mouvement, `(complexe)` sur chacune ; une seule ligne non structurée si la charge
    // n'est pas représentable en %1RM.
    const complex = splitComplexLine(line);
    if (complex) {
      const parts = complex.parts.map(p => parseStrengthLine(`${p}${complex.tail}`, { synonyms: profile.synonyms, typoFixes: profile.typoFixes, defaultSets: format.rounds ?? 1 }));
      const representable = parts.every(p => p && p.exercise && !p.rpe && (p.percent != null || !complex.tail.includes('@')));
      if (representable) {
        for (const p of parts) {
          const s = p!;
          s.charge_note = ['complexe', s.charge_note].filter(Boolean).join(' · ');
          musculation.push(s);
        }
      } else {
        musculation.push({
          exercise: `Complexe : ${complex.parts.join(' + ')}`,
          resolved: true,
          sets: format.rounds ?? 1,
          reps: 1,
          percent: null,
          rpe: null,
          charge_note: complex.tail.trim() || null,
          tempo: null,
          rest: null,
        });
      }
      continue;
    }

    // `(RM JERK)` seul sur sa ligne : complément du mouvement précédent.
    if (/^\(.+\)$/.test(line) && (movements.length || musculation.length)) {
      const inner = line.slice(1, -1).trim();
      const lastMv = movements[movements.length - 1];
      const lastSt = musculation[musculation.length - 1];
      if (lastMv && (!lastSt || movements.length >= musculation.length)) lastMv.note = lastMv.note ? `${lastMv.note} · ${inner}` : inner;
      else if (lastSt) lastSt.charge_note = lastSt.charge_note ? `${lastSt.charge_note} · ${inner}` : inner;
      continue;
    }
    let minuteNote: string | null = null;
    const minute = line.match(MINUTE_PREFIX_RE);
    if (minute && looksLikeMovementLine(minute[2])) {
      minuteNote = minute[1].replace(/\s+/g, ' ').trim();
      line = `- ${minute[2]}`;
    }

    const lvl = isLevelLine(line, profile.levelMarkers);
    if (lvl || explicitLevel.includes(raw)) {
      levelLines.push({ level: lvl ?? 'open', text: line });
      continue;
    }
    const sub = line.match(SUBBLOCK_STRICT_RE);
    if (sub) { subTitle = sub[3].replace(/\s*\([^)]*\)\s*/g, ' ').trim(); lastExercise = ''; continue; }
    if (/(rest|repos)\b/i.test(line) && /^\d+(?:'\d{0,2}|")/.test(line)) continue; // repos → format.rests
    if (format.matched && !looksLikeMovementLine(line) && line.length <= 60 && FORMAT_HEADER_RE.test(line)) continue;
    if (QUOTE_RE.test(line) || ADVICE_RE.test(line)) { advice.push(line); continue; }
    if (OPTION_RE.test(line)) { options.push(line); continue; }

    if (looksLikeMovementLine(line)) {
      if (strengthMode) {
        const s = parseStrengthLine(line, { synonyms: profile.synonyms, typoFixes: profile.typoFixes, defaultSets: format.rounds });
        if (s) {
          // `- 6X1 @RPE9` sous `3) TALL CLEAN` : l'exercice est le titre du sous-bloc.
          if (!s.exercise) s.exercise = lastExercise || titleCaseExercise(subTitle);
          if (s.exercise) lastExercise = s.exercise;
          musculation.push(s);
          continue;
        }
      }
      const mv = parseMovementLine(line, { chargeOrder: profile.chargeOrder, synonyms: profile.synonyms, typoFixes: profile.typoFixes });
      if (mv) {
        if (mv.chargeAmbiguous) chargeAmbiguous = true;
        if (minuteNote) mv.movement.note = mv.movement.note ? `${minuteNote} · ${mv.movement.note}` : minuteNote;
        movements.push(mv.movement);
        continue;
      }
      if (/^\d+\s*(?:rounds?|tours?|rds?)\b/i.test(line.replace(/^[-•·*]\s*/, ''))) continue; // entête `3 Rounds de :`
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
  if (type == null) type = 'custom';

  const rank = block === 'wod' && format.scored && !(advice.length > 0 && movements.length === 0);

  const notes: string[] = [];
  if (draft.alternativeWith) notes.push(`Au choix avec ${normalizeSectionTitle(draft.alternativeWith)}`);
  if (section.preamble?.length && order === 1) notes.push(mergeWrappedLines(section.preamble).join('\n'));
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
    timecap: timecapOf(format) ?? (extraTimecapSec != null ? secondsToTimecap(extraTimecapSec) : null),
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
    const sections = profile.splitSections(day);
    const alts = resolveAlternatives(sections);
    for (const [i, section] of sections.entries()) {
      for (const draft of draftsForSection(section, profile, alts[i])) {
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
