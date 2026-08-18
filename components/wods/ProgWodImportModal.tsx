'use client';

import { useRef, useState } from 'react';
import { X, Loader2, FileText, Upload, Sparkles, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { DAY_LABELS, formatCap, parseCap } from '@/lib/wodFields';
import {
  ImportedWodRow, VALID_WOD_TYPES, dateToWeekDay,
  downloadWodCsvTemplate, parseWodImportFile,
} from '@/lib/wodImport';

/**
 * Import en masse dans une programmation. Mêmes circuits que le Whiteboard —
 * même template CSV/JSON (parseur partagé, `week,day` au lieu de `date`) et
 * même analyse PDF par IA (`parse-wod-pdf`, qui rend des WOD datés qu'on
 * convertit en semaine × jour). Rien n'est écrit avant validation : la
 * répartition proposée est éditable ligne par ligne, comme l'exige un contenu
 * destiné à être vendu.
 */

interface Props {
  programmingId: string;
  boxId: string;
  weeksCount: number;
  /** Décalage de `sort_order` pour ne pas écraser l'ordre des WOD existants. */
  sortOffset: number;
  onClose: () => void;
  onImported: (count: number) => void;
}

interface PreviewRow extends ImportedWodRow {
  keep: boolean;
}

interface ParsedPdfWod {
  scheduled_date: string;
  title: string;
  wod_type: string;
  description: string | null;
  time_cap_seconds: number | null;
  rounds: number | null;
  notes: string | null;
  block_name: string | null;
}

const INPUT_CLS = 'w-full px-2 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white';

function mondayOfToday(): string {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(((reader.result as string) ?? '').split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function ProgWodImportModal({
  programmingId, boxId, weeksCount, sortOffset, onClose, onImported,
}: Props) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy]       = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [rows, setRows]       = useState<PreviewRow[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError]     = useState<string | null>(null);
  const [aiSource, setAiSource] = useState(false);

  function clampWeek(n: number): number {
    return Math.min(weeksCount, Math.max(1, n));
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setWarnings([]);
    if (fileRef.current) fileRef.current.value = '';

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      await analyzePdf(file);
      return;
    }

    const text = await file.text();
    const { rows: parsed, errors } = parseWodImportFile(text, file.name, 'programming', weeksCount);
    setWarnings(errors);
    setAiSource(false);
    if (parsed.length === 0) {
      setRows(null);
      if (errors.length === 0) setError('Aucun WOD trouvé dans le fichier.');
      return;
    }
    setRows(parsed.map((r) => ({ ...r, keep: true })));
  }

  /**
   * Le PDF passe par l'edge function existante, qui raisonne en dates : on lui
   * donne un lundi de référence et on retraduit sa sortie en semaine × jour.
   */
  async function analyzePdf(file: File) {
    try {
      setAnalyzing(true);
      const pdfBase64 = await fileToBase64(file);
      const start = mondayOfToday();
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const res = await fetch(`${supabaseUrl}/functions/v1/parse-wod-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ box_id: boxId, pdf_base64: pdfBase64, default_start_date: start }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string })?.error ?? `HTTP ${res.status}`);
      const parsed = (json as { wods?: ParsedPdfWod[] })?.wods ?? [];
      if (parsed.length === 0) {
        setRows(null);
        setError('Aucun WOD détecté dans le PDF.');
        return;
      }
      setAiSource(true);
      setRows(parsed.map((w) => {
        const { week, day } = dateToWeekDay(w.scheduled_date, start);
        return {
          keep: true,
          title: w.title,
          type: w.wod_type,
          description: w.description ?? '',
          // mm:ss plutôt qu'un arrondi minute : le cap de l'IA arrive en secondes
          // et doit traverser la prévisualisation sans perdre ses secondes.
          timeCap: formatCap(w.time_cap_seconds),
          rounds: w.rounds != null ? String(w.rounds) : '',
          notes: w.notes ?? '',
          block: w.block_name ?? '',
          published: true,
          rank: true,
          groupNames: [],
          date: w.scheduled_date,
          week: clampWeek(week),
          day,
        };
      }));
    } catch (e) {
      setRows(null);
      setError(`Erreur IA : ${e instanceof Error ? e.message : 'analyse PDF impossible'}`);
    } finally {
      setAnalyzing(false);
    }
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#111] border border-white/10 p-6"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-white">Importer des WOD</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>

        {!rows && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">
              CSV/JSON avec les colonnes <span className="text-white font-semibold">week,day,title,type,description,timecap,rounds,notes,block</span>,
              ou un PDF analysé par l&apos;IA. La semaine et le jour restent modifiables avant l&apos;écriture.
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => downloadWodCsvTemplate('programming')}
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-gray-300 hover:text-white flex items-center gap-2">
                <FileText size={13} /> Template CSV
              </button>
              <button onClick={() => fileRef.current?.click()} disabled={analyzing}
                className="px-3 py-2 rounded-xl bg-white text-black text-xs font-bold hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2">
                {analyzing ? <><Loader2 size={13} className="animate-spin" /> Analyse du PDF…</> : <><Upload size={13} /> Choisir un fichier</>}
              </button>
              <input ref={fileRef} type="file" accept=".csv,.json,.pdf" onChange={handleFile} className="hidden" />
            </div>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="mt-3 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2">
            <p className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <AlertTriangle size={12} /> {warnings.length} ligne(s) ignorée(s)
            </p>
            {warnings.map((w, i) => <p key={i} className="text-[11px] text-amber-400/80 mt-0.5">{w}</p>)}
          </div>
        )}

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        {rows && (
          <div className="mt-4">
            {aiSource && (
              <p className="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
                <Sparkles size={12} className="text-white" />
                Répartition proposée par l&apos;IA depuis les dates du PDF — vérifiez semaine et jour avant d&apos;importer.
              </p>
            )}
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="rounded-xl bg-white/[0.03] border border-white/10 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <input type="checkbox" checked={r.keep} aria-label={`Importer ${r.title}`}
                      onChange={(e) => setRows((prev) => prev?.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)) ?? null)} />
                    <span className="flex-1 text-sm font-semibold text-white truncate">{r.title}</span>
                    <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-white/10 text-gray-300">{r.type}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-[11px] text-gray-500">Semaine</span>
                      <select value={r.week} className={INPUT_CLS}
                        onChange={(e) => setRows((prev) => prev?.map((x, j) => (j === i ? { ...x, week: Number(e.target.value) } : x)) ?? null)}>
                        {Array.from({ length: weeksCount }, (_, w) => w + 1).map((w) => (
                          <option key={w} value={w}>Semaine {w}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-gray-500">Jour</span>
                      <select value={r.day} className={INPUT_CLS}
                        onChange={(e) => setRows((prev) => prev?.map((x, j) => (j === i ? { ...x, day: Number(e.target.value) } : x)) ?? null)}>
                        {DAY_LABELS.map((d, k) => <option key={d} value={k + 1}>{d}</option>)}
                      </select>
                    </label>
                  </div>
                  {r.description && (
                    <p className="text-[11px] text-gray-500 whitespace-pre-line line-clamp-3 mt-2">{r.description}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setRows(null); setWarnings([]); }}
                className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-gray-300 hover:text-white">
                Choisir un autre fichier
              </button>
              <button onClick={insertRows} disabled={busy || keptCount === 0}
                className="flex-1 py-2.5 rounded-xl bg-white text-black text-sm font-bold hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center gap-2">
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
