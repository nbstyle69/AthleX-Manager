/**
 * Notifications du gérant (D4b) : règles de la page /notifications, sans DOM
 * (testables sous Jest). Reprises de l'app (athlex-app, PR #467 :
 * `src/lib/membresAZ.ts`, `BONotificationsScreen`, i18n `bo.notifications`).
 *
 * Aucune logique serveur ici : la ligne est insérée avec la session de
 * l'utilisateur (RLS : gérant et co-gérants), puis `send-box-notification`
 * est appelée avec son jeton. `delivered_count` n'est posé que par le serveur.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { countOf } from '@/lib/plural';
import { messageErreur } from '@/lib/erreurs';
import { PARIS_TZ, parisDate } from '@/lib/datetime';

export type MembreAZ = { user_id: string; username: string };
export type SectionAZ = { lettre: string; membres: MembreAZ[] };

/** Forme de comparaison : sans accents (é → e, Œ → oe…), en minuscules, espaces bordants retirés. */
export function normaliser(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .toLowerCase()
    .trim();
}

/** Lettre d'un pseudo : sa première lettre sans accent, ou « # ». */
export function lettreDe(username: string): string {
  const c = normaliser(username).charAt(0).toUpperCase();
  return c >= 'A' && c <= 'Z' ? c : '#';
}

/** Tri de A à Z sans accents ni casse ; « # » en dernier ; à égalité, ordre stable par identifiant. */
export function trierMembres(membres: MembreAZ[]): MembreAZ[] {
  const rang = (m: MembreAZ) => (lettreDe(m.username) === '#' ? 1 : 0);
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return [...membres].sort((a, b) =>
    rang(a) - rang(b)
    || cmp(normaliser(a.username), normaliser(b.username))
    || cmp(a.user_id, b.user_id));
}

/** Sections par lettre, dans l'ordre du tri ; seules les lettres présentes. */
export function grouperParLettre(membres: MembreAZ[]): SectionAZ[] {
  const sections: SectionAZ[] = [];
  for (const m of trierMembres(membres)) {
    const l = lettreDe(m.username);
    const der = sections[sections.length - 1];
    if (der && der.lettre === l) der.membres.push(m);
    else sections.push({ lettre: l, membres: [m] });
  }
  return sections;
}

/** Membres dont le pseudo contient la saisie (sans accents ni casse), triés ; saisie vide → tous. */
export function filtrerMembres(membres: MembreAZ[], saisie: string): MembreAZ[] {
  const q = normaliser(saisie);
  return trierMembres(q ? membres.filter((m) => normaliser(m.username).includes(q)) : membres);
}

/** Compteur de la liste : tous les membres sans saisie, sinon le nombre de résultats. */
export function compteurListe(total: number, resultats: number, saisie: string): string {
  return normaliser(saisie)
    ? countOf(resultats, 'résultat', 'résultats')
    : `${countOf(total, 'membre actif', 'membres actifs')}, de A à Z`;
}

/**
 * Présélection par l'URL (`?membre=`, depuis la fiche athlète) : retenue
 * seulement si c'est un membre actif de la box active — la liste chargée en
 * est la définition. Un identifiant d'une autre box est ignoré.
 */
export function membrePreselectionne(param: string | null | undefined, actifs: MembreAZ[]): string | null {
  if (!param) return null;
  return actifs.some((m) => m.user_id === param) ? param : null;
}

export const MEMBRE_RETIRE = 'Membre retiré';

/** Destinataire affiché : « Tous », le pseudo, ou « Membre retiré » s'il n'est plus actif. */
export function libelleDestinataire(target: string, actifs: MembreAZ[]): string {
  if (target === 'all') return 'Tous';
  return actifs.find((m) => m.user_id === target)?.username ?? MEMBRE_RETIRE;
}

export type Ton = 'success' | 'warning';

/** Encadré après l'envoi, selon `sent` renvoyé par `send-box-notification`. */
export function resultatEnvoi(sent: number, membre: string | null): { ton: Ton; texte: string } {
  if (sent > 0) return { ton: 'success', texte: `Envoyée à ${countOf(sent, 'appareil', 'appareils')}.` };
  return {
    ton: 'warning',
    texte: membre
      ? `Non reçue : ${membre} n’a pas activé les notifications ou n’est connecté sur aucun téléphone.`
      : 'Non reçue : aucun membre n’a activé les notifications.',
  };
}

/** Colonne « Résultat » de l'historique : vide tant que le serveur n'a rien posé (NULL). */
export function resultatHistorique(delivered: number | null | undefined): { ton: Ton; texte: string } | null {
  if (typeof delivered !== 'number') return null;
  return delivered > 0
    ? { ton: 'success', texte: countOf(delivered, 'appareil', 'appareils') }
    : { ton: 'warning', texte: 'Non reçue' };
}

/** « 03/10 · 15:09 », en heure de Paris. */
export function dateHistorique(iso: string): string {
  const jour = parisDate(iso, { day: '2-digit', month: '2-digit' });
  const heure = new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: PARIS_TZ });
  return `${jour} · ${heure}`;
}

/** « Envoyer » n'est actif qu'avec un titre, et jamais pendant un envoi. */
export function envoiPossible(titre: string, envoiEnCours: boolean): boolean {
  return titre.trim().length > 0 && !envoiEnCours;
}

export const TITRE_MAX = 80;
export const MESSAGE_MAX = 300;

export const ECHEC_ENVOI = 'La notification est enregistrée mais l’envoi a échoué. Réessaie plus tard.';

/** `enregistree` : la ligne existe (seul l'envoi a échoué), l'historique la montre. */
export type Envoi = { ok: true; sent: number } | { ok: false; erreur: string; enregistree: boolean };

/**
 * Insertion RLS puis appel de `send-box-notification` avec le jeton de la
 * session (le client Supabase le porte) — jamais la clé serveur. Un 409
 * (« Already sent ») ou toute autre erreur de la fonction rend `ECHEC_ENVOI`.
 */
export async function envoyerNotification(
  supabase: SupabaseClient,
  n: { boxId: string; userId: string; titre: string; message: string; target: string },
): Promise<Envoi> {
  const { data: inserted, error } = await supabase
    .from('box_notifications')
    .insert({
      box_id: n.boxId,
      title: n.titre.trim(),
      body: n.message.trim(),
      target: n.target,
      created_by: n.userId,
    })
    .select('id')
    .single();
  if (error || !inserted) {
    return { ok: false, erreur: error ? messageErreur(error) : 'La notification n’a pas été enregistrée.', enregistree: false };
  }

  const { data, error: pushErr } = await supabase.functions.invoke('send-box-notification', {
    body: { notification_id: (inserted as { id: string }).id },
  });
  if (pushErr) return { ok: false, erreur: ECHEC_ENVOI, enregistree: true };
  return { ok: true, sent: Number((data as { sent?: number } | null)?.sent ?? 0) };
}
