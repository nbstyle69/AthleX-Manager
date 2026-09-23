'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, BookmarkPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

/**
 * « Enregistrer comme semaine type » : recopie la semaine affichée du Whiteboard
 * dans une programmation interne réutilisable (`save_week_as_template`).
 *
 * La semaine type n'est pas une offre : le serveur la crée non publiée et
 * gratuite, et une contrainte en table l'empêche de devenir payante. Elle
 * s'applique ensuite depuis « Appliquer une semaine ».
 */

interface Props {
  boxId: string;
  /** Lundi (ISO) de la semaine affichée. */
  monday: string;
  onClose: () => void;
  onSaved: (summary: { title: string; wods: number; days: number; updated: boolean }) => void;
}

interface RawTemplate {
  template_id: string;
  title: string | null;
  wods_count: number | null;
}

export default function SaveWeekAsTemplateModal({ boxId, monday, onClose, onSaved }: Props) {
  const supabase = createClient();

  const [loading, setLoading]     = useState(true);
  const [templates, setTemplates] = useState<RawTemplate[]>([]);
  const [targetId, setTargetId]   = useState('');
  const [title, setTitle]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error: rpcError } = await supabase.rpc('list_week_templates', { p_box_id: boxId });
      if (rpcError) setError(rpcError.message);
      setTemplates((data ?? []) as RawTemplate[]);
      setLoading(false);
    })();
  }, [boxId]);

  async function save() {
    setSaving(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('save_week_as_template', {
      p_box_id: boxId,
      p_source_monday: monday,
      p_title: title.trim() || null,
      p_template_id: targetId || null,
    });
    setSaving(false);
    if (rpcError) { setError(rpcError.message); return; }
    const res = (data ?? {}) as { title?: string; wods?: number; days?: number };
    onSaved({
      title: res.title ?? title.trim(),
      wods: res.wods ?? 0,
      days: res.days ?? 0,
      updated: Boolean(targetId),
    });
  }

  const inp = 'w-full bg-ax-surface-secondary border border-ax-border rounded-ax-control px-4 py-3 text-sm text-ax-text focus:outline-none focus:border-ax-focus transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ax-overlay backdrop-blur-ax-glass p-4">
      <div className="bg-ax-surface border border-ax-border rounded-ax-card w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 border-b border-ax-border">
          <h2 className="text-lg font-black text-ax-text">Enregistrer comme semaine type</h2>
          <button onClick={onClose} className="p-1.5 rounded-ax-control hover:bg-ax-hover text-ax-text-secondary hover:text-ax-text transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-ax-danger-soft border border-ax-danger rounded-ax-control px-4 py-3 text-sm text-ax-danger">{error}</div>
          )}

          <p className="text-sm text-ax-text-secondary leading-relaxed">
            Les WOD de la semaine affichée sont recopiés dans une semaine réutilisable, jour par jour, time caps compris. Les WOD du calendrier ne sont pas modifiés.
          </p>

          <div>
            <label className="block text-xs font-semibold text-ax-text-secondary mb-1.5 uppercase tracking-wider">Nom</label>
            <input
              className={inp}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Semaine « force + capacité »"
            />
          </div>

          {!loading && templates.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-ax-text-secondary mb-1.5 uppercase tracking-wider">Ou écraser une semaine type existante</label>
              <select className={inp} value={targetId} onChange={e => setTargetId(e.target.value)}>
                <option value="">— Créer une nouvelle semaine type —</option>
                {templates.map(t => (
                  <option key={t.template_id} value={t.template_id}>
                    {t.title ?? 'Semaine type'} ({t.wods_count ?? 0} WOD)
                  </option>
                ))}
              </select>
              {targetId && (
                <p className="text-xs text-ax-warning mt-2">
                  Son contenu sera remplacé par la semaine affichée. Les WOD déjà posés sur des calendriers depuis cette semaine type restent en place.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end px-6 py-4 border-t border-ax-border">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-ax-control text-sm font-bold border border-ax-border text-ax-text-secondary hover:bg-ax-hover transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={save}
            disabled={saving || loading || (!targetId && !title.trim())}
            className="flex items-center gap-2 px-4 py-2.5 bg-ax-text hover:brightness-110 disabled:opacity-40 text-ax-background text-sm font-bold rounded-ax-control transition-colors"
          >
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> Enregistrement…</>
              : <><BookmarkPlus size={14} /> {targetId ? 'Écraser' : 'Enregistrer'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
