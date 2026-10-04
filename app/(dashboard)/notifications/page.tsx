import NotificationsClient from './NotificationsClient';

/**
 * `?membre=` vient de la fiche athlète. Il n'est qu'une proposition : le client
 * ne le retient que si c'est un membre actif de la box active.
 */
export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { membre } = await searchParams;
  return <NotificationsClient membreParam={typeof membre === 'string' ? membre : null} />;
}
