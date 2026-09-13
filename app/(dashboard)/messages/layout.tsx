import { HelpDockProvider } from '@/components/help/HelpDock';

/**
 * Messages est dans le périmètre coach (`COACH_ROUTE_SEGMENTS`) : ce layout ne
 * pose aucune garde owner, il ne fait que fournir les tutoriels de la page au
 * bouton « ? » de la page cliente.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <HelpDockProvider page="messages">{children}</HelpDockProvider>;
}
