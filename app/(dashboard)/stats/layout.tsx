import { requireOwnerAdminRoute } from '@/lib/authz/box-route';
import { HelpDockProvider } from '@/components/help/HelpDock';

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireOwnerAdminRoute();
  // Les tutoriels de la page sont rendus ici, côté serveur : la page reste un
  // composant client et son bouton « ? » les lit par contexte.
  return <HelpDockProvider page="stats">{children}</HelpDockProvider>;
}
