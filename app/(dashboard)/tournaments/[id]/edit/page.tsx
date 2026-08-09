'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Trash2, Trophy, Loader2, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getMyBox } from '@/lib/getMyBox';
import TournamentForm from '@/components/tournaments/TournamentForm';

export default function EditTournamentPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [tournament, setTournament] = useState<any>(null);
  const [boxId,      setBoxId]      = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [deleting,   setDeleting]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      const active = await getMyBox(supabase, user.id);
      if (!active) { router.replace('/login'); return; }
      const resolvedBoxId = active.id;

      const { data: t } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', id)
        .eq('box_id', resolvedBoxId)
        .single();

      if (!t) { router.replace('/tournaments'); return; }
      setTournament(t);
      setBoxId(resolvedBoxId);
      setLoading(false);
    }
    load();
  }, [id, router]);

  async function handleDelete() {
    if (!tournament) return;
    setDeleting(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from('tournaments').delete().eq('id', id);
    setDeleting(false);
    if (err) { setError(err.message); return; }
    router.push('/tournaments');
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 size={28} className="animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/tournaments/${id}`}
            className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
            <ChevronLeft size={16} />
          </Link>
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-white" />
            <span className="text-sm font-bold text-white">{tournament?.name}</span>
            <span className="text-gray-600">/</span>
            <span className="text-sm text-gray-400">Modifier</span>
          </div>
        </div>
        <button
          onClick={() => setShowConfirm(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-white hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 transition-colors">
          <Trash2 size={13} /> Supprimer
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Delete confirmation */}
      {showConfirm && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 flex items-start gap-4">
          <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white mb-1">Supprimer ce tournoi ?</p>
            <p className="text-xs text-gray-400 mb-4">
              Cette action est irréversible. Les WODs, participants et scores associés seront également supprimés.
            </p>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-colors">
                Annuler
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white disabled:opacity-60 transition-colors">
                {deleting && <Loader2 size={12} className="animate-spin" />}
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      {boxId && <TournamentForm boxId={boxId} initial={tournament} />}
    </div>
  );
}
