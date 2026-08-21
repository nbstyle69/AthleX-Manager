import { createClient, getActiveBox } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import TournamentForm from '@/components/tournaments/TournamentForm';

export default async function NewTournamentPage() {
  const supabase = await createClient();
  const box: any = await getActiveBox(supabase);
  if (!box) redirect('/login');

  const allowedFormats: string[] = Array.isArray(box.allowed_tournament_formats) && box.allowed_tournament_formats.length > 0
    ? box.allowed_tournament_formats
    : ['simple'];

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Créer un tournoi</h1>
        <p className="text-sm text-gray-400 mt-1">Configurez les paramètres de votre nouveau tournoi.</p>
      </div>
      <TournamentForm boxId={box.id} allowedFormats={allowedFormats} />
    </div>
  );
}
