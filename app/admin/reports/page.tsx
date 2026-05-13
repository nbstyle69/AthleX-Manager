'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Flag, Check, X, Eye, Clock, AlertTriangle } from 'lucide-react';

type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';

interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  content_type: string;
  content_id: string | null;
  reason: string;
  details: string | null;
  status: ReportStatus;
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  reporter: { username: string } | null;
  reported_user: { username: string } | null;
}

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Harcèlement',
  inappropriate: 'Contenu inapproprié',
  hate: 'Discours haineux',
  cheating: 'Tricherie',
  nudity: 'Nudité',
  violence: 'Violence',
  other: 'Autre',
};

const TYPE_LABELS: Record<string, string> = {
  video: 'Vidéo',
  message: 'Message',
  profile: 'Profil',
  comment: 'Commentaire',
  score: 'Score',
  box: 'Box',
};

const STATUS_STYLES: Record<ReportStatus, string> = {
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  reviewing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  resolved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  dismissed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReportStatus | 'all'>('pending');
  const [selected, setSelected] = useState<Report | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    let query = (supabase.from as any)('reports')
      .select('*, reporter:profiles!reports_reporter_id_fkey(username), reported_user:profiles!reports_reported_user_id_fkey(username)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (filter !== 'all') query = query.eq('status', filter);
    const { data } = await query;
    setReports(((data ?? []) as any[]).map((r: any) => ({
      ...r,
      reporter: Array.isArray(r.reporter) ? r.reporter[0] : r.reporter,
      reported_user: Array.isArray(r.reported_user) ? r.reported_user[0] : r.reported_user,
    })));
    setLoading(false);
  }, [filter, supabase]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id: string, status: ReportStatus, notes?: string) {
    const { error } = await (supabase.from as any)('reports')
      .update({
        status,
        admin_notes: notes ?? null,
        resolved_at: (status === 'resolved' || status === 'dismissed') ? new Date().toISOString() : null,
      })
      .eq('id', id);
    if (!error) {
      setSelected(null);
      setAdminNotes('');
      load();
    }
  }

  const pendingCount = reports.filter(r => r.status === 'pending').length;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <Flag size={24} className="text-red-400" />
            Signalements
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Modération du contenu utilisateur (conformité App Store Guideline 1.2)
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="px-4 py-2 bg-amber-500/20 border border-amber-500/30 rounded-xl">
            <p className="text-amber-400 font-bold text-sm">
              <AlertTriangle size={14} className="inline mr-1" />
              {pendingCount} en attente
            </p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(['pending', 'reviewing', 'resolved', 'dismissed', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition ${
              filter === f
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
            }`}
          >
            {f === 'all' ? 'Tous' : f === 'pending' ? 'En attente' : f === 'reviewing' ? 'En cours' : f === 'resolved' ? 'Traités' : 'Rejetés'}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-gray-400">Chargement…</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Flag size={48} className="mx-auto mb-3 opacity-30" />
          <p>Aucun signalement</p>
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] border-b border-white/[0.06]">
              <tr className="text-left text-xs uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3 font-bold">Date</th>
                <th className="px-4 py-3 font-bold">Type</th>
                <th className="px-4 py-3 font-bold">Raison</th>
                <th className="px-4 py-3 font-bold">Signalé par</th>
                <th className="px-4 py-3 font-bold">Utilisateur visé</th>
                <th className="px-4 py-3 font-bold">Statut</th>
                <th className="px-4 py-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    <Clock size={12} className="inline mr-1" />
                    {new Date(r.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-white font-semibold">{TYPE_LABELS[r.content_type] ?? r.content_type}</td>
                  <td className="px-4 py-3 text-gray-300">{REASON_LABELS[r.reason] ?? r.reason}</td>
                  <td className="px-4 py-3 text-gray-300">{r.reporter?.username ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-300">{r.reported_user?.username ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => { setSelected(r); setAdminNotes(r.admin_notes ?? ''); }}
                      className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-xs font-bold inline-flex items-center gap-1"
                    >
                      <Eye size={12} /> Voir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-[#0f0f10] border border-white/10 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-white">Détail du signalement</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>

            <div className="space-y-3 text-sm">
              <Row label="Type" value={TYPE_LABELS[selected.content_type]} />
              <Row label="Raison" value={REASON_LABELS[selected.reason]} />
              <Row label="Signalé par" value={selected.reporter?.username ?? '—'} />
              <Row label="Utilisateur visé" value={selected.reported_user?.username ?? '—'} />
              <Row label="Content ID" value={selected.content_id ?? '—'} mono />
              <Row label="Date" value={new Date(selected.created_at).toLocaleString('fr-FR')} />
              {selected.details && (
                <div className="pt-2 border-t border-white/10">
                  <p className="text-xs uppercase tracking-wider text-gray-400 font-bold mb-1">Détails rapporteur</p>
                  <p className="text-gray-200 bg-white/5 p-3 rounded-lg">{selected.details}</p>
                </div>
              )}

              <div className="pt-4 border-t border-white/10">
                <label className="text-xs uppercase tracking-wider text-gray-400 font-bold block mb-2">Notes admin (interne)</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Action prise, contexte..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white text-sm resize-none"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => updateStatus(selected.id, 'reviewing', adminNotes)}
                className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-bold py-2.5 rounded-xl text-sm"
              >
                Marquer en cours
              </button>
              <button
                onClick={() => updateStatus(selected.id, 'dismissed', adminNotes)}
                className="flex-1 bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 font-bold py-2.5 rounded-xl text-sm inline-flex items-center justify-center gap-1"
              >
                <X size={14} /> Rejeter
              </button>
              <button
                onClick={() => updateStatus(selected.id, 'resolved', adminNotes)}
                className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold py-2.5 rounded-xl text-sm inline-flex items-center justify-center gap-1"
              >
                <Check size={14} /> Résolu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className={`text-white text-right ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}
