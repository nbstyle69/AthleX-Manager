'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  Globe2, Plus, Trophy, Users, Calendar, ChevronRight,
  Pencil, Trash2, Loader2, Eye, ToggleLeft, ToggleRight,
} from 'lucide-react';

interface InterComp {
  id: string;
  title: string;
  format: string;
  type: string;
  team_size: number;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  max_participants: number | null;
  created_at: string;
  reg_count: number;
  score_count: number;
}

const FORMAT_LABEL: Record<string, string> = {
  league: 'Ligue', bracket: 'Élimination', pool: 'Poules', swiss: 'Suisse',
};
const STATUS_STYLE: Record<string, string> = {
  draft:  'bg-gray-500/15 text-gray-400',
  open:   'bg-emerald-500/15 text-emerald-400',
  active: 'bg-white/15 text-white',
  closed: 'bg-blue-500/15 text-blue-400',
};
const STATUS_LABEL: Record<string, string> = {
  draft: 'Brouillon', open: 'Ouvert', active: 'En cours', closed: 'Terminé',
};
const STATUS_NEXT: Record<string, string> = {
  draft: 'open', open: 'active', active: 'closed', closed: 'closed',
};

export default function InterCompetitionsPage() {
  const supabase = createClient();
  const [comps, setComps] = useState<InterComp[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('inter_competitions')
      .select('*')
      .order('created_at', { ascending: false });

    const list = await Promise.all((data ?? []).map(async (c: any) => {
      const [{ count: reg_count }, { count: score_count }] = await Promise.all([
        supabase.from('inter_registrations').select('*', { count: 'exact', head: true }).eq('competition_id', c.id),
        supabase.from('inter_scores').select('*', { count: 'exact', head: true }).eq('competition_id', c.id),
      ]);
      return { ...c, reg_count: reg_count ?? 0, score_count: score_count ?? 0 };
    }));
    setComps(list);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Supprimer "${title}" ? Cette action est irréversible.`)) return;
    setDeleting(id);
    await supabase.from('inter_competitions').delete().eq('id', id);
    await load();
    setDeleting(null);
  }

  async function handleAdvance(c: InterComp) {
    const next = STATUS_NEXT[c.status];
    if (next === c.status) return;
    setAdvancing(c.id);
    await fetch('/api/admin/inter-competitions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'advance', competition_id: c.id }),
    });
    await load();
    setAdvancing(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Globe2 size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Compétitions Inter-box</h1>
            <p className="text-sm text-gray-400">{comps.length} compétition{comps.length > 1 ? 's' : ''}</p>
          </div>
        </div>
        <Link
          href="/admin/inter-competitions/new"
          className="flex items-center gap-2 bg-white hover:bg-[#B8911F] text-[#0A0A0A] text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus size={16} /> Nouvelle compétition
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="text-white animate-spin" />
        </div>
      ) : comps.length === 0 ? (
        <div className="text-center py-24">
          <Globe2 size={48} className="text-gray-700 mx-auto mb-4" />
          <p className="text-gray-400 font-semibold">Aucune compétition inter-box.</p>
          <p className="text-gray-600 text-sm mt-1">Créez votre première compétition pour commencer.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comps.map(c => (
            <div key={c.id} className="bg-[#111111] border border-white/8 rounded-2xl p-5 hover:border-white/15 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Globe2 size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h2 className="text-base font-black text-white">{c.title}</h2>
                    <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md ${STATUS_STYLE[c.status] ?? 'bg-white/5 text-gray-400'}`}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-white/5 text-gray-400 px-2 py-0.5 rounded-md">
                      {FORMAT_LABEL[c.format] ?? c.format}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-white/5 text-gray-400 px-2 py-0.5 rounded-md">
                      {c.type === 'individual' ? 'Individuel' : `Équipe ×${c.team_size}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-1 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Users size={11} /> {c.reg_count}{c.max_participants ? `/${c.max_participants}` : ''} inscrits
                    </span>
                    <span className="flex items-center gap-1">
                      <Trophy size={11} /> {c.score_count} scores
                    </span>
                    {c.starts_at && (
                      <span className="flex items-center gap-1">
                        <Calendar size={11} /> {new Date(c.starts_at).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Advance status */}
                  {c.status !== 'closed' && (
                    <button
                      onClick={() => handleAdvance(c)}
                      disabled={advancing === c.id}
                      title={`Passer à : ${STATUS_LABEL[STATUS_NEXT[c.status]]}`}
                      className="p-2 rounded-xl bg-[#0A0A0A] hover:bg-white/10 text-gray-500 hover:text-white transition-colors disabled:opacity-40"
                    >
                      {advancing === c.id
                        ? <Loader2 size={15} className="animate-spin" />
                        : <ToggleRight size={15} />
                      }
                    </button>
                  )}
                  {/* View detail */}
                  <Link
                    href={`/admin/inter-competitions/${c.id}`}
                    className="p-2 rounded-xl bg-[#0A0A0A] hover:bg-white/5 text-gray-500 hover:text-white transition-colors"
                  >
                    <Eye size={15} />
                  </Link>
                  {/* Edit */}
                  <Link
                    href={`/admin/inter-competitions/new?edit=${c.id}`}
                    className="p-2 rounded-xl bg-[#0A0A0A] hover:bg-white/5 text-gray-500 hover:text-white transition-colors"
                  >
                    <Pencil size={15} />
                  </Link>
                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(c.id, c.title)}
                    disabled={deleting === c.id}
                    className="p-2 rounded-xl bg-[#0A0A0A] hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-40"
                  >
                    {deleting === c.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
