import { requireOwnerAdminRoute } from '@/lib/authz/box-route';

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireOwnerAdminRoute();
  return children;
}
