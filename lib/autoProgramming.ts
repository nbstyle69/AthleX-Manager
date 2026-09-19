// ── Programmation automatique de box (lot J2) ───────────────────────────────
// Ce que le Manager doit savoir de la programmation automatique, sans le
// moteur : les trois pistes, le réglage de révélation, et la semaine ISO.
//
// Le moteur (`packages/wod-engine` dans athlex-app) et la fonction edge
// `generate-box-week` restent la source de vérité pour *ce qui est généré*.
// Ici on ne décide rien : on nomme, on valide et on affiche.

/**
 * Pistes générées. Clés figées en base (`boxes.auto_programming_tracks`,
 * `box_auto_programming_runs.track`), dans le même ordre que le moteur.
 *
 * Trois pistes depuis la migration `20261222` d'athlex-app : Functional et
 * Hybrid étaient jusque-là une seule piste nommée « Functional / Hybrid ».
 * Ce sont deux disciplines distinctes du générateur, activables séparément.
 * Aucune box n'a été migrée : celles qui avaient les deux anciennes pistes
 * gardent `{functional, musculation}`, et Hybrid se coche ici.
 */
export const TRACKS = ['functional', 'hybrid', 'musculation'] as const;
export type Track = typeof TRACKS[number];

/**
 * Libellés visibles. Jamais « CrossFit » ni « Hyrox » côté utilisateur, et
 * identiques à `TRACK_LABEL` du moteur : deux libellés pour une même clé
 * donneraient deux noms au même objet selon l'écran.
 */
export const TRACK_LABEL: Record<Track, string> = {
  functional: 'Functional',
  hybrid: 'Hybrid',
  musculation: 'Musculation',
};

export function isTrack(v: unknown): v is Track {
  return typeof v === 'string' && (TRACKS as readonly string[]).includes(v);
}

/**
 * « Functional », « Functional et Hybrid », « Functional, Hybrid et
 * Musculation » — énumération française des pistes actives.
 *
 * Écrit à la main parce que les phrases qui l'utilisent comptaient les pistes
 * (« les deux pistes ») : à trois, ce genre de formule devient faux sans que
 * rien n'échoue.
 */
export function trackListLabel(tracks: readonly Track[]): string {
  const labels = tracks.map((t) => TRACK_LABEL[t]);
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} et ${labels[labels.length - 1]}`;
}

// ── Révélation ──────────────────────────────────────────────────────────────
// Quand les athlètes voient la semaine posée. Réglable par box depuis le lot
// J2 (`boxes.auto_programming_reveal_*`, migration `20261221` d'athlex-app).
// Tant que la migration n'est pas appliquée, les colonnes sont absentes : on
// retombe sur le défaut, qui est exactement ce que la fonction fait déjà
// (`REVEAL_HOUR_PARIS = 18`, dimanche). Le repli ne ment donc pas.

export const REVEAL_MODES = ['daily', 'weekly'] as const;
export type RevealMode = typeof REVEAL_MODES[number];

export interface RevealSettings {
  mode: RevealMode;
  /** Jour de la semaine, 0 = dimanche. Ignoré en mode `daily`. */
  dow: number;
  /** `HH:MM`. */
  time: string;
}

export const DEFAULT_REVEAL: RevealSettings = { mode: 'weekly', dow: 0, time: '18:00' };

/** 0 = dimanche, comme `boxes.auto_programming_reveal_dow`. */
export const DOW_LABEL = [
  'dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi',
] as const;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

/** `18:00:00` (type `time` de Postgres) et `18:00` donnent tous deux `18:00`. */
export function normalizeTime(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = v.trim().match(TIME_RE);
  return m ? `${m[1]}:${m[2]}` : null;
}

/**
 * Le réglage d'une box, colonnes absentes comprises : une base qui n'a pas
 * encore la migration rend le défaut plutôt qu'un écran vide.
 */
export function revealFromRow(row: Record<string, unknown> | null | undefined): RevealSettings {
  const mode = row?.auto_programming_reveal_mode;
  const dow = row?.auto_programming_reveal_dow;
  const time = normalizeTime(row?.auto_programming_reveal_time);
  return {
    mode: mode === 'daily' || mode === 'weekly' ? mode : DEFAULT_REVEAL.mode,
    dow: typeof dow === 'number' && dow >= 0 && dow <= 6 ? dow : DEFAULT_REVEAL.dow,
    time: time ?? DEFAULT_REVEAL.time,
  };
}

/** « chaque jour à 07:00 » · « le dimanche à 18:00 ». */
export function revealLabel(r: RevealSettings): string {
  return r.mode === 'daily' ? `chaque jour à ${r.time}` : `le ${DOW_LABEL[r.dow]} à ${r.time}`;
}

/** Heure de pose, fixée par le cron `generate-box-week` (créé dans athlex-app). */
export const GENERATION_LABEL = 'le samedi 8h';

/**
 * Mot à saisir pour confirmer une régénération. Cocher une case ou cliquer
 * « Oui » se fait sans lire ; recopier un mot demande d'avoir vu la phrase.
 */
export const REGEN_CONFIRM_WORD = 'REGENERER';

/** « 5 octobre » — nomme la semaine visée dans un bouton ou une confirmation. */
export function weekDayLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', timeZone: 'UTC',
  });
}

// ── Semaine ISO ─────────────────────────────────────────────────────────────

/**
 * Année et semaine ISO d'une date `YYYY-MM-DD`, en UTC (la date est déjà un
 * jour civil : lui appliquer un fuseau la ferait basculer d'un jour).
 * Même définition que `isoWeek` du moteur : le jeudi décide de l'année.
 */
export function isoWeekOf(iso: string): { iso_year: number; iso_week: number } {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow + 3);
  const iso_year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(iso_year, 0, 4));
  const jan4Dow = (jan4.getUTCDay() + 6) % 7;
  const firstThursday = new Date(jan4.getTime());
  firstThursday.setUTCDate(jan4.getUTCDate() - jan4Dow + 3);
  const iso_week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return { iso_year, iso_week };
}

// ── Onglets de piste du Whiteboard ──────────────────────────────────────────
// Mêmes clés et même ordre que l'app athlète (`src/utils/whiteboardTracks.ts`) :
// un onglet nommé pareil des deux côtés doit filtrer pareil.

/** `box` = les cartes saisies à la main (`track` nul). `all` = tout. */
export type TrackTab = Track | 'box' | 'all';

export const TAB_LABEL: Record<TrackTab, string> = {
  functional: 'Functional',
  hybrid: 'Hybrid',
  musculation: 'Musculation',
  box: 'Box',
  all: 'Tout',
};

/** Ce que le gérant voit en arrivant : il gère la semaine entière. */
export const DEFAULT_TAB: TrackTab = 'all';

export function isTrackTab(v: unknown): v is TrackTab {
  return typeof v === 'string' && v in TAB_LABEL;
}

/** La piste d'une carte, `null` si elle a été saisie à la main. */
export function trackOf(wod: { track?: string | null }): Track | null {
  return isTrack(wod.track) ? wod.track : null;
}

/**
 * Onglets à montrer pour une semaine : les pistes qui ont au moins une carte,
 * dans l'ordre de `TRACKS`, puis « Box » s'il existe une carte sans piste,
 * puis « Tout ».
 *
 * Rend un tableau VIDE quand aucune carte n'a de piste : la barre disparaît
 * alors entièrement. Un gérant sans programmation automatique n'a pas à voir un
 * filtre qui ne filtre rien.
 */
export function visibleTabs(wods: readonly { track?: string | null }[]): TrackTab[] {
  const present = new Set(wods.map(trackOf).filter((t): t is Track => t !== null));
  if (present.size === 0) return [];
  const tabs: TrackTab[] = TRACKS.filter((t) => present.has(t));
  if (wods.some((w) => trackOf(w) === null)) tabs.push('box');
  tabs.push('all');
  return tabs;
}

/** Filtre d'un onglet. `box` ne retient que les cartes sans piste. */
export function filterByTab<T extends { track?: string | null }>(wods: T[], tab: TrackTab): T[] {
  if (tab === 'all') return wods;
  if (tab === 'box') return wods.filter((w) => trackOf(w) === null);
  return wods.filter((w) => trackOf(w) === tab);
}

/**
 * Onglet effectivement affiché : le choix mémorisé s'il a encore du contenu
 * cette semaine, sinon « Tout ». Un onglet mémorisé qui a disparu laisserait
 * un écran vide sans rien expliquer.
 */
export function resolveTab(memorise: unknown, tabs: readonly TrackTab[]): TrackTab {
  if (tabs.length === 0) return DEFAULT_TAB;
  if (isTrackTab(memorise) && tabs.includes(memorise)) return memorise;
  return DEFAULT_TAB;
}

/** Clé de mémorisation, par box : deux box n'ont pas les mêmes pistes. */
export function trackTabStorageKey(boxId: string): string {
  return `bo_wods_track:${boxId}`;
}

// ── Journal ─────────────────────────────────────────────────────────────────

export const RUN_STATUSES = ['running', 'done', 'error', 'skipped'] as const;
export type RunStatus = typeof RUN_STATUSES[number];

export const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  running: 'En cours', done: 'Terminée', error: 'Erreur', skipped: 'Ignorée',
};

export interface AutoRun {
  id: string;
  box_id: string;
  track: Track;
  iso_year: number;
  iso_week: number;
  status: RunStatus;
  regen_counter: number;
  error: string | null;
  wod_ids: string[];
  generated_at: string;
}

/**
 * « Générer maintenant » ne sert à rien si chaque piste active a déjà sa
 * semaine : le bouton se désactive plutôt que de refaire un appel que la
 * fonction rendrait `kept`.
 */
export function everyTrackDone(
  runs: readonly AutoRun[],
  tracks: readonly Track[],
  week: { iso_year: number; iso_week: number },
): boolean {
  if (tracks.length === 0) return false;
  const done = tracksDone(runs, week);
  return tracks.every((t) => done.has(t));
}

/**
 * Les pistes qui ont une run `done` sur la semaine. C'est ce que la
 * confirmation grise : en génération, une piste déjà faite n'a rien à
 * générer ; en régénération, une piste jamais faite n'a rien à remplacer.
 */
export function tracksDone(
  runs: readonly AutoRun[],
  week: { iso_year: number; iso_week: number },
): Set<Track> {
  return new Set(runs
    .filter((r) => r.status === 'done' && r.iso_year === week.iso_year && r.iso_week === week.iso_week)
    .map((r) => r.track));
}

/**
 * Pistes proposées dans la confirmation, avec leur état. `enabled` dit si la
 * case est cochable ; les cases cochables sont toutes cochées par défaut.
 */
export function trackChoices(
  mode: 'next' | 'regen',
  runs: readonly AutoRun[],
  tracks: readonly Track[],
  week: { iso_year: number; iso_week: number },
): { track: Track; enabled: boolean; reason: string | null }[] {
  const done = tracksDone(runs, week);
  return tracks.map((track) => {
    const isDone = done.has(track);
    const enabled = mode === 'next' ? !isDone : isDone;
    const reason = enabled ? null
      : mode === 'next' ? 'déjà générée cette semaine' : 'pas encore générée cette semaine';
    return { track, enabled, reason };
  });
}

// ── Validation du corps de `PATCH /api/admin/boxes/[id]/auto-programming` ────

export interface AutoProgrammingPatch {
  auto_programming?: boolean;
  auto_programming_tracks?: Track[];
  auto_programming_reveal_mode?: RevealMode;
  auto_programming_reveal_dow?: number;
  auto_programming_reveal_time?: string;
}

/** Les colonnes que la migration `20261221` apporte, absentes ailleurs. */
export const REVEAL_COLUMNS = [
  'auto_programming_reveal_mode',
  'auto_programming_reveal_dow',
  'auto_programming_reveal_time',
] as const;

export function validateAutoProgrammingPatch(body: unknown): {
  errors: string[];
  patch: AutoProgrammingPatch;
} {
  const errors: string[] = [];
  const patch: AutoProgrammingPatch = {};
  if (!body || typeof body !== 'object') return { errors: ['corps JSON attendu'], patch };
  const b = body as Record<string, unknown>;

  if ('auto_programming' in b) {
    if (typeof b.auto_programming !== 'boolean') errors.push('auto_programming : booléen');
    else patch.auto_programming = b.auto_programming;
  }

  // `tracks` côté client, `auto_programming_tracks` en base : le corps du brief
  // parle de `tracks`, la colonne s'appelle autrement. On accepte les deux.
  const rawTracks = 'tracks' in b ? b.tracks : b.auto_programming_tracks;
  if (rawTracks !== undefined) {
    if (!Array.isArray(rawTracks) || !rawTracks.every(isTrack)) {
      errors.push(`pistes connues : ${TRACKS.join(', ')}`);
    } else {
      patch.auto_programming_tracks = [...new Set(rawTracks as Track[])];
    }
  }

  if ('reveal_mode' in b || 'auto_programming_reveal_mode' in b) {
    const v = 'reveal_mode' in b ? b.reveal_mode : b.auto_programming_reveal_mode;
    if (v !== 'daily' && v !== 'weekly') errors.push('révélation : daily ou weekly');
    else patch.auto_programming_reveal_mode = v;
  }
  if ('reveal_dow' in b || 'auto_programming_reveal_dow' in b) {
    const v = 'reveal_dow' in b ? b.reveal_dow : b.auto_programming_reveal_dow;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 6) {
      errors.push('jour de révélation : entier de 0 (dimanche) à 6');
    } else patch.auto_programming_reveal_dow = v;
  }
  if ('reveal_time' in b || 'auto_programming_reveal_time' in b) {
    const v = normalizeTime('reveal_time' in b ? b.reveal_time : b.auto_programming_reveal_time);
    if (!v) errors.push('heure de révélation : HH:MM');
    else patch.auto_programming_reveal_time = v;
  }

  // Une box allumée sans piste ne générerait rien : la fonction boucle sur les
  // pistes. Le dire ici plutôt que de laisser une box « allumée » inerte.
  if (patch.auto_programming === true && patch.auto_programming_tracks?.length === 0) {
    errors.push('une box allumée doit avoir au moins une piste');
  }

  if (errors.length === 0 && Object.keys(patch).length === 0) errors.push('rien à modifier');
  return { errors, patch };
}
