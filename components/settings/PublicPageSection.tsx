'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { writeFailure } from '@/lib/writeGuard';
import { SITE_URL } from '@/lib/site-url';
import { Globe, Pencil, Eye, Copy, Check } from 'lucide-react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { ERROR_TITLE } from '@/lib/confirmDialog';
import { Button } from '@/components/ui/button';

/** Adresse publique de la box (`/box/<slug>`), où les offres sont vendues. */
export default function PublicPageSection({ boxId }: { boxId: string | null }) {
  const { dialog, inform } = useConfirmDialog();
  const supabase = createClient();
  const [slug, setSlug] = useState('');
  const [slugSaved, setSlugSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!boxId) return;
    let annule = false;
    (async () => {
      const { data } = await supabase.from('boxes').select('slug').eq('id', boxId).maybeSingle();
      if (annule) return;
      const value = (data?.slug as string | null) ?? '';
      setSlug(value);
      setSlugSaved(value);
    })();
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxId]);

  async function saveSlug() {
    if (!boxId || !slug.trim()) return;
    setSaving(true);
    const clean = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/--+/g, '-');
    const { data, error } = await supabase
      .from('boxes').update({ slug: clean }).eq('id', boxId).select('id');
    const fail = writeFailure(error, data);
    if (fail) inform({ kind: 'error', title: ERROR_TITLE, body: `Impossible d'enregistrer l'adresse publique : ${fail}` });
    else { setSlug(clean); setSlugSaved(clean); setEditing(false); }
    setSaving(false);
  }

  function copyUrl() {
    navigator.clipboard.writeText(`${SITE_URL}/box/${slugSaved}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-ax-surface border border-ax-border rounded-ax-card p-6 space-y-5">
      {dialog}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Globe size={15} className="text-ax-success" />
          <h2 className="text-sm font-bold text-ax-text">Page publique</h2>
        </div>
        <p className="text-xs text-ax-text-muted">
          L&apos;adresse où les athlètes découvrent ta box et souscrivent tes offres.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center bg-ax-hover rounded-ax-control border border-ax-border overflow-hidden flex-1">
          <span className="text-xs text-ax-text-muted pl-3 pr-1 whitespace-nowrap">{SITE_URL}/box/</span>
          <input
            className={`flex-1 bg-transparent text-sm py-2.5 pr-3 outline-none font-semibold ${editing ? 'text-ax-text' : 'text-ax-text-secondary'}`}
            value={slug}
            onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="mon-slug"
            readOnly={!editing}
          />
        </div>
        {editing ? (
          <div className="flex items-center gap-2">
            <button onClick={() => { setSlug(slugSaved); setEditing(false); }} className="px-3 py-2.5 rounded-ax-control text-sm font-bold text-ax-text-secondary hover:text-ax-text hover:bg-ax-hover transition-all whitespace-nowrap">Annuler</button>
            <Button onClick={saveSlug} disabled={saving || slug === slugSaved || !slug.trim()} variant="ax-mint" className="whitespace-nowrap">{saving ? '...' : 'Enregistrer'}</Button>
          </div>
        ) : (
          <Button onClick={() => setEditing(true)} variant="ax-outline" className="whitespace-nowrap"><Pencil size={14} /> Modifier</Button>
        )}
      </div>

      {slugSaved && (
        <div className="flex items-center gap-3">
          <a href={`${SITE_URL}/box/${slugSaved}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-ax-success hover:text-ax-success font-semibold transition-colors"><Eye size={13} /> Voir ma page</a>
          <button onClick={copyUrl} className="flex items-center gap-1.5 text-xs text-ax-text-muted hover:text-ax-text font-semibold transition-colors">
            {copied ? <Check size={13} className="text-ax-success" /> : <Copy size={13} />}
            {copied ? 'Copié !' : 'Copier le lien'}
          </button>
        </div>
      )}
    </div>
  );
}
