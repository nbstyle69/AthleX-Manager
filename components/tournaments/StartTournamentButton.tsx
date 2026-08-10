'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Play } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  tournamentId: string;
  status: string;
}

export default function StartTournamentButton({ tournamentId, status }: Props) {
  const router = useRouter();
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== 'open') return null;

  async function start() {
    if (!confirm('Passer le tournoi « En cours » ? Les inscriptions restent visibles, mais le tournoi est marqué comme démarré.')) return;
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
      <button onClick={start} disabled={busy}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-green-400 hover:text-white hover:bg-green-500/20 border border-green-500/20 hover:border-green-500/40 disabled:opacity-60 transition-colors">
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Démarrer le tournoi
      </button>
      {error && <span className="text-[11px] text-red-400 max-w-[220px] text-right">{error}</span>}
    </div>
  );
}
