import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/supabase/server';
import AdminSupportInbox from '@/components/support/AdminSupportInbox';

export default async function AdminSupportPage() {
  const user = await getServerUser();
  if (!user) redirect('/login');
  return <AdminSupportInbox userId={user.id} accent="emerald" />;
}
