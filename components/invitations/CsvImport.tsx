'use client';

import { useRef, useState } from 'react';
import { Download, Upload, Loader2, FileSpreadsheet, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  decodeCsv, parseInvitationsCsv, verdictLabel,
  INVITATION_CSV_TEMPLATE, IMPORT_MAX_ROWS,
  type ParsedInvitationFile,
} from '@/lib/invitationsCsv';

const supabase = createClient();

interface BulkResult {
  line: number;
  email: string;
  verdict: 'creee' | 'ignoree' | 'refusee';
  reason: string | null;
}

interface BulkReport {
  total: number;
  created: number;
  ignored: number;
  refused: number;
  results: BulkResult[];
}

const VERDICT_CLS: Record<string, string> = {
  creee: 'text-ax-success',
  ignoree: 'text-ax-text-secondary',
  refusee: 'text-ax-danger',
};

export default function CsvImport({
  boxId, plans, onImported,
}: {
  boxId: string;
  plans: Array<{ id: string; name: string }>;
  onImported: () => Promise<void> | void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedInvitationFile | null>(null);
  const [report, setReport] = useState<BulkReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  function downloadTemplate() {
    // Le BOM fait ouvrir le modèle en UTF-8 par Excel, accents compris.
    const blob = new Blob(['\uFEFF' + INVITATION_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modele-adherents-athlex.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function pick(file: File) {
    setError(null);
    setReport(null);
    setFileName(file.name);
    setParsed(parseInvitationsCsv(decodeCsv(await file.arrayBuffer()), plans));
  }

  function reset() {
    setParsed(null); setReport(null); setFileName(null); setError(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  /** Un seul appel : une coupure réseau ne laisse pas un import à moitié fait. */
  async function confirm() {
    if (!parsed) return;
    setRunning(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('create_box_invitations_bulk', {
      p_box_id: boxId,
      p_rows: parsed.rows.map(r => ({
        line: r.line,
        email: r.email,
        first_name: r.firstName || null,
        last_name: r.lastName || null,
        plan_id: r.planId,
      })),
    });
    setRunning(false);

    if (rpcError) {
      setError(rpcError.message.includes('FORBIDDEN')
        ? 'Vous n’administrez pas cette box.'
        : rpcError.message);
      return;
    }
    setReport(data as unknown as BulkReport);
    setParsed(null);
    await onImported();
  }

  return (
    <div className="bg-ax-surface border border-ax-border rounded-ax-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-ax-text flex items-center gap-2">
          <FileSpreadsheet size={15} /> Importer mes adhérents (CSV)
        </h2>
        <div className="flex items-center gap-2">
          <button type="button" onClick={downloadTemplate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-ax-control border border-ax-border text-xs font-bold text-ax-text-secondary hover:text-ax-text">
            <Download size={13} /> Télécharger le modèle CSV
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-ax-control bg-ax-text text-ax-background text-xs font-bold">
            <Upload size={13} /> Choisir un fichier
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); }} />
        </div>
      </div>

      <p className="text-xs text-ax-text-muted">
        Colonnes attendues : prénom, nom, e-mail, formule (facultative). {IMPORT_MAX_ROWS} lignes maximum.
        L’import ne crée aucun membre : chaque ligne devient une invitation, que l’adhérent accepte lui-même.
      </p>

      {error && (
        <div className="rounded-ax-control border border-ax-danger bg-ax-danger-soft px-4 py-3 text-sm text-ax-danger">{error}</div>
      )}

      {parsed && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-ax-text font-bold">
              {fileName} — {parsed.rows.length} ligne(s) lue(s) :{' '}
              <span className="text-ax-success">{parsed.ready} prête(s)</span>
              {parsed.invalid > 0 && <> · <span className="text-ax-danger">{parsed.invalid} en erreur</span></>}
            </p>
            <button type="button" onClick={reset} aria-label="Fermer" className="shrink-0 p-1 rounded-ax-control text-ax-text-muted hover:text-ax-text hover:bg-ax-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface"><X size={16} /></button>
          </div>

          {parsed.fatal ? (
            <div className="rounded-ax-control border border-ax-danger bg-ax-danger-soft px-4 py-3 text-sm text-ax-danger">{parsed.fatal}</div>
          ) : (
            <>
              <div className="max-h-72 overflow-auto rounded-ax-control border border-ax-border">
                <table className="w-full text-xs">
                  <thead className="bg-ax-surface-secondary text-ax-text-secondary sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-bold">Ligne</th>
                      <th className="text-left px-3 py-2 font-bold">Adhérent</th>
                      <th className="text-left px-3 py-2 font-bold">E-mail</th>
                      <th className="text-left px-3 py-2 font-bold">Formule</th>
                      <th className="text-left px-3 py-2 font-bold">État</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.map(r => (
                      <tr key={r.line} className="border-t border-ax-border">
                        <td className="px-3 py-1.5 text-ax-text-muted">{r.line}</td>
                        <td className="px-3 py-1.5 text-ax-text-secondary">{[r.firstName, r.lastName].filter(Boolean).join(' ') || '—'}</td>
                        <td className="px-3 py-1.5 text-ax-text-secondary">{r.email || '—'}</td>
                        <td className="px-3 py-1.5 text-ax-text-muted">{r.planLabel || 'Sans formule'}</td>
                        <td className={`px-3 py-1.5 ${r.error ? 'text-ax-danger' : 'text-ax-success'}`}>
                          {r.error ?? 'Prête'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button type="button" onClick={confirm} disabled={running || parsed.ready === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-ax-control bg-ax-text text-ax-background text-sm font-bold disabled:opacity-40">
                {running ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                Créer {parsed.ready} invitation(s)
              </button>
              <p className="text-xs text-ax-text-muted">
                Les lignes en erreur sont envoyées telles quelles : le serveur les refuse une par une, elles ne bloquent pas les autres.
              </p>
            </>
          )}
        </div>
      )}

      {report && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-ax-text font-bold">
              {report.total} ligne(s) traitée(s) : <span className="text-ax-success">{report.created} créée(s)</span> ·{' '}
              <span className="text-ax-text-secondary">{report.ignored} ignorée(s)</span> ·{' '}
              <span className="text-ax-danger">{report.refused} refusée(s)</span>
            </p>
            <button type="button" onClick={reset} aria-label="Fermer" className="shrink-0 p-1 rounded-ax-control text-ax-text-muted hover:text-ax-text hover:bg-ax-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface"><X size={16} /></button>
          </div>
          <div className="max-h-72 overflow-auto rounded-ax-control border border-ax-border">
            <table className="w-full text-xs">
              <tbody>
                {report.results.map(r => (
                  <tr key={r.line} className="border-t border-ax-border">
                    <td className="px-3 py-1.5 text-ax-text-muted w-12">{r.line}</td>
                    <td className="px-3 py-1.5 text-ax-text-secondary">{r.email}</td>
                    <td className={`px-3 py-1.5 ${VERDICT_CLS[r.verdict] ?? 'text-ax-text-secondary'}`}>
                      {verdictLabel(r.verdict, r.reason)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ax-text-muted">
            Les invitations créées apparaissent dans la liste ci-dessous : le lien et le QR s’y récupèrent, e-mail envoyé ou non.
          </p>
        </div>
      )}
    </div>
  );
}
