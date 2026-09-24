'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Play } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';

interface Props {
  tournamentId: string;
  status: string;
  tournamentName: string;
  participantCount: number;
}

export default function StartTournamentButton({ tournamentId, status, tournamentName, participantCount }: Props) {
  const router = useRouter();
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { dialog, ask } = useConfirmDialog();

  if (status !== 'open') return null;

  // Le texte d'origine laissait croire que les inscriptions restaient ouvertes :
  // `can_join_tournament` exige le statut « open », elles se ferment.
  function askStart() {
    ask({
      title: 'Démarrer le tournoi ?',
      element: `${tournamentName} · ${participantCount} inscrit(s)`,
      body: 'Les inscriptions seront fermées : plus personne ne pourra s’inscrire. Les inscrits recevront l’annonce du démarrage dès qu’un WOD sera ouvert. Tu ne pourras pas rouvrir les inscriptions depuis cet écran.',
      confirmLabel: 'Démarrer et fermer les inscriptions',
      run: start,
    });
  }

  async function start() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from('tournaments').update({ status: 'active' }).eq('id', tournamentId);
    setBusy(false);
    if (err) { setError(err.message); return; }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {dialog}
      <button onClick={askStart} disabled={busy}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-green-400 hover:text-white hover:bg-green-500/20 border border-green-500/20 hover:border-green-500/40 disabled:opacity-60 transition-colors">
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Démarrer le tournoi
      </button>
      {error && <span className="text-[11px] text-red-400 max-w-[220px] text-right">{error}</span>}
    </div>
  );
}
