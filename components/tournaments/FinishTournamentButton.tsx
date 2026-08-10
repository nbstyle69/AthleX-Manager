'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, FlagOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { writeFailure } from '@/lib/writeGuard';

interface Props {
  tournamentId: string;
  status: string;
  /** WOD qui acceptent encore des scores (status <> 'closed'). */
  openWodCount: number;
}

/**
 * Premier temps de la fin de tournoi : ferme tous les WOD (plus de soumission,
 * classement figé) sans distribuer l'ELO. Le tournoi reste `active` — c'est
 * l'état dérivé « En révision » tant que l'organisateur n'a pas distribué.
 */
export default function FinishTournamentButton({ tournamentId, status, openWodCount }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== 'active' || openWodCount === 0) return null;

  async function finish() {
    if (!confirm(
      `Fermer les ${openWodCount} WOD encore ouverts ? Les athlètes ne pourront plus soumettre de score et le classement sera figé.\n\n` +
      'L’ELO n’est pas distribué à cette étape : tu pourras encore valider ou rejeter les scores en attente.',
    )) return;

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
      <button onClick={finish} disabled={busy}
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
