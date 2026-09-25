'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { Plus, Pencil, Trash2, Handshake, Globe, Tag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useModalEscape } from '@/lib/modalEscape';

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

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus';
const FIELD_LABEL = 'block text-xs font-bold text-ax-text-secondary mb-1';
/** Liste et zone de texte au rendu de `Input` (lot 1). */
const FIELD = 'w-full min-w-0 min-h-11 rounded-ax-control border border-ax-input-border bg-ax-surface px-3 py-2.5 text-base text-ax-text placeholder:text-ax-text-muted sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface';
const ICON_BUTTON = `p-2 rounded-ax-control text-ax-text-secondary transition-colors motion-reduce:transition-none ${FOCUS}`;

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
  const { dialog, ask } = useConfirmDialog();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  // Échap ferme sans enregistrer ; le focus revient au bouton d'ouverture.
  useModalEscape(showForm, () => setShowForm(false));

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

  function askDelete(p: Partner) {
    const cat = CATEGORIES.find(c => c.value === p.category)?.label ?? p.category;
    ask({
      title: 'Supprimer ce partenaire ?',
      element: `${p.name} · ${cat}${p.offer_title ? ` · offre « ${p.offer_title} »${p.offer_code ? `, code ${p.offer_code}` : ''}` : ''}`,
      body: 'Le partenaire et son offre disparaîtront de l’application. Pour le masquer sans le supprimer, désactive-le. Cette action est définitive.',
      confirmLabel: 'Supprimer le partenaire',
      danger: true,
      run: () => handleDelete(p.id),
    });
  }

  async function handleDelete(id: string) {
    await supabase.from('partners').delete().eq('id', id);
    loadPartners();
  }

  return (
    <div className="space-y-6">
      {dialog}
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-medium uppercase tracking-wide text-ax-text">Partenaires</h1>
          <p className="text-sm text-ax-text-secondary mt-1">Gérez les marques et offres partenaires visibles dans l&apos;app</p>
        </div>
        <Button variant="ax-mint" onClick={openNew}>
          <Plus size={16} /> Ajouter
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-20 text-ax-text-secondary">Chargement…</div>
      ) : partners.length === 0 ? (
        <div className="text-center py-20">
          <Handshake size={40} className="mx-auto text-ax-text-muted mb-3" />
          <p className="text-ax-text-secondary">Aucun partenaire</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {partners.map(p => (
            <div key={p.id} className="flex items-start sm:items-center gap-4 bg-ax-surface border border-ax-border rounded-ax-card p-4">
              {p.logo_url ? (
                <img src={p.logo_url} alt="" className="w-12 h-12 shrink-0 rounded-ax-control object-cover" />
              ) : (
                <div className="w-12 h-12 shrink-0 rounded-ax-control bg-ax-success-soft flex items-center justify-center">
                  <Handshake size={20} className="text-ax-success" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-ax-text break-words min-w-0">{p.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-ax-badge bg-ax-neutral-soft text-ax-text-secondary font-semibold">
                    {CATEGORIES.find(c => c.value === p.category)?.label ?? p.category}
                  </span>
                  {!p.is_active && (
                    <span className="text-[10px] px-2 py-0.5 rounded-ax-badge bg-ax-danger-soft text-ax-danger font-semibold">
                      Inactif
                    </span>
                  )}
                </div>
                {p.offer_title && (
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    <Tag size={11} className="text-ax-success shrink-0" />
                    <span className="text-xs text-ax-success font-semibold break-words min-w-0">{p.offer_title}</span>
                    {p.offer_code && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-ax-badge bg-ax-success-soft text-ax-success font-mono">
                        {p.offer_code}
                      </span>
                    )}
                  </div>
                )}
                {p.website_url && (
                  <div className="flex items-center gap-1 mt-1 min-w-0">
                    <Globe size={10} className="text-ax-text-muted shrink-0" />
                    <span className="text-[10px] text-ax-text-secondary break-all">{p.website_url}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => openEdit(p)}
                  aria-label={`Modifier ${p.name}`}
                  className={`${ICON_BUTTON} hover:text-ax-text hover:bg-ax-hover`}
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => askDelete(p)}
                  aria-label={`Supprimer ${p.name}`}
                  className={`${ICON_BUTTON} hover:text-ax-danger hover:bg-ax-danger-soft`}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ax-overlay backdrop-blur-sm p-4">
          <div
            role="dialog" aria-modal="true" aria-labelledby="partner-form-title"
            className="w-full max-w-2xl bg-ax-surface border border-ax-border shadow-ax-panel rounded-ax-panel p-6 max-h-[calc(100vh-2rem)] overflow-y-auto"
          >
            <div className="flex items-center justify-between gap-3 mb-6">
              <h2 id="partner-form-title" className="font-display text-xl font-medium tracking-wide text-ax-text">
                {editId ? 'Modifier le partenaire' : 'Nouveau partenaire'}
              </h2>
              <button onClick={() => setShowForm(false)} aria-label="Fermer" className={`rounded-ax-control p-1 text-ax-text-secondary hover:text-ax-text hover:bg-ax-hover ${FOCUS}`}>
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className={FIELD_LABEL}>Nom *</label>
                <Input
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Nom du partenaire"
                />
              </div>

              {/* Category */}
              <div>
                <label className={FIELD_LABEL}>Catégorie</label>
                <select
                  className={FIELD}
                  value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              {/* Logo */}
              <div>
                <label className={FIELD_LABEL}>Logo</label>
                <input
                  type="file" accept="image/*"
                  className={`w-full min-w-0 rounded-ax-control text-sm text-ax-text-secondary file:mr-3 file:py-2 file:px-4 file:rounded-ax-control file:border file:border-ax-input-border file:text-sm file:font-semibold file:bg-ax-surface-secondary file:text-ax-text hover:file:bg-ax-hover ${FOCUS}`}
                  onChange={e => setLogoFile(e.target.files?.[0] ?? null)}
                />
              </div>

              {/* Description */}
              <div>
                <label className={FIELD_LABEL}>Description</label>
                <textarea
                  className={`${FIELD} min-h-[80px] resize-y`}
                  value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Courte description…"
                />
              </div>

              {/* Website / Instagram */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={FIELD_LABEL}>Site web</label>
                  <Input
                    value={form.website_url} onChange={e => setForm({ ...form, website_url: e.target.value })}
                    placeholder="https://…"
                  />
                </div>
                <div>
                  <label className={FIELD_LABEL}>Instagram</label>
                  <Input
                    value={form.instagram_url} onChange={e => setForm({ ...form, instagram_url: e.target.value })}
                    placeholder="https://instagram.com/…"
                  />
                </div>
              </div>

              {/* Offer */}
              <div className="border-t border-ax-border pt-4">
                <p className="text-xs font-black text-ax-accent-text uppercase tracking-widest mb-3">Offre spéciale</p>
                <div className="space-y-3">
                  <div>
                    <label className={FIELD_LABEL}>Titre de l&apos;offre</label>
                    <Input
                      value={form.offer_title} onChange={e => setForm({ ...form, offer_title: e.target.value })}
                      placeholder="ex: -15% sur tout le site"
                    />
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>Description de l&apos;offre</label>
                    <textarea
                      className={`${FIELD} min-h-[60px] resize-y`}
                      value={form.offer_description} onChange={e => setForm({ ...form, offer_description: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>Code promo</label>
                    <Input
                      className="font-mono tracking-wider"
                      value={form.offer_code} onChange={e => setForm({ ...form, offer_code: e.target.value.toUpperCase() })}
                      placeholder="ATHLEX15"
                    />
                  </div>
                </div>
              </div>

              {/* Sort & active */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={FIELD_LABEL}>Ordre d&apos;affichage</label>
                  <Input
                    type="number"
                    value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-end pb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox" checked={form.is_active}
                      onChange={e => setForm({ ...form, is_active: e.target.checked })}
                      className="w-4 h-4 rounded accent-[var(--ax-accent)]"
                    />
                    <span className="text-sm text-ax-text font-semibold">Actif</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap justify-end gap-3 mt-6">
              <Button variant="ax-outline" onClick={() => setShowForm(false)}>
                Annuler
              </Button>
              <Button variant="ax-mint" onClick={handleSave} disabled={saving || !form.name.trim()}>
                {saving ? 'Enregistrement…' : editId ? 'Modifier' : 'Créer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
