'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import WODForm from '@/components/tournaments/WODForm';
import { Plus, ArrowLeft, Pencil, Trash2, PlayCircle, XCircle, GripVertical } from 'lucide-react';
import Link from 'next/link';
import { statusBadge } from '@/lib/utils';

export default function WODsPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();

  const [wods,       setWods]       = useState<any[]>([]);
  const [showForm,   setShowForm]   = useState(false);
  const [editWod,    setEditWod]    = useState<any>(null);
  const [loading,    setLoading]    = useState(true);

  const fetchWods = useCallback(async () => {
    const { data } = await supabase
      .from('tournament_wods')
      .select('*')
      .eq('tournament_id', id)
      .order('order_index');
    setWods(data ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchWods(); }, [fetchWods]);

  async function deleteWod(wodId: string) {
    if (!confirm('Supprimer ce WOD ?')) return;
    await supabase.from('tournament_wods').delete().eq('id', wodId);
    fetchWods();
  }

  async function setStatus(wodId: string, status: string) {
    await supabase.from('tournament_wods').update({ status }).eq('id', wodId);
    fetchWods();
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/tournaments/${id}`} className="text-gray-400 hover:text-white transition-colors"><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <h1 className="text-xl font-black text-white">WODs du tournoi</h1>
          <p className="text-sm text-gray-400 mt-0.5">{wods.length} WOD(s)</p>
        </div>
        <button onClick={() => { setEditWod(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
          <Plus size={15} /> Ajouter un WOD
        </button>
      </div>

      {showForm && (
        <div className="bg-[#16162A] border border-white/8 rounded-2xl p-6">
          <h2 className="text-sm font-bold text-white mb-5">{editWod ? 'Modifier le WOD' : 'Nouveau WOD'}</h2>
          <WODForm
            tournamentId={id}
            initial={editWod}
            onSaved={() => { setShowForm(false); setEditWod(null); fetchWods(); }}
            onCancel={() => { setShowForm(false); setEditWod(null); }}
          />
        </div>
      )}

      {wods.length === 0 && !showForm ? (
        <div className="bg-[#16162A] border border-white/8 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">🏋️</p>
          <p className="text-white font-bold mb-1">Aucun WOD</p>
          <p className="text-sm text-gray-500">Ajoutez le premier WOD de ce tournoi.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {wods.map((w: any, idx: number) => {
            const sb = statusBadge(w.status);
            return (
              <div key={w.id} className="bg-[#16162A] border border-white/8 rounded-2xl p-5 flex items-start gap-4">
                <div className="flex items-center gap-2 text-gray-600 mt-1 shrink-0">
                  <GripVertical size={16} />
                  <span className="text-xs font-black text-gray-500">#{idx + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-bold text-white">{w.title}</p>
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: `${sb.color}20`, color: sb.color }}>{sb.label}</span>
                    <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded">{w.type} · {w.duration_minutes}min</span>
                  </div>
                  {w.description && <p className="text-xs text-gray-400 line-clamp-2">{w.description}</p>}
                  {Array.isArray(w.movements) && w.movements.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {w.movements.map((m: string, i: number) => (
                        <span key={i} className="text-[11px] bg-white/5 text-gray-300 px-2 py-0.5 rounded">{m}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {w.status === 'pending' && (
                    <button onClick={() => setStatus(w.id, 'active')} className="p-2 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors" title="Ouvrir">
                      <PlayCircle size={15} />
                    </button>
                  )}
                  {w.status === 'active' && (
                    <button onClick={() => setStatus(w.id, 'closed')} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors" title="Fermer">
                      <XCircle size={15} />
                    </button>
                  )}
                  <button onClick={() => { setEditWod(w); setShowForm(true); }} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title="Éditer">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => deleteWod(w.id)} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors" title="Supprimer">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
