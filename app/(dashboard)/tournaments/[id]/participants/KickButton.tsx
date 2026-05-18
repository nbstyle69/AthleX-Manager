'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { UserX, Loader2 } from 'lucide-react';

export default function KickButton({
  tournamentId,
  athleteId,
  username,
}: {
  tournamentId: string;
  athleteId: string;
  username: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [kicking, setKicking] = useState(false);

  async function handleKick() {
    if (!confirm(`Exclure ${username} du tournoi ?`)) return;
    setKicking(true);
    const { error } = await supabase
      .from('tournament_participants')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('athlete_id', athleteId);
    setKicking(false);
    if (error) {
      alert(`Erreur : ${error.message}`);
      return;
    }
    router.refresh();
  }

  return (
    <button
      onClick={handleKick}
      disabled={kicking}
      className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/10 transition-colors disabled:opacity-50"
      title="Exclure du tournoi"
    >
      {kicking ? <Loader2 size={13} className="animate-spin" /> : <UserX size={13} />}
      Exclure
    </button>
  );
}
