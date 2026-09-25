'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Flag, Check, X, Eye, Clock, AlertTriangle,
  CheckSquare, Square, Trash2, RefreshCcw, Loader2,
} from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { chipClass } from '@/components/admin/adminTokens';

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
  harassment: 'Harcelement',
  inappropriate: 'Contenu inapproprie',
  hate: 'Discours haineux',
  cheating: 'Tricherie',
  nudity: 'Nudite',
  violence: 'Violence',
  other: 'Autre',
};

const TYPE_LABELS: Record<string, string> = {
  video: 'Video',
  message: 'Message',
  profile: 'Profil',
  comment: 'Commentaire',
  score: 'Score',
  box: 'Box',
};

// Même sens qu'avant, en jetons lisibles dans les deux thèmes.
const STATUS_STYLES: Record<ReportStatus, string> = {
  pending:   'bg-ax-warning-soft text-ax-warning border-ax-warning',
  reviewing: 'bg-ax-info-soft text-ax-info border-ax-info',
  resolved:  'bg-ax-success-soft text-ax-success border-ax-success',
  dismissed: 'bg-ax-neutral-soft text-ax-text-secondary border-ax-border',
};

const ACTION = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-ax-control border text-xs font-bold transition-[filter] hover:brightness-110 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus motion-reduce:transition-none';
const ACTION_WIDE = 'flex-1 min-w-[7rem] inline-flex items-center justify-center gap-1 py-2.5 rounded-ax-control border text-sm font-bold transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus motion-reduce:transition-none';

const STATUS_LABELS: Record<ReportStatus, string> = {
  pending:   'En attente',
  reviewing: 'En cours',
  resolved:  'Resolu',
  dismissed: 'Rejete',
};

export default function AdminReportsPage() {
  const [reports, setReports]     = useState<Report[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<ReportStatus | 'all'>('pending');
  const [selected, setSelected]   = useState<Report | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('reports')
      .select('*, reporter:profiles!reports_reporter_id_fkey(username), reported_user:profiles!reports_reported_user_id_fkey(username)')
      .order('created_at', { ascending: filter === 'pending' })
      .limit(200);
    if (filter !== 'all') query = query.eq('status', filter);
    const { data } = await query;
    setCheckedIds(new Set());
    setReports(((data ?? []) as any[]).map((r: any) => ({
      ...r,
      reporter:      Array.isArray(r.reporter)      ? r.reporter[0]      : r.reporter,
      reported_user: Array.isArray(r.reported_user) ? r.reported_user[0] : r.reported_user,
    })));
    setLoading(false);
  }, [filter, supabase]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id: string, status: ReportStatus, notes?: string) {
    const { error } = await supabase.from('reports').update({
      status,
      admin_notes: notes ?? null,
      resolved_at: (status === 'resolved' || status === 'dismissed') ? new Date().toISOString() : null,
    }).eq('id', id);
    if (!error) { setSelected(null); setAdminNotes(''); load(); }
  }

  async function bulkUpdate(status: ReportStatus) {
    if (checkedIds.size === 0) return;
    setBulkLoading(true);
    await supabase.from('reports').update({
      status,
      resolved_at: (status === 'resolved' || status === 'dismissed') ? new Date().toISOString() : null,
    }).in('id', Array.from(checkedIds));
    setBulkLoading(false);
    setCheckedIds(new Set());
    load();
  }

  const pendingCount   = reports.filter(r => r.status === 'pending').length;
  const reviewingCount = reports.filter(r => r.status === 'reviewing').length;
  const resolvedCount  = reports.filter(r => r.status === 'resolved').length;
  const allChecked     = reports.length > 0 && checkedIds.size === reports.length;

  const toggleAll = () =>
    setCheckedIds(allChecked ? new Set() : new Set(reports.map(r => r.id)));

  const toggleOne = (id: string) =>
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const FILTER_OPTS = [
    { value: 'pending',   label: 'En attente' },
    { value: 'reviewing', label: 'En cours'   },
    { value: 'resolved',  label: 'Traites'    },
    { value: 'dismissed', label: 'Rejetes'    },
    { value: 'all',       label: 'Tous'       },
  ] as const;

  return (
    // Plus de marge propre (p-8) : la zone principale de l'admin a déjà la
    // sienne ; à 390 px, la double marge serrait le contenu.
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-medium uppercase tracking-wide text-ax-text flex items-center gap-3">
          <Flag size={24} className="text-ax-danger shrink-0" />
          Signalements
        </h1>
        <p className="text-sm text-ax-text-secondary mt-1">
          Moderateur du contenu — tri par urgence (plus ancien en premier pour En attente)
        </p>
      </div>

      {/* KPI counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-ax-warning-soft border border-ax-warning rounded-ax-control px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={18} className="text-ax-warning shrink-0" />
          <div>
            <p className="text-2xl font-black text-ax-text">{pendingCount}</p>
            <p className="text-[11px] text-ax-warning font-bold uppercase tracking-wider">En attente</p>
          </div>
        </div>
        <div className="bg-ax-info-soft border border-ax-info rounded-ax-control px-4 py-3 flex items-center gap-3">
          <Clock size={18} className="text-ax-info shrink-0" />
          <div>
            <p className="text-2xl font-black text-ax-text">{reviewingCount}</p>
            <p className="text-[11px] text-ax-info font-bold uppercase tracking-wider">En cours</p>
          </div>
        </div>
        <div className="bg-ax-success-soft border border-ax-success rounded-ax-control px-4 py-3 flex items-center gap-3">
          <Check size={18} className="text-ax-success shrink-0" />
          <div>
            <p className="text-2xl font-black text-ax-text">{resolvedCount}</p>
            <p className="text-[11px] text-ax-success font-bold uppercase tracking-wider">Resolus (vue)</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={`${chipClass(filter === value)} px-4 py-2`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {checkedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-ax-surface-secondary border border-ax-border rounded-ax-control">
          <span className="text-sm font-bold text-ax-text">
            {checkedIds.size} selectionne{checkedIds.size > 1 ? 's' : ''}
          </span>
          <div className="flex flex-wrap gap-2 ml-auto">
            <button
              onClick={() => bulkUpdate('reviewing')}
              disabled={bulkLoading}
              className={`${ACTION} border-ax-info bg-ax-info-soft text-ax-info`}
            >
              {bulkLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
              En cours
            </button>
            <button
              onClick={() => bulkUpdate('dismissed')}
              disabled={bulkLoading}
              className={`${ACTION} border-ax-border bg-ax-neutral-soft text-ax-text`}
            >
              <Trash2 size={12} /> Rejeter
            </button>
            <button
              onClick={() => bulkUpdate('resolved')}
              disabled={bulkLoading}
              className={`${ACTION} border-ax-success bg-ax-success-soft text-ax-success`}
            >
              <Check size={12} /> Resoudre
            </button>
            <button
              onClick={() => setCheckedIds(new Set())}
              aria-label="Vider la sélection"
              className="p-1.5 rounded-ax-control border border-ax-border text-ax-text-secondary hover:text-ax-text hover:bg-ax-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center gap-2 text-ax-text-secondary py-8">
          <Loader2 size={18} className="animate-spin" /> Chargement...
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-ax-text-secondary">
          <Flag size={48} className="mx-auto mb-3 text-ax-text-muted" />
          <p>Aucun signalement</p>
        </div>
      ) : (
        // À 390 px, le défilement horizontal est limité au tableau : mêmes
        // colonnes, même ordre, rien de masqué.
        <Table aria-label="Signalements">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <button onClick={toggleAll} aria-label="Tout sélectionner" aria-pressed={allChecked}
                  className="rounded-ax-control text-ax-text-secondary hover:text-ax-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus">
                  {allChecked
                    ? <CheckSquare size={15} className="text-ax-accent-text" />
                    : <Square size={15} />}
                </button>
              </TableHead>
              {['Date', 'Type', 'Raison', 'Signale par', 'Utilisateur vise', 'Statut'].map(h => (
                <TableHead key={h} className="font-bold uppercase tracking-wider whitespace-nowrap">{h}</TableHead>
              ))}
              <TableHead className="font-bold uppercase tracking-wider text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((r) => (
              <TableRow
                key={r.id}
                className={checkedIds.has(r.id) ? 'bg-ax-accent-soft' : ''}
              >
                <TableCell>
                  <button onClick={() => toggleOne(r.id)} aria-label="Sélectionner" aria-pressed={checkedIds.has(r.id)}
                    className="rounded-ax-control text-ax-text-secondary hover:text-ax-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus">
                    {checkedIds.has(r.id)
                      ? <CheckSquare size={15} className="text-ax-accent-text" />
                      : <Square size={15} />}
                  </button>
                </TableCell>
                <TableCell className="text-ax-text-secondary text-xs whitespace-nowrap">
                  <Clock size={12} className="inline mr-1" />
                  {new Date(r.created_at).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                  })}
                </TableCell>
                <TableCell className="text-ax-text font-semibold whitespace-nowrap">
                  {TYPE_LABELS[r.content_type] ?? r.content_type}
                </TableCell>
                <TableCell className="text-ax-text whitespace-nowrap">
                  {REASON_LABELS[r.reason] ?? r.reason}
                </TableCell>
                <TableCell className="text-ax-text text-xs font-mono min-w-[9rem] break-words">
                  {r.reporter?.username ?? '—'}
                </TableCell>
                <TableCell className="text-ax-text text-xs font-mono min-w-[9rem] break-words">
                  {r.reported_user?.username ?? '—'}
                </TableCell>
                <TableCell>
                  <span className={`whitespace-nowrap px-2 py-1 rounded-ax-badge border text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[r.status]}`}>
                    {STATUS_LABELS[r.status]}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <button
                    onClick={() => { setSelected(r); setAdminNotes(r.admin_notes ?? ''); }}
                    className={`${ACTION} border-ax-accent-text bg-ax-accent-soft text-ax-accent-text`}
                  >
                    <Eye size={12} /> Voir
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-ax-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            role="dialog" aria-modal="true" aria-label="Detail du signalement"
            className="bg-ax-surface border border-ax-border shadow-ax-panel rounded-ax-panel max-w-xl w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-display text-xl font-medium tracking-wide text-ax-text">Detail du signalement</h2>
              <button onClick={() => setSelected(null)} aria-label="Fermer" className="rounded-ax-control p-1 text-ax-text-secondary hover:text-ax-text hover:bg-ax-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <Row label="Type"           value={TYPE_LABELS[selected.content_type] ?? selected.content_type} />
              <Row label="Raison"         value={REASON_LABELS[selected.reason] ?? selected.reason} />
              <Row label="Signale par"    value={selected.reporter?.username ?? '—'} />
              <Row label="Utilisateur vise" value={selected.reported_user?.username ?? '—'} />
              <Row label="Content ID"     value={selected.content_id ?? '—'} mono />
              <Row label="Date"           value={new Date(selected.created_at).toLocaleString('fr-FR')} />

              {selected.details && (
                <div className="pt-2 border-t border-ax-border">
                  <p className="text-xs uppercase tracking-wider text-ax-text-secondary font-bold mb-1">Contexte rapporteur</p>
                  <p className="text-ax-text bg-ax-hover p-3 rounded-ax-control text-sm whitespace-pre-wrap break-words">{selected.details}</p>
                </div>
              )}

              <div className="pt-4 border-t border-ax-border">
                <label className="text-xs uppercase tracking-wider text-ax-text-secondary font-bold block mb-2">
                  Notes admin (interne)
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Action prise, contexte..."
                  className="w-full min-w-0 rounded-ax-control border border-ax-input-border bg-ax-surface p-3 text-base text-ax-text placeholder:text-ax-text-muted sm:text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-6">
              <button
                onClick={() => updateStatus(selected.id, 'reviewing', adminNotes)}
                className={`${ACTION_WIDE} border-ax-info bg-ax-info-soft text-ax-info`}
              >
                En cours
              </button>
              <button
                onClick={() => updateStatus(selected.id, 'dismissed', adminNotes)}
                className={`${ACTION_WIDE} border-ax-border bg-ax-neutral-soft text-ax-text`}
              >
                <X size={14} /> Rejeter
              </button>
              <button
                onClick={() => updateStatus(selected.id, 'resolved', adminNotes)}
                className={`${ACTION_WIDE} border-ax-success bg-ax-success-soft text-ax-success`}
              >
                <Check size={14} /> Resolu
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
      <span className="text-ax-text-secondary shrink-0">{label}</span>
      <span className={`min-w-0 text-ax-text text-right break-words ${mono ? 'font-mono text-xs break-all' : ''}`}>{value}</span>
    </div>
  );
}
