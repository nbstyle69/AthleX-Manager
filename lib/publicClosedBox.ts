/**
 * Fiche publique d'une box fermée (archivage, PR 3).
 *
 * La règle de la PR 1 (`boxes_hide_archived`, `boxes_hide_archive_scheduled`)
 * rend une box archivée ou en archivage programmé invisible à `anon` : la page
 * publique tombait donc en 404, comme une adresse inconnue. Pour afficher un
 * état propre, la page relit seulement le nom et l'état de fermeture de ce
 * slug, avec la clé serveur, côté serveur. Rien d'autre n'est exposé.
 */

type Reader = { from: (table: string) => any };

export async function closedPublicBox(service: Reader, slug: string): Promise<{ name: string } | null> {
  const { data } = await service
    .from('boxes').select('name, archived_at, archive_scheduled_at')
    .eq('slug', slug).eq('is_active', true).maybeSingle();
  const row = data as { name: string; archived_at: string | null; archive_scheduled_at: string | null } | null;
  if (!row || (!row.archived_at && !row.archive_scheduled_at)) return null;
  return { name: row.name };
}
