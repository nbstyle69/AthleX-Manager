import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Building2 } from 'lucide-react';
import { createClient, getAdminBoxes, getServerUser } from '@/lib/supabase/server';
import CreateBoxForm from './CreateBoxForm';

export const dynamic = 'force-dynamic';

/**
 * « Créer ma box », accessible uniquement depuis un compte connecté.
 *
 * Sans session, on renvoie à la connexion avec retour ici. Un compte qui
 * administre déjà une box n'a rien à créer : on l'envoie sur son tableau de
 * bord plutôt que de lui présenter un formulaire dont la route refuserait
 * l'issue.
 */
export default async function CreateMyBoxPage() {
  const user = await getServerUser();
  if (!user) redirect('/login/athlete?next=/compte/creer-ma-box');

  const supabase = await createClient();
  const boxes = await getAdminBoxes(supabase);
  if (boxes.some((b) => b.my_role === 'owner')) redirect('/');

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <Link href="/compte" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
        <ArrowLeft size={14} /> Mon compte
      </Link>
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
          <Building2 size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">Créer ma box</h1>
          <p className="text-sm text-gray-400">Ouvre l&apos;espace gérant de ta salle, depuis ce compte.</p>
        </div>
      </div>
      <CreateBoxForm email={user.email ?? ''} />
    </div>
  );
}
