import { createClient, getOwnerBox } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import TournamentForm from '@/components/tournaments/TournamentForm';

export default async function NewTournamentPage() {
  const supabase = await createClient();
  const box = await getOwnerBox(supabase);
  if (!box) redirect('/login');

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Créer un tournoi</h1>
        <p className="text-sm text-gray-400 mt-1">Configurez les paramètres de votre nouveau tournoi.</p>
      </div>
      <TournamentForm boxId={box.id} />
    </div>
  );
}
