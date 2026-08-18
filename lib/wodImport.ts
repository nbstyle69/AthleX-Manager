// Import de WOD en masse, partagé par les deux contextes de l'éditeur :
// Whiteboard (ancrage par date calendaire, accès par groupe) et Programmation
// (ancrage semaine × jour, aucun accès — la box abonnée choisit ses groupes en
// appliquant la semaine). Le format de fichier et le parseur sont les mêmes ;
// seules les colonnes d'ancrage changent.

import type { WodType } from './wodFields';

export type WodImportMode = 'whiteboard' | 'programming';

export const VALID_WOD_TYPES: WodType[] = ['for-time', 'amrap', 'emom', 'tabata', 'strength', 'custom'];

export interface ImportedWodRow {
  title: string;
  type: string;
  description: string;
  timeCap: string;
  rounds: string;
  notes: string;
  block: string;
  /** Whiteboard uniquement. */
  published: boolean;
  rank: boolean;
  groupNames: string[];
  date: string;
  /** Programmation uniquement. */
  week: number;
  day: number;
}

export interface WodImportParse {
  rows: ImportedWodRow[];
  errors: string[];
}

const CSV_HEADERS: Record<WodImportMode, string> = {
  whiteboard: 'date,title,type,description,timecap,rounds,notes,block,published,rank,groups',
  programming: 'week,day,title,type,description,timecap,rounds,notes,block',
};

const CSV_EXAMPLES: Record<WodImportMode, string[]> = {
  whiteboard: [
    `2026-03-10,Fran,for-time,"21-15-9 Thrusters (43kg) + Pull-ups",20,,"Objectif sub 5min",wod,true,true,Compétiteurs|Niveau Avancé`,
    `2026-03-10,Front Squat,strength,"5x3 Front Squat @80-85%",,5,"Repos 3min entre séries",skill-haltero,true,false,`,
    `2026-03-11,Cindy,amrap,"5 Pull-ups / 10 Push-ups / 15 Air Squats",20,,"Comptez vos rounds complets",wod,true,true,`,
    `2026-03-12,Karen,for-time,"150 Wall Balls (9kg / cible 3m)",20,,,wod,false,true,Groupe du Matin`,
    `2026-03-13,EMOM 12,emom,"Min 1: 12 Box Jumps | Min 2: 8 Dips | Min 3: 200m Row",12,4,,wod,true,true,`,
  ],
  programming: [
    `1,1,Fran,for-time,"21-15-9 Thrusters (43kg) + Pull-ups",12:30,,"Objectif sub 5min",wod`,
    `1,1,Front Squat,strength,"5x3 Front Squat @80-85%",,5,"Repos 3min entre séries",skill-haltero`,
    `1,3,Cindy,amrap,"5 Pull-ups / 10 Push-ups / 15 Air Squats",20,,"Comptez vos rounds complets",wod`,
    `2,1,Karen,for-time,"150 Wall Balls (9kg / cible 3m)",20,,,wod`,
    `2,5,EMOM 12,emom,"Min 1: 12 Box Jumps | Min 2: 8 Dips | Min 3: 200m Row",12,4,,wod`,
  ],
};

/**
 * Contenu du template CSV téléchargeable. En mode programmation, `date` cède la
 * place à `week,day` et les colonnes d'accès disparaissent.
 */
export function wodCsvTemplate(mode: WodImportMode): string {
  return `${CSV_HEADERS[mode]}\n${CSV_EXAMPLES[mode].join('\n')}`;
}

export function wodCsvTemplateFileName(mode: WodImportMode): string {
  return mode === 'programming' ? 'template_programmation.csv' : 'template_wods.csv';
}

function parseBool(v: string | undefined | null, fallback = true): boolean {
  if (!v || !v.trim()) return fallback;
  const s = v.trim().toLowerCase();
  return !(s === 'false' || s === '0' || s === 'non');
}

/** Découpe une ligne CSV en respectant les guillemets et les deux séparateurs usuels. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuote = false;
  for (let c = 0; c < line.length; c++) {
    const ch = line[c];
    if (ch === '"') {
      if (inQuote && line[c + 1] === '"') { current += '"'; c++; } else { inQuote = !inQuote; }
    } else if ((ch === ',' || ch === ';') && !inQuote) {
      fields.push(current); current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function emptyRow(): ImportedWodRow {
  return {
    title: '', type: 'custom', description: '', timeCap: '', rounds: '', notes: '', block: '',
    published: true, rank: true, groupNames: [], date: '', week: 1, day: 1,
  };
}

function readWeek(raw: string | undefined, weeksCount: number): number | null {
  const n = parseInt((raw ?? '').trim(), 10);
  if (Number.isNaN(n) || n < 1 || n > weeksCount) return null;
  return n;
}

function readDay(raw: string | undefined): number | null {
  const n = parseInt((raw ?? '').trim(), 10);
  if (Number.isNaN(n) || n < 1 || n > 7) return null;
  return n;
}

/**
 * Parse un fichier CSV ou JSON de WOD. Les lignes invalides sont ignorées avec
 * un message : un import partiel vaut mieux qu'un refus global, mais l'appelant
 * doit afficher les erreurs — une ligne muette avalée est une donnée perdue.
 *
 * `weeksCount` borne la colonne `week` en mode programmation.
 */
export function parseWodImportFile(
  text: string,
  fileName: string,
  mode: WodImportMode,
  weeksCount = 52,
): WodImportParse {
  const rows: ImportedWodRow[] = [];
  const errors: string[] = [];

  if (fileName.toLowerCase().endsWith('.json')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { rows: [], errors: ['Fichier JSON invalide'] };
    }
    const arr = (Array.isArray(parsed) ? parsed : [parsed]) as Record<string, unknown>[];
    arr.forEach((r, i) => {
      const title = typeof r.title === 'string' ? r.title.trim() : '';
      if (!title) { errors.push(`Entrée ${i + 1} ignorée : titre manquant`); return; }
      const row = emptyRow();
      row.title = title;
      row.type = typeof r.type === 'string' && r.type ? r.type : 'custom';
      row.description = typeof r.description === 'string' ? r.description : '';
      row.timeCap = r.timecap != null ? String(r.timecap) : '';
      row.rounds = r.rounds != null ? String(r.rounds) : '';
      row.notes = typeof r.notes === 'string' ? r.notes : '';
      row.block = typeof r.block === 'string' ? r.block : '';
      if (mode === 'whiteboard') {
        const date = typeof r.date === 'string' ? r.date : '';
        if (!date) { errors.push(`Entrée ${i + 1} ignorée : date manquante`); return; }
        row.date = date;
        row.published = r.published !== false;
        row.rank = r.rank !== false;
        row.groupNames = Array.isArray(r.groups) ? r.groups.filter((g): g is string => typeof g === 'string') : [];
      } else {
        const week = readWeek(r.week != null ? String(r.week) : '', weeksCount);
        const day = readDay(r.day != null ? String(r.day) : '');
        if (week === null || day === null) {
          errors.push(`Entrée ${i + 1} ignorée : semaine (1..${weeksCount}) ou jour (1..7) invalide`);
          return;
        }
        row.week = week;
        row.day = day;
      }
      rows.push(row);
    });
    return { rows, errors };
  }

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    return { rows: [], errors: ['Fichier vide : une ligne d\u2019en-tête puis une ligne par WOD'] };
  }
  const dataLines = lines.slice(1);
  for (let i = 0; i < dataLines.length; i++) {
    const fields = splitCsvLine(dataLines[i]);
    const row = emptyRow();
    let rest: string[];

    if (mode === 'whiteboard') {
      const [date, ...tail] = fields;
      if (!date?.match(/^\d{4}-\d{2}-\d{2}$/)) {
        errors.push(`Ligne ${i + 2} ignorée : date invalide (attendu AAAA-MM-JJ)`);
        continue;
      }
      row.date = date.trim();
      rest = tail;
    } else {
      const [weekRaw, dayRaw, ...tail] = fields;
      const week = readWeek(weekRaw, weeksCount);
      const day = readDay(dayRaw);
      if (week === null || day === null) {
        errors.push(`Ligne ${i + 2} ignorée : semaine (1..${weeksCount}) ou jour (1..7) invalide`);
        continue;
      }
      row.week = week;
      row.day = day;
      rest = tail;
    }

    const [title, type, description, timeCap, rounds, notes, block, published, rank, groups] = rest;
    if (!title?.trim()) {
      errors.push(`Ligne ${i + 2} ignorée : titre manquant`);
      continue;
    }
    row.title = title.trim();
    row.type = type?.trim() || 'custom';
    row.description = description?.trim() || '';
    row.timeCap = timeCap?.trim() || '';
    row.rounds = rounds?.trim() || '';
    row.notes = notes?.trim() || '';
    row.block = block?.trim() || '';
    if (mode === 'whiteboard') {
      row.published = parseBool(published);
      row.rank = parseBool(rank);
      row.groupNames = groups ? groups.split('|').map((g) => g.trim()).filter(Boolean) : [];
    }
    rows.push(row);
  }

  return { rows, errors };
}

/**
 * L'analyse PDF par IA (`parse-wod-pdf`) rend des WOD **datés** depuis une date
 * de départ : on ne touche pas au parseur, on convertit sa sortie en
 * semaine × jour. La semaine est l'écart en semaines depuis le lundi de la date
 * de départ, le jour est le jour ISO (lundi = 1).
 */
export function dateToWeekDay(iso: string, startISO: string): { week: number; day: number } {
  const d = new Date(`${iso}T00:00:00`);
  const start = new Date(`${startISO}T00:00:00`);
  const startDow = start.getDay();
  const startMonday = new Date(start);
  startMonday.setDate(start.getDate() - (startDow === 0 ? 6 : startDow - 1));
  const diffDays = Math.floor((d.getTime() - startMonday.getTime()) / 86_400_000);
  const dow = d.getDay();
  return {
    week: Math.max(1, Math.floor(diffDays / 7) + 1),
    day: dow === 0 ? 7 : dow,
  };
}

/** Déclenche le téléchargement du template CSV du mode demandé. */
export function downloadWodCsvTemplate(mode: WodImportMode): void {
  const blob = new Blob([wodCsvTemplate(mode)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = wodCsvTemplateFileName(mode);
  a.click();
  URL.revokeObjectURL(url);
}
