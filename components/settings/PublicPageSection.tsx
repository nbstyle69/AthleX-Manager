'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { writeFailure } from '@/lib/writeGuard';
import { SITE_URL } from '@/lib/site-url';
import { Globe, Pencil, Eye, Copy, Check } from 'lucide-react';

/** Adresse publique de la box (`/box/<slug>`), où les offres sont vendues. */
export default function PublicPageSection({ boxId }: { boxId: string | null }) {
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
    if (fail) alert(`Impossible d'enregistrer l'adresse publique : ${fail}`);
    else { setSlug(clean); setSlugSaved(clean); setEditing(false); }
    setSaving(false);
  }

  function copyUrl() {
    navigator.clipboard.writeText(`${SITE_URL}/box/${slugSaved}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-6 space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Globe size={15} className="text-emerald-400" />
          <h2 className="text-sm font-bold text-white">Page publique</h2>
        </div>
        <p className="text-xs text-gray-500">
          L&apos;adresse où les athlètes découvrent ta box et souscrivent tes offres.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center bg-white/5 rounded-xl border border-white/10 overflow-hidden flex-1">
          <span className="text-xs text-gray-500 pl-3 pr-1 whitespace-nowrap">{SITE_URL}/box/</span>
          <input
            className={`flex-1 bg-transparent text-sm py-2.5 pr-3 outline-none font-semibold ${editing ? 'text-white' : 'text-gray-400'}`}
            value={slug}
            onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="mon-slug"
            readOnly={!editing}
          />
        </div>
        {editing ? (
          <div className="flex items-center gap-2">
            <button onClick={() => { setSlug(slugSaved); setEditing(false); }} className="px-3 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all whitespace-nowrap">Annuler</button>
            <button onClick={saveSlug} disabled={saving || slug === slugSaved || !slug.trim()} className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white text-sm font-bold transition-all whitespace-nowrap">{saving ? '...' : 'Enregistrer'}</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-bold transition-all whitespace-nowrap"><Pencil size={14} /> Modifier</button>
        )}
      </div>

      {slugSaved && (
        <div className="flex items-center gap-3">
          <a href={`${SITE_URL}/box/${slugSaved}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"><Eye size={13} /> Voir ma page</a>
          <button onClick={copyUrl} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white font-semibold transition-colors">
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            {copied ? 'Copié !' : 'Copier le lien'}
          </button>
        </div>
      )}
    </div>
  );
}
