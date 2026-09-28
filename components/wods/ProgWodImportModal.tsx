'use client';

import { useRef, useState } from 'react';
import { X, Loader2, FileText, Upload, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { DAY_LABELS, parseCap } from '@/lib/wodFields';
import {
  ImportedWodRow, VALID_WOD_TYPES,
  downloadWodCsvTemplate, parseWodImportFile,
} from '@/lib/wodImport';
import { countOf } from '@/lib/plural';

/**
 * Import en masse dans une programmation. Mêmes circuits que le Whiteboard —
 * même template CSV/JSON (parseur partagé, `week,day` au lieu de `date`).
 * Rien n'est écrit avant validation : la
 * répartition proposée est éditable ligne par ligne, comme l'exige un contenu
 * destiné à être vendu.
 */

interface Props {
  programmingId: string;
  weeksCount: number;
  /** Décalage de `sort_order` pour ne pas écraser l'ordre des WOD existants. */
  sortOffset: number;
  onClose: () => void;
  onImported: (count: number) => void;
}

interface PreviewRow extends ImportedWodRow {
  keep: boolean;
}

const INPUT_CLS = 'w-full px-2 py-1.5 rounded-ax-control bg-ax-overlay border border-ax-border text-xs text-ax-text';

export default function ProgWodImportModal({
  programmingId, weeksCount, sortOffset, onClose, onImported,
}: Props) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy]       = useState(false);
  const [rows, setRows]       = useState<PreviewRow[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError]     = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setWarnings([]);
    if (fileRef.current) fileRef.current.value = '';

    const text = await file.text();
    const { rows: parsed, errors } = parseWodImportFile(text, file.name, 'programming', weeksCount);
    setWarnings(errors);
    if (parsed.length === 0) {
      setRows(null);
      if (errors.length === 0) setError('Aucun WOD trouvé dans le fichier.');
      return;
    }
    setRows(parsed.map((r) => ({ ...r, keep: true })));
  }

  async function insertRows() {
    if (!rows) return;
    const keep = rows.filter((r) => r.keep);
    if (keep.length === 0) return;
    setBusy(true);
    setError(null);
    const payloads = keep.map((r, i) => ({
      programming_id: programmingId,
      week_number: r.week,
      day_of_week: r.day,
      title: r.title,
      description: r.description || null,
      wod_type: (VALID_WOD_TYPES as string[]).includes(r.type) ? r.type : 'custom',
      time_cap_seconds: parseCap(r.timeCap),
      rounds: r.rounds ? parseInt(r.rounds, 10) : null,
      notes: r.notes || null,
      block_name: r.block || null,
      leaderboard_enabled: true,
      sort_order: sortOffset + i,
    }));
    const { error: insErr } = await supabase.from('box_programming_wods').insert(payloads);
    setBusy(false);
    if (insErr) { setError(insErr.message); return; }
    onImported(keep.length);
  }

  const keptCount = rows?.filter((r) => r.keep).length ?? 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ax-overlay p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-ax-card bg-ax-surface border border-ax-border p-6"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-ax-text">Importer des WOD</h3>
          <button onClick={onClose} className="text-ax-text-muted hover:text-ax-text"><X size={18} /></button>
        </div>

        {!rows && (
          <div className="space-y-3">
            <p className="text-xs text-ax-text-secondary">
              CSV/JSON avec les colonnes <span className="text-ax-text font-semibold">week,day,title,type,description,timecap,rounds,notes,block</span>.
              La semaine et le jour restent modifiables avant l&apos;écriture.
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => downloadWodCsvTemplate('programming')}
                className="px-3 py-2 rounded-ax-control bg-ax-surface-secondary border border-ax-border text-xs font-bold text-ax-text-secondary hover:text-ax-text flex items-center gap-2">
                <FileText size={13} /> Template CSV
              </button>
              <button onClick={() => fileRef.current?.click()}
                className="px-3 py-2 rounded-ax-control bg-ax-text text-ax-background text-xs font-bold hover:brightness-110 disabled:opacity-50 flex items-center gap-2">
                <Upload size={13} /> Choisir un fichier
              </button>
              <input ref={fileRef} type="file" accept=".csv,.json" onChange={handleFile} className="hidden" />
            </div>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="mt-3 rounded-ax-control bg-ax-warning-soft border border-ax-warning px-3 py-2">
            <p className="text-xs font-bold text-ax-warning flex items-center gap-1.5">
              <AlertTriangle size={12} /> {countOf(warnings.length, 'ligne ignorée', 'lignes ignorées')}
            </p>
            {warnings.map((w, i) => <p key={i} className="text-[11px] text-ax-warning mt-0.5">{w}</p>)}
          </div>
        )}

        {error && <p className="mt-3 text-xs text-ax-danger">{error}</p>}

        {rows && (
          <div className="mt-4">
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="rounded-ax-control bg-ax-surface-secondary border border-ax-border p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <input type="checkbox" checked={r.keep} aria-label={`Importer ${r.title}`}
                      onChange={(e) => setRows((prev) => prev?.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)) ?? null)} />
                    <span className="flex-1 min-w-0 text-sm font-semibold text-ax-text break-words">{r.title}</span>
                    <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded-ax-badge bg-ax-hover text-ax-text-secondary">{r.type}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-[11px] text-ax-text-muted">Semaine</span>
                      <select value={r.week} className={INPUT_CLS}
                        onChange={(e) => setRows((prev) => prev?.map((x, j) => (j === i ? { ...x, week: Number(e.target.value) } : x)) ?? null)}>
                        {Array.from({ length: weeksCount }, (_, w) => w + 1).map((w) => (
                          <option key={w} value={w}>Semaine {w}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-ax-text-muted">Jour</span>
                      <select value={r.day} className={INPUT_CLS}
                        onChange={(e) => setRows((prev) => prev?.map((x, j) => (j === i ? { ...x, day: Number(e.target.value) } : x)) ?? null)}>
                        {DAY_LABELS.map((d, k) => <option key={d} value={k + 1}>{d}</option>)}
                      </select>
                    </label>
                  </div>
                  {r.description && (
                    <p className="text-[11px] text-ax-text-muted whitespace-pre-line break-words mt-2">{r.description}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setRows(null); setWarnings([]); }}
                className="flex-1 py-2.5 rounded-ax-control bg-ax-surface-secondary border border-ax-border text-sm font-bold text-ax-text-secondary hover:text-ax-text">
                Choisir un autre fichier
              </button>
              <button onClick={insertRows} disabled={busy || keptCount === 0}
                className="flex-1 py-2.5 rounded-ax-control bg-ax-text text-ax-background text-sm font-bold hover:brightness-110 disabled:opacity-40 flex items-center justify-center gap-2">
                {busy && <Loader2 size={14} className="animate-spin" />}
                Importer {keptCount} WOD
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
