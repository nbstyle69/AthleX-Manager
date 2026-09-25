import { toDateInput, fromDateInput } from '@/lib/datetime';

/**
 * État et enregistrement du formulaire de tournoi (`TournamentForm`), sans DOM.
 *
 * Correctif « édition qui convertit le format » : à la modification, le
 * formulaire remplissait ses champs avec des valeurs par défaut (format
 * `simple` quand la page n'envoyait pas `allowedFormats`, règlement type,
 * chaînes vides, date ramenée à minuit) puis renvoyait TOUT le formulaire.
 * Désormais la modification n'envoie que les champs réellement changés, et
 * jamais `format` : le format se choisit à la création seulement.
 */

export const DEFAULT_RULES = `1. Les scores doivent être soumis dans les 24h suivant l'ouverture du WOD.\n2. Une vidéo YouTube publique est obligatoire pour chaque soumission.\n3. Tout score sans vidéo sera automatiquement rejeté.\n4. Les scores sont validés par l'organisateur sous 48h.\n5. Tout comportement antisportif entraîne la disqualification.`;

export interface TournamentFormState {
  name: string;
  description: string;
  level: string;
  status: string;
  start_date: string;
  end_date: string;
  max_participants: number;
  prize: string;
  format: string;
  require_video_proof: boolean;
  rules: string;
}

/** Valeurs de départ du formulaire (inchangées : création comme modification). */
export function initialTournamentForm(initial: any, allowedFormats: string[]): TournamentFormState {
  const defaultFormat = (allowedFormats.includes(initial?.format) ? initial.format : allowedFormats[0]) ?? 'simple';
  return {
    name:                initial?.name                ?? '',
    description:         initial?.description         ?? '',
    level:               initial?.level               ?? 'rx',
    status:              initial?.status              ?? 'open',
    start_date:          toDateInput(initial?.start_date),
    end_date:            toDateInput(initial?.end_date),
    max_participants:    initial?.max_participants    ?? 32,
    prize:               initial?.prize               ?? '',
    format:              defaultFormat,
    require_video_proof: initial?.require_video_proof ?? false,
    rules:               initial?.rules               ?? DEFAULT_RULES,
  };
}

/** Champs qu'une modification peut écrire (jamais `format`). */
const EDITABLE: Array<Exclude<keyof TournamentFormState, 'format'>> = [
  'name', 'description', 'level', 'status', 'start_date', 'end_date',
  'max_participants', 'prize', 'require_video_proof', 'rules',
];

/**
 * Enregistrement d'une modification : seuls les champs changés depuis
 * l'ouverture du formulaire partent, avec la même mise en forme qu'avant ;
 * un champ non touché garde donc sa valeur enregistrée, même si le formulaire
 * l'affichait avec une valeur par défaut. `format` ne part jamais.
 * Le nom part toujours (champ obligatoire, lu tel qu'enregistré) : un
 * « Enregistrer » sans changement écrit donc toujours, comme avant.
 */
export function tournamentUpdatePayload(
  start: TournamentFormState,
  form: TournamentFormState,
  opts: { boxId: string; publish: boolean; bannerUrl: string | null; initialBannerUrl: string | null },
): Record<string, unknown> {
  const payload: Record<string, unknown> = { name: form.name, box_id: opts.boxId };
  for (const k of EDITABLE) {
    if (form[k] === start[k]) continue;
    payload[k] = k === 'start_date' ? fromDateInput(form.start_date)
      : k === 'end_date' ? (form.end_date || null)
      : form[k];
  }
  if (opts.publish) payload.status = 'open';
  if (opts.bannerUrl !== opts.initialBannerUrl) payload.banner_url = opts.bannerUrl;
  return payload;
}
