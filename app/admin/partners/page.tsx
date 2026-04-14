'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Pencil, Trash2, Handshake, Globe, Tag, X } from 'lucide-react';

interface Partner {
  id: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  website_url: string | null;
  instagram_url: string | null;
  offer_title: string | null;
  offer_description: string | null;
  offer_code: string | null;
  category: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

const CATEGORIES = [
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'equipment', label: 'Équipement' },
  { value: 'apparel', label: 'Vêtements' },
  { value: 'supplements', label: 'Compléments' },
  { value: 'recovery', label: 'Récupération' },
  { value: 'coaching', label: 'Coaching' },
  { value: 'software', label: 'Logiciel' },
  { value: 'other', label: 'Autres' },
];

const emptyForm = {
  name: '',
  description: '',
  website_url: '',
  instagram_url: '',
  offer_title: '',
  offer_description: '',
  offer_code: '',
  category: 'other',
  is_active: true,
  sort_order: 0,
};

export default function PartnersAdminPage() {
  const supabase = createClient();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => { loadPartners(); }, []);

  async function loadPartners() {
    const { data } = await supabase
      .from('partners')
      .select('*')
      .order('sort_order', { ascending: true });
    setPartners((data ?? []) as Partner[]);
    setLoading(false);
  }

  function openNew() {
    setEditId(null);
    setForm(emptyForm);
    setLogoFile(null);
    setShowForm(true);
  }

  function openEdit(p: Partner) {
    setEditId(p.id);
    setForm({
      name: p.name,
      description: p.description ?? '',
      website_url: p.website_url ?? '',
      instagram_url: p.instagram_url ?? '',
      offer_title: p.offer_title ?? '',
      offer_description: p.offer_description ?? '',
      offer_code: p.offer_code ?? '',
      category: p.category,
      is_active: p.is_active,
      sort_order: p.sort_order,
    });
    setLogoFile(null);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);

    let logo_url: string | undefined;

    if (logoFile) {
      const ext = logoFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const fileName = `${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('partner-logos')
        .upload(fileName, logoFile, { contentType: logoFile.type, upsert: true });
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('partner-logos').getPublicUrl(fileName);
        logo_url = urlData.publicUrl;
      }
    }

    const payload: any = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      website_url: form.website_url.trim() || null,
      instagram_url: form.instagram_url.trim() || null,
      offer_title: form.offer_title.trim() || null,
      offer_description: form.offer_description.trim() || null,
      offer_code: form.offer_code.trim() || null,
      category: form.category,
      is_active: form.is_active,
      sort_order: form.sort_order,
    };
    if (logo_url) payload.logo_url = logo_url;

    if (editId) {
      await supabase.from('partners').update(payload).eq('id', editId);
    } else {
      await supabase.from('partners').insert(payload);
    }

    setSaving(false);
    setShowForm(false);
    loadPartners();
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce partenaire ?')) return;
    await supabase.from('partners').delete().eq('id', id);
    loadPartners();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Partenaires</h1>
          <p className="text-sm text-gray-500 mt-1">Gérez les marques et offres partenaires visibles dans l'app</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all"
        >
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">Chargement…</div>
      ) : partners.length === 0 ? (
        <div className="text-center py-20">
          <Handshake size={40} className="mx-auto text-gray-600 mb-3" />
          <p className="text-gray-500">Aucun partenaire</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {partners.map(p => (
            <div key={p.id} className="flex items-center gap-4 bg-[#111] border border-white/[0.06] rounded-2xl p-4">
              {p.logo_url ? (
                <img src={p.logo_url} alt="" className="w-12 h-12 rounded-xl object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Handshake size={20} className="text-emerald-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white truncate">{p.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-gray-400 font-semibold">
                    {CATEGORIES.find(c => c.value === p.category)?.label ?? p.category}
                  </span>
                  {!p.is_active && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 font-semibold">
                      Inactif
                    </span>
                  )}
                </div>
                {p.offer_title && (
                  <div className="flex items-center gap-1 mt-1">
                    <Tag size={11} className="text-emerald-400" />
                    <span className="text-xs text-emerald-400 font-semibold truncate">{p.offer_title}</span>
                    {p.offer_code && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-mono">
                        {p.offer_code}
                      </span>
                    )}
                  </div>
                )}
                {p.website_url && (
                  <div className="flex items-center gap-1 mt-1">
                    <Globe size={10} className="text-gray-500" />
                    <span className="text-[10px] text-gray-500 truncate">{p.website_url}</span>
                  </div>
                )}
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

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#111] border border-white/[0.06] rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-white">
                {editId ? 'Modifier le partenaire' : 'Nouveau partenaire'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs font-bold text-gray-400 mb-1 block">Nom *</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Nom du partenaire"
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-bold text-gray-400 mb-1 block">Catégorie</label>
                <select
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                  value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              {/* Logo */}
              <div>
                <label className="text-xs font-bold text-gray-400 mb-1 block">Logo</label>
                <input
                  type="file" accept="image/*"
                  className="w-full text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-emerald-500/10 file:text-emerald-400 hover:file:bg-emerald-500/20"
                  onChange={e => setLogoFile(e.target.files?.[0] ?? null)}
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-gray-400 mb-1 block">Description</label>
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50 min-h-[80px]"
                  value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Courte description…"
                />
              </div>

              {/* Website / Instagram */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Site web</label>
                  <input
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                    value={form.website_url} onChange={e => setForm({ ...form, website_url: e.target.value })}
                    placeholder="https://…"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Instagram</label>
                  <input
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                    value={form.instagram_url} onChange={e => setForm({ ...form, instagram_url: e.target.value })}
                    placeholder="https://instagram.com/…"
                  />
                </div>
              </div>

              {/* Offer */}
              <div className="border-t border-white/[0.06] pt-4">
                <p className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-3">Offre spéciale</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-gray-400 mb-1 block">Titre de l'offre</label>
                    <input
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                      value={form.offer_title} onChange={e => setForm({ ...form, offer_title: e.target.value })}
                      placeholder="ex: -15% sur tout le site"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 mb-1 block">Description de l'offre</label>
                    <textarea
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50 min-h-[60px]"
                      value={form.offer_description} onChange={e => setForm({ ...form, offer_description: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 mb-1 block">Code promo</label>
                    <input
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50 font-mono tracking-wider"
                      value={form.offer_code} onChange={e => setForm({ ...form, offer_code: e.target.value.toUpperCase() })}
                      placeholder="ATHLEX15"
                    />
                  </div>
                </div>
              </div>

              {/* Sort & active */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Ordre d'affichage</label>
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

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
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
