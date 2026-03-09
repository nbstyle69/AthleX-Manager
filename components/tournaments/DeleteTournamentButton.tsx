'use client';

import { useState } from 'react';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface Props { tournamentId: string }

export default function DeleteTournamentButton({ tournamentId }: Props) {
  const router = useRouter();
  const [open,     setOpen]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from('tournaments').delete().eq('id', tournamentId);
    setDeleting(false);
    if (err) { setError(err.message); return; }
    router.push('/tournaments');
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-white hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 transition-colors">
        <Trash2 size={13} /> Supprimer
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-start gap-3">
              <AlertTriangle size={22} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-base font-black text-white mb-1">Supprimer ce tournoi ?</h2>
                <p className="text-sm text-gray-400">
                  Cette action est <strong className="text-white">irréversible</strong>.
                  Les WODs, participants et scores associés seront également supprimés.
                </p>
                {error && (
                  <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-400">{error}</div>
                )}
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-colors">
                Annuler
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 transition-colors">
                {deleting && <Loader2 size={14} className="animate-spin" />}
                {deleting ? 'Suppression…' : 'Confirmer la suppression'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
