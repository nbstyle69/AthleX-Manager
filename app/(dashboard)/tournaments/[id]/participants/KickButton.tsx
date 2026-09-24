'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { UserX, Loader2 } from 'lucide-react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { ERROR_TITLE } from '@/lib/confirmDialog';

export default function KickButton({
  tournamentId,
  athleteId,
  username,
  tournamentName,
}: {
  tournamentId: string;
  athleteId: string;
  username: string;
  tournamentName: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [kicking, setKicking] = useState(false);
  const { dialog, ask, inform } = useConfirmDialog();

  function askKick() {
    ask({
      title: `Exclure ${username} du tournoi ?`,
      element: `${username} · ${tournamentName}`,
      body: 'Il disparaît de la liste des inscrits, ne pourra plus envoyer de score et ne recevra plus les notifications du tournoi. Ses scores déjà envoyés, sa division et ses matchs du tableau sont conservés. Il pourra se réinscrire tant que les inscriptions sont ouvertes.',
      confirmLabel: 'Exclure',
      danger: true,
      run: handleKick,
    });
  }

  async function handleKick() {
    setKicking(true);
    const { error } = await supabase
      .from('tournament_participants')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('athlete_id', athleteId);
    setKicking(false);
    if (error) {
      inform({ kind: 'error', title: ERROR_TITLE, body: `Erreur : ${error.message}` });
      return;
    }
    router.refresh();
  }

  return (
    <>
    {dialog}
    <button
      onClick={askKick}
      disabled={kicking}
      className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/10 transition-colors disabled:opacity-50"
      title="Exclure du tournoi"
    >
      {kicking ? <Loader2 size={13} className="animate-spin" /> : <UserX size={13} />}
      Exclure
    </button>
    </>
  );
}
