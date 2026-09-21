import { notFound } from 'next/navigation';
import { createClient, createServiceClient, getActiveBox } from '@/lib/supabase/server';

/**
 * Le tournoi demandé, s'il appartient à la box active de l'appelant.
 *
 * ── Pourquoi ce helper ──────────────────────────────────────────────────────
 *
 * Les pages tournoi lisent avec le client `service_role`, qui **ignore la
 * RLS** : c'est le seul endroit du back-office où une requête n'est bornée que
 * par ce que le code écrit. Trois défauts s'y étaient installés, chacun
 * suffisant pour qu'un gérant lise les données d'une autre box :
 *
 *   1. le contrôle d'appartenance arrivait APRÈS les requêtes privilégiées
 *      (classement, scores) — les lignes étaient déjà lues et en mémoire du
 *      serveur quand la redirection tombait ;
 *   2. certaines requêtes n'avaient aucun filtre de tournoi
 *      (`tournament_division_members` lu en entier, filtré ensuite en
 *      JavaScript) ;
 *   3. chaque page refaisait le contrôle à sa façon, donc une page nouvelle
 *      pouvait l'oublier sans que rien ne le signale.
 *
 * ── Ce que le helper garantit ───────────────────────────────────────────────
 *
 * Il lève `notFound()` lui-même plutôt que de rendre `null` : un appelant ne
 * peut pas oublier de traiter le refus, et l'existence d'un tournoi d'une
 * autre box n'est pas révélée — un 404, pas un 403.
 *
 * Le tournoi est lu avec le client de l'UTILISATEUR, pas le client de service :
 * la RLS reste une seconde barrière si la résolution de box se trompait. Le
 * client de service n'est rendu qu'APRÈS ce contrôle, et les requêtes qui le
 * suivent doivent toutes être bornées par `tournament.id` — ou par des
 * identifiants dérivés de ce tournoi, comme `divisionIdsOf`.
 */

export interface TournamentForBox<T> {
  /** Le tournoi validé : il appartient à la box active. */
  tournament: T;
  /** La box active, déjà résolue — inutile de la relire. */
  box: { id: string; name: string };
  /** Client privilégié, à n'employer qu'après ce contrôle. */
  svc: ReturnType<typeof createServiceClient>;
  /** Client de l'appelant (RLS), pour ce qui n'a pas besoin de privilège. */
  userClient: Awaited<ReturnType<typeof createClient>>;
}

/**
 * @param tournamentId id venu de l'URL — donc non fiable par construction.
 * @param columns colonnes du tournoi à charger (`*` par défaut).
 */
export async function getTournamentForActiveBox<T = Record<string, unknown>>(
  tournamentId: string,
  columns = '*',
): Promise<TournamentForBox<T>> {
  const userClient = await createClient();
  const box = await getActiveBox(userClient);

  // Aucune box active : rien à montrer. `notFound()` plutôt qu'une
  // redirection vers la connexion — la page n'existe pas pour cet appelant,
  // et les mises en page du tableau de bord traitent déjà l'absence de box.
  if (!box) notFound();

  const { data: tournament } = await userClient
    .from('tournaments')
    .select(columns)
    .eq('id', tournamentId)
    .eq('box_id', box.id)
    .maybeSingle();

  // Tournoi inexistant ou appartenant à une autre box : même réponse. Deux
  // réponses différentes diraient à l'appelant lequel des deux cas s'applique.
  if (!tournament) notFound();

  return {
    tournament: tournament as T,
    box: { id: box.id, name: box.name },
    svc: createServiceClient(),
    userClient,
  };
}

/**
 * Les divisions d'un tournoi validé, pour borner ce qui n'a pas de
 * `tournament_id` propre.
 *
 * `tournament_division_members` ne porte qu'un `division_id` : sans cette
 * étape, la seule façon de « filtrer » était de tout lire puis de trier en
 * mémoire — ce que faisaient le classement et la page divisions.
 *
 * Rend un tableau vide quand le tournoi n'a pas de division, et l'appelant
 * doit alors s'abstenir d'interroger les membres : un `.in('division_id', [])`
 * ne rend rien, mais compter dessus serait accidentel.
 */
export async function divisionIdsOf(
  svc: ReturnType<typeof createServiceClient>,
  tournamentId: string,
): Promise<string[]> {
  const { data } = await svc
    .from('tournament_divisions')
    .select('id')
    .eq('tournament_id', tournamentId);
  return (data ?? []).map((d) => (d as { id: string }).id);
}
