/**
 * Alerte des 2 jours de l'accueil `/admin` (archivage, PR 3) : les boxs en
 * archivage programmé dont le dernier abonnement connu a pris fin il y a plus
 * de 2 jours, sans archivage. Source : `box_archive_overdue()` (PR 1),
 * réservée au super-admin.
 */

export type OverdueBox = { box_id: string; box_name: string; archive_scheduled_at: string; last_period_end: string };

export function overdueAlertText(n: number): { title: string; body: string } {
  return n === 1
    ? {
        title: '1 box en archivage programmé n’est toujours pas archivée',
        body: 'Son dernier abonnement a pris fin il y a plus de 2 jours. Ouvrez sa fiche pour vérifier ce qui la retient.',
      }
    : {
        title: `${n} boxs en archivage programmé ne sont toujours pas archivées`,
        body: 'Leur dernier abonnement a pris fin il y a plus de 2 jours. Ouvrez chaque fiche pour vérifier ce qui les retient.',
      };
}
