// WOD d'une offre Marketplace (`box_programming_wods`) ↔ formulaire de
// l'éditeur partagé. Depuis athlex-app#617 la table porte `score_type` et
// `text_mode` comme `box_wods` (#453, PR 2c) : mêmes colonnes, même écriture.

import {
  EMPTY_WOD_FORM, SharedWodColumns, WodFormState, editorContent, formatCap, sharedWodColumns,
} from '@/lib/wodFields';

export type OfferWod = SharedWodColumns & {
  id: string;
  programming_id: string;
  week_number: number;
  day_of_week: number;
  sort_order: number;
};

/** WOD d'offre relu → formulaire et lignes de l'éditeur (NULL = « Non défini »). */
export function offerWodForm(w: OfferWod): { form: WodFormState; movements: string[] } {
  const content = editorContent(w.description, w.text_mode);
  return {
    form: {
      ...EMPTY_WOD_FORM,
      title: w.title,
      description: w.description ?? '',
      wod_type: w.wod_type ?? '',
      block: w.block_name ?? '',
      timeCap: formatCap(w.time_cap_seconds),
      rounds: w.rounds ? String(w.rounds) : '',
      notes: w.notes ?? '',
      videoUrl: w.video_url ?? '',
      leaderboard: w.leaderboard_enabled ?? true,
      scoreType: w.score_type ?? '',
      scoreTypeAuto: false,
      textMode: content.textMode,
      freeText: content.freeText,
      emomInterval: w.emom_interval_minutes ? String(w.emom_interval_minutes) : '1',
      tabataWork: w.tabata_work_seconds ? String(w.tabata_work_seconds) : '20',
      tabataRest: w.tabata_rest_seconds != null ? String(w.tabata_rest_seconds) : '10',
      week: w.week_number,
      dayOfWeek: w.day_of_week,
    },
    movements: content.movements,
  };
}

/** Formulaire → colonnes écrites dans `box_programming_wods` (création et modification). */
export function offerWodPayload(form: WodFormState, movements: string[]) {
  return {
    ...sharedWodColumns(form, movements),
    week_number: form.week,
    day_of_week: form.dayOfWeek,
  };
}
