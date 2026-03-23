'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  MapPin, Plus, Calendar, ChevronRight, Loader2, Eye,
  Trash2, ToggleRight, Image as ImageIcon, ExternalLink,
} from 'lucide-react';

interface PhysComp {
  id: string;
  name: string;
  description: string;
  date: string;
  location: string;
  status: string;
  mode: string;
  logo_url: string | null;
  registration_url: string | null;
  format: string;
  price: string | null;
  created_at: string;
}

const MODE_LABEL: Record<string, string> = {
  qualification: 'Qualification en ligne',
  info: 'Sans qualification',
};
const MODE_STYLE: Record<string, string> = {
  qualification: 'bg-purple-500/15 text-purple-400',
  info: 'bg-blue-500/15 text-blue-400',
};
const STATUS_STYLE: Record<string, string> = {
  open:   'bg-emerald-500/15 text-emerald-400',
  active: 'bg-amber-500/15 text-amber-400',
  closed: 'bg-gray-500/15 text-gray-400',
};
const STATUS_LABEL: Record<string, string> = {
  open: 'Ouvert', active: 'En cours', closed: 'Fermé',
};
const STATUS_NEXT: Record<string, string> = {
  open: 'active', active: 'closed', closed: 'closed',
};

export default function PhysicalCompetitionsPage() {
  const supabase = createClient();
  const [comps, setComps] = useState<PhysComp[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('physical_competitions')
      .select('*')
      .order('date', { ascending: false });
    setComps((data ?? []) as PhysComp[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Supprimer "${name}" ? Les WODs associés seront aussi supprimés.`)) return;
    setDeleting(id);
    await supabase.from('physical_wods').delete().eq('competition_id', id);
    await supabase.from('physical_competitions').delete().eq('id', id);
    await load();
    setDeleting(null);
  }

  async function handleAdvance(c: PhysComp) {
    const next = STATUS_NEXT[c.status];
    if (next === c.status) return;
    setAdvancing(c.id);
    await supabase.from('physical_competitions').update({ status: next }).eq('id', c.id);
    await load();
    setAdvancing(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <MapPin size={22} className="text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Compétitions Physiques</h1>
            <p className="text-sm text-gray-400">{comps.length} compétition{comps.length > 1 ? 's' : ''}</p>
          </div>
        </div>
        <Link
          href="/admin/physical-competitions/new"
          className="flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus size={16} /> Nouvelle compétition
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="text-purple-400 animate-spin" />
        </div>
      ) : comps.length === 0 ? (
        <div className="text-center py-24">
          <MapPin size={48} className="text-gray-700 mx-auto mb-4" />
          <p className="text-gray-400 font-semibold">Aucune compétition physique.</p>
          <p className="text-gray-600 text-sm mt-1">Créez votre première compétition pour commencer.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comps.map(c => (
            <div key={c.id} className="bg-[#111111] border border-white/8 rounded-2xl p-5 hover:border-white/15 transition-all">
              <div className="flex items-start gap-4">
                {/* Logo or icon */}
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0 overflow-hidden">
                  {c.logo_url ? (
                    <img src={c.logo_url} alt="" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <MapPin size={20} className="text-purple-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h2 className="text-base font-black text-white">{c.name}</h2>
                    <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md ${STATUS_STYLE[c.status] ?? 'bg-white/5 text-gray-400'}`}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                    <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md ${MODE_STYLE[c.mode] ?? 'bg-white/5 text-gray-400'}`}>
                      {MODE_LABEL[c.mode] ?? c.mode}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-white/5 text-gray-400 px-2 py-0.5 rounded-md">
                      {c.format === 'team' ? 'Équipe' : 'Individuel'}
                    </span>
                  </div>
                  {c.description && (
                    <p className="text-xs text-gray-500 mb-1 line-clamp-1">{c.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-1 flex-wrap">
                    {c.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={11} /> {c.location}
                      </span>
                    )}
                    {c.date && (
                      <span className="flex items-center gap-1">
                        <Calendar size={11} /> {new Date(c.date).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                    {c.price && (
                      <span className="text-amber-400 font-bold">{c.price}</span>
                    )}
                    {c.registration_url && (
                      <a href={c.registration_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-400 hover:underline">
                        <ExternalLink size={11} /> Inscription
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.status !== 'closed' && (
                    <button
                      onClick={() => handleAdvance(c)}
                      disabled={advancing === c.id}
                      title={`Passer à : ${STATUS_LABEL[STATUS_NEXT[c.status]]}`}
                      className="p-2 rounded-xl bg-[#0A0A0A] hover:bg-purple-500/10 text-gray-500 hover:text-purple-400 transition-colors disabled:opacity-40"
                    >
                      {advancing === c.id ? <Loader2 size={15} className="animate-spin" /> : <ToggleRight size={15} />}
                    </button>
                  )}
                  <Link
                    href={`/admin/physical-competitions/${c.id}`}
                    className="p-2 rounded-xl bg-[#0A0A0A] hover:bg-white/5 text-gray-500 hover:text-white transition-colors"
                  >
                    <Eye size={15} />
                  </Link>
                  <button
                    onClick={() => handleDelete(c.id, c.name)}
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
