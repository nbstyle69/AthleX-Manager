'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  BookOpen, Plus, Pencil, Trash2, ExternalLink, X, Globe,
  Link2, Upload, Eye, Copy, Check,
} from 'lucide-react';

interface BoxProgram {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  url: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

const EMPTY_FORM = {
  name: '',
  description: '',
  price: '' as string,
  currency: 'EUR',
  url: '',
  is_active: true,
  sort_order: 0,
};

const SITE_BASE_URL = 'https://athlex-hub.vercel.app';

export default function BoxOwnerProgramsPage() {
  const supabase = createClient();
  const [boxId, setBoxId] = useState<string | null>(null);
  const [slug, setSlug] = useState<string>('');
  const [slugSaved, setSlugSaved] = useState<string>('');
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugCopied, setSlugCopied] = useState(false);

  const [programs, setPrograms] = useState<BoxProgram[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get box
    const { data: box } = await supabase
      .from('boxes')
      .select('id, slug')
      .eq('owner_id', user.id)
      .limit(1)
      .single();

    if (!box) { setLoading(false); return; }

    setBoxId(box.id);
    setSlug((box as any).slug ?? '');
    setSlugSaved((box as any).slug ?? '');

    // Get programs
    const { data: progs } = await (supabase.from as any)('box_programs')
      .select('*')
      .eq('box_id', box.id)
      .order('sort_order', { ascending: true });

    setPrograms((progs ?? []) as BoxProgram[]);
    setLoading(false);
  }

  async function saveSlug() {
    if (!boxId || !slug.trim()) return;
    setSlugSaving(true);
    const clean = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/--+/g, '-');
    const { error } = await supabase
      .from('boxes')
      .update({ slug: clean })
      .eq('id', boxId);
    if (!error) {
      setSlug(clean);
      setSlugSaved(clean);
    }
    setSlugSaving(false);
  }

  function copyUrl() {
    navigator.clipboard.writeText(`${SITE_BASE_URL}/box/${slugSaved}`);
    setSlugCopied(true);
    setTimeout(() => setSlugCopied(false), 2000);
  }

  function openNew() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setShowForm(true);
  }

  function openEdit(p: BoxProgram) {
    setEditId(p.id);
    setForm({
      name: p.name,
      description: p.description ?? '',
      price: p.price != null ? String(p.price) : '',
      currency: p.currency,
      url: p.url,
      is_active: p.is_active,
      sort_order: p.sort_order,
    });
    setImageFile(null);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.url.trim() || !boxId) return;
    setSaving(true);

    let image_url: string | undefined;

    if (imageFile) {
      const ext = imageFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const fileName = `${boxId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('box-program-images')
        .upload(fileName, imageFile, { contentType: imageFile.type, upsert: true });
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('box-program-images').getPublicUrl(fileName);
        image_url = urlData.publicUrl;
      }
    }

    const payload: any = {
      box_id: boxId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: form.price ? parseFloat(form.price) : null,
      currency: form.currency,
      url: form.url.trim(),
      is_active: form.is_active,
      sort_order: form.sort_order,
    };
    if (image_url) payload.image_url = image_url;

    if (editId) {
      await (supabase.from as any)('box_programs').update(payload).eq('id', editId);
    } else {
      await (supabase.from as any)('box_programs').insert(payload);
    }

    setSaving(false);
    setShowForm(false);
    loadAll();
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce programme ?')) return;
    await (supabase.from as any)('box_programs').delete().eq('id', id);
    loadAll();
  }

  const formatPrice = (price: number | null, currency: string) => {
    if (price == null) return 'Gratuit';
    const sym = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;
    return `${price.toFixed(2)}${sym}/mois`;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white">Programmation</h1>
        <p className="text-sm text-gray-500 mt-1">Gérez vos programmes et votre page publique</p>
      </div>

      {/* Slug / Public page */}
      <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Globe size={16} className="text-emerald-400" />
          <h2 className="text-sm font-black text-white uppercase tracking-widest">Page publique</h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white/5 rounded-xl border border-white/10 overflow-hidden flex-1">
            <span className="text-xs text-gray-500 pl-3 pr-1 whitespace-nowrap">{SITE_BASE_URL}/box/</span>
            <input
              className="flex-1 bg-transparent text-sm text-white py-2.5 pr-3 outline-none font-semibold"
              value={slug}
              onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="mon-slug"
            />
          </div>
          <button
            onClick={saveSlug}
            disabled={slugSaving || slug === slugSaved || !slug.trim()}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white text-sm font-bold transition-all whitespace-nowrap"
          >
            {slugSaving ? '...' : 'Enregistrer'}
          </button>
        </div>

        {slugSaved && (
          <div className="flex items-center gap-3 mt-3">
            <a
              href={`${SITE_BASE_URL}/box/${slugSaved}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
            >
              <Eye size={13} /> Voir ma page
            </a>
            <button
              onClick={copyUrl}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white font-semibold transition-colors"
            >
              {slugCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              {slugCopied ? 'Copié !' : 'Copier le lien'}
            </button>
          </div>
        )}
      </div>

      {/* Programs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-white">Mes programmes</h2>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all"
          >
            <Plus size={16} /> Ajouter
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500">Chargement…</div>
        ) : programs.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen size={40} className="mx-auto text-gray-600 mb-3" />
            <p className="text-gray-500 text-sm">Aucun programme</p>
            <p className="text-gray-600 text-xs mt-1">Ajoutez vos programmes pour qu'ils apparaissent sur votre page publique</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {programs.map(p => (
              <div key={p.id} className="flex items-center gap-4 bg-[#111] border border-white/[0.06] rounded-2xl p-4">
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="w-16 h-16 rounded-xl object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <BookOpen size={22} className="text-emerald-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white truncate">{p.name}</span>
                    {!p.is_active && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 font-semibold">
                        Inactif
                      </span>
                    )}
                  </div>
                  {p.description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{p.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs font-black text-emerald-400">
                      {formatPrice(p.price, p.currency)}
                    </span>
                    <a
                      href={p.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-white transition-colors"
                    >
                      <ExternalLink size={10} /> {p.url.replace(/^https?:\/\//, '').slice(0, 30)}
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEdit(p)}
                    className="p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-all"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-all"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#111] border border-white/[0.06] rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-white">
                {editId ? 'Modifier le programme' : 'Nouveau programme'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 mb-1 block">Nom *</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Nom du programme"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 mb-1 block">Description</label>
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50 min-h-[80px]"
                  value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Décrivez votre programme…"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 mb-1 block">Image</label>
                <input
                  type="file" accept="image/*"
                  className="w-full text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-emerald-500/10 file:text-emerald-400 hover:file:bg-emerald-500/20"
                  onChange={e => setImageFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Prix (€/mois)</label>
                  <input
                    type="number" step="0.01"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                    value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                    placeholder="0 = Gratuit"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Devise</label>
                  <select
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                    value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 mb-1 block">Lien d'achat *</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                  value={form.url} onChange={e => setForm({ ...form, url: e.target.value })}
                  placeholder="https://…"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Ordre</label>
                  <input
                    type="number"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                    value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox" checked={form.is_active}
                      onChange={e => setForm({ ...form, is_active: e.target.checked })}
                      className="w-4 h-4 rounded accent-emerald-500"
                    />
                    <span className="text-sm text-gray-300 font-semibold">Actif</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.url.trim()}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold transition-all"
              >
                {saving ? 'Enregistrement…' : editId ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
