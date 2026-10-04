import { requireOwnerAdminRoute } from '@/lib/authz/box-route';
import { HelpDockProvider } from '@/components/help/HelpDock';

/**
 * Notifications (D4b) : réservée au gérant et aux co-gérants, comme la
 * création côté base (RLS de `box_notifications`). Le coach reçoit un 403.
 */
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireOwnerAdminRoute();
  return <HelpDockProvider page="notifications">{children}</HelpDockProvider>;
}
