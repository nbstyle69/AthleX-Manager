'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, FlagOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { writeFailure } from '@/lib/writeGuard';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';

interface Props {
  tournamentId: string;
  status: string;
  /** WOD qui acceptent encore des scores (status <> 'closed'). */
  openWodCount: number;
  tournamentName: string;
}

/**
 * Premier temps de la fin de tournoi : ferme tous les WOD (plus de soumission,
 * classement figé) sans distribuer l'ELO. Le tournoi reste `active` — c'est
 * l'état dérivé « En révision » tant que l'organisateur n'a pas distribué.
 */
export default function FinishTournamentButton({ tournamentId, status, openWodCount, tournamentName }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { dialog, ask } = useConfirmDialog();

  if (status !== 'active' || openWodCount === 0) return null;

  function askFinish() {
    ask({
      title: 'Terminer le tournoi ?',
      element: `${tournamentName} · ${openWodCount} WOD pas encore ${openWodCount > 1 ? 'fermés, ouverts ou en attente' : 'fermé, ouvert ou en attente'}`,
      body: 'Les athlètes ne pourront plus envoyer de score, et les WOD pas encore ouverts ne le seront pas. Tu pourras encore valider ou rejeter les scores en attente. L’ELO n’est pas distribué à cette étape. Un WOD peut être rouvert depuis l’onglet WOD.',
      confirmLabel: 'Fermer les WOD',
      run: finish,
    });
  }

  async function finish() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from('tournament_wods')
      .update({ status: 'closed' })
      .eq('tournament_id', tournamentId)
      .neq('status', 'closed')
      .select('id');

    setBusy(false);
    // Une RLS qui filtre ne renvoie pas d'erreur : sans ce contrôle, l'écran
    // se rafraîchirait sur un « succès » qui n'a fermé aucun WOD.
    const failure = writeFailure(err, data);
    if (failure) {
      setError(failure);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {dialog}
      <button onClick={askFinish} disabled={busy}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 border border-white/10 hover:border-white/25 disabled:opacity-50 transition-colors">
        {busy ? <Loader2 size={13} className="animate-spin" /> : <FlagOff size={13} />}
        Terminer le tournoi
      </button>
      {error && (
        <span className="text-[11px] text-red-400 max-w-[220px] text-right">{error}</span>
      )}
    </div>
  );
}
