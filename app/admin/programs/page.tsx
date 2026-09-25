'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { BookOpen, Plus, Pencil, Trash2, ExternalLink, X, Check, Users, ShoppingCart, Image as ImageIcon, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PURPLE_SOFT, SUB_ORANGE_SOFT, SUB_ORANGE_TEXT, chipClass } from '@/components/admin/adminTokens';

interface Affiliate {
  id: string;
  name: string;
  logo_url: string | null;
  category: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

interface Program {
  id: string;
  affiliate_id: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  url: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

type Tab = 'affiliates' | 'programs';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus';
const FIELD_LABEL = 'block text-xs font-bold text-ax-text-secondary uppercase tracking-wider mb-1.5';
const ICON_BUTTON = `p-2 rounded-ax-control text-ax-text-secondary transition-colors motion-reduce:transition-none ${FOCUS}`;

const EMPTY_AFF: Omit<Affiliate, 'id'> = { name: '', logo_url: '', category: 'functional', description: '', sort_order: 0, is_active: true };
const EMPTY_PRG: Omit<Program, 'id'> = { affiliate_id: '', name: '', description: '', price: null, currency: 'EUR', url: '', image_url: '', sort_order: 0, is_active: true };

export default function AdminProgramsPage() {
  const supabase = createClient();
  const { dialog, ask } = useConfirmDialog();
  const [tab, setTab] = useState<Tab>('affiliates');
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);

  // Affiliate form
  const [affForm, setAffForm] = useState(EMPTY_AFF);
  const [editingAff, setEditingAff] = useState<Affiliate | null>(null);
  const [creatingAff, setCreatingAff] = useState(false);
  const [savingAff, setSavingAff] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Program form
  const [prgForm, setPrgForm] = useState(EMPTY_PRG);
  const [editingPrg, setEditingPrg] = useState<Program | null>(null);
  const [creatingPrg, setCreatingPrg] = useState(false);
  const [savingPrg, setSavingPrg] = useState(false);

  const loadAff = useCallback(async () => {
    const { data } = await supabase.from('program_affiliates').select('*').order('sort_order', { ascending: true });
    setAffiliates(data ?? []);
  }, []);

  const loadPrg = useCallback(async () => {
    const { data } = await supabase.from('programs').select('*').order('sort_order', { ascending: true });
    setPrograms(data ?? []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadAff(), loadPrg()]);
    setLoading(false);
  }, [loadAff, loadPrg]);

  useEffect(() => { load(); }, [load]);

  // ── Affiliate CRUD ──
  function openCreateAff() {
    const max = affiliates.reduce((m, a) => Math.max(m, a.sort_order), 0);
    setAffForm({ ...EMPTY_AFF, sort_order: max + 1 });
    setEditingAff(null); setCreatingAff(true); setLogoFile(null); setLogoPreview(null);
  }
  function openEditAff(a: Affiliate) {
    setAffForm({ name: a.name, logo_url: a.logo_url ?? '', category: a.category, description: a.description ?? '', sort_order: a.sort_order, is_active: a.is_active });
    setEditingAff(a); setCreatingAff(true); setLogoFile(null); setLogoPreview(a.logo_url ?? null);
  }
  function closeAffForm() { setCreatingAff(false); setEditingAff(null); setAffForm(EMPTY_AFF); setLogoFile(null); setLogoPreview(null); }

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function uploadLogo(file: File): Promise<string | null> {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
    const path = `programs/logos/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from('assets').upload(path, file, { upsert: true });
    if (error) { console.error('Upload error:', error.message); return null; }
    const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(path);
    return publicUrl;
  }

  async function saveAff() {
    if (!affForm.name.trim()) return;
    setSavingAff(true);

    let logoUrl = affForm.logo_url?.trim() || null;
    if (logoFile) {
      setUploadingLogo(true);
      const uploaded = await uploadLogo(logoFile);
      setUploadingLogo(false);
      if (uploaded) logoUrl = uploaded;
    }

    const payload = {
      name: affForm.name.trim(),
      logo_url: logoUrl,
      category: affForm.category,
      description: affForm.description?.trim() || null,
      sort_order: affForm.sort_order,
      is_active: affForm.is_active,
      updated_at: new Date().toISOString(),
    };
    if (editingAff) {
      await supabase.from('program_affiliates').update(payload).eq('id', editingAff.id);
    } else {
      await supabase.from('program_affiliates').insert(payload);
    }
    setSavingAff(false); closeAffForm(); loadAff();
  }

  // Le texte d'origine annonçait « et tous ses programmes » : aucune table ne
  // rattache un programme à un affilié, seul l'affilié est supprimé.
  function askDeleteAff(a: Affiliate) {
    ask({
      title: 'Supprimer cet affilié ?',
      element: a.name,
      body: 'Il disparaîtra de la liste des affiliés. Aucun programme n’est supprimé. Cette action est définitive.',
      confirmLabel: 'Supprimer l’affilié',
      danger: true,
      run: () => deleteAff(a.id),
    });
  }

  async function deleteAff(id: string) {
    await supabase.from('program_affiliates').delete().eq('id', id);
    load();
  }

  async function toggleAff(a: Affiliate) {
    await supabase.from('program_affiliates').update({ is_active: !a.is_active, updated_at: new Date().toISOString() }).eq('id', a.id);
    loadAff();
  }

  // ── Program CRUD ──
  function openCreatePrg() {
    const max = programs.reduce((m, p) => Math.max(m, p.sort_order), 0);
    setPrgForm({ ...EMPTY_PRG, sort_order: max + 1, affiliate_id: affiliates[0]?.id ?? '' });
    setEditingPrg(null); setCreatingPrg(true);
  }
  function openEditPrg(p: Program) {
    setPrgForm({ affiliate_id: p.affiliate_id, name: p.name, description: p.description ?? '', price: p.price, currency: p.currency, url: p.url, image_url: p.image_url ?? '', sort_order: p.sort_order, is_active: p.is_active });
    setEditingPrg(p); setCreatingPrg(true);
  }
  function closePrgForm() { setCreatingPrg(false); setEditingPrg(null); setPrgForm(EMPTY_PRG); }

  async function savePrg() {
    if (!prgForm.name.trim() || !prgForm.url.trim() || !prgForm.affiliate_id) return;
    setSavingPrg(true);
    const payload = {
      affiliate_id: prgForm.affiliate_id,
      name: prgForm.name.trim(),
      description: prgForm.description?.trim() || null,
      price: prgForm.price,
      currency: prgForm.currency,
      url: prgForm.url.trim(),
      image_url: prgForm.image_url?.trim() || null,
      sort_order: prgForm.sort_order,
      is_active: prgForm.is_active,
      updated_at: new Date().toISOString(),
    };
    if (editingPrg) {
      await supabase.from('programs').update(payload).eq('id', editingPrg.id);
    } else {
      await supabase.from('programs').insert(payload);
    }
    setSavingPrg(false); closePrgForm(); loadPrg();
  }

  async function deletePrg(id: string) {
    if (!confirm('Supprimer ce programme ?')) return;
    await supabase.from('programs').delete().eq('id', id);
    loadPrg();
  }

  async function togglePrg(p: Program) {
    await supabase.from('programs').update({ is_active: !p.is_active, updated_at: new Date().toISOString() }).eq('id', p.id);
    loadPrg();
  }

  const affName = (id: string) => affiliates.find(a => a.id === id)?.name ?? '—';

  // D13 : apparence seulement. Champs au rendu de `Input` (lot 1).
  const INPUT = "w-full min-w-0 min-h-11 rounded-ax-control border border-ax-input-border bg-ax-surface px-3 py-2.5 text-base text-ax-text placeholder:text-ax-text-muted sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface";

  return (
    <div className="space-y-6">
      {dialog}
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 shrink-0 rounded-ax-control ${PURPLE_SOFT} flex items-center justify-center`}>
            <BookOpen size={22} className="text-ax-purple" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-medium uppercase tracking-wide text-ax-text">Programmes athlètes</h1>
            <p className="text-sm text-ax-text-secondary">{affiliates.length} affilié{affiliates.length > 1 ? 's' : ''} · {programs.length} programme{programs.length > 1 ? 's' : ''}</p>
          </div>
        </div>
        <Button variant="ax-mint" onClick={tab === 'affiliates' ? openCreateAff : openCreatePrg}>
          <Plus size={16} />
          {tab === 'affiliates' ? 'Nouvel affilié' : 'Nouveau programme'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTab('affiliates')} aria-pressed={tab === 'affiliates'} className={`${chipClass(tab === 'affiliates')} flex items-center gap-2 px-4 py-2 normal-case tracking-normal text-sm`}>
          <Users size={14} /> Affiliés ({affiliates.length})
        </button>
        <button onClick={() => setTab('programs')} aria-pressed={tab === 'programs'} className={`${chipClass(tab === 'programs')} flex items-center gap-2 px-4 py-2 normal-case tracking-normal text-sm`}>
          <ShoppingCart size={14} /> Programmes ({programs.length})
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-ax-border border-t-ax-accent-text rounded-full animate-spin" />
        </div>
      )}

      {/* ═══════════ AFFILIATES TAB ═══════════ */}
      {!loading && tab === 'affiliates' && (
        <>
          {creatingAff && (
            <div className="bg-ax-surface border border-ax-border rounded-ax-card p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black text-ax-text uppercase tracking-wider">{editingAff ? 'Modifier l\'affilié' : 'Nouvel affilié'}</h2>
                <button onClick={closeAffForm} aria-label="Fermer" className={`rounded-ax-control p-1 text-ax-text-secondary hover:text-ax-text hover:bg-ax-hover ${FOCUS}`}><X size={18} /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={FIELD_LABEL}>Nom</label>
                  <input value={affForm.name} onChange={e => setAffForm({...affForm, name: e.target.value})} placeholder="HWPO, CompTrain..." className={INPUT} />
                </div>
                <div>
                  <label className={FIELD_LABEL}>Logo</label>
                  <div className="flex items-center gap-3">
                    {logoPreview ? (
                      <img src={logoPreview} alt="" className="w-12 h-12 rounded-ax-control object-cover shrink-0 border border-ax-border" />
                    ) : (
                      <div className="w-12 h-12 rounded-ax-control bg-ax-surface-secondary border border-dashed border-ax-input-border flex items-center justify-center shrink-0">
                        <ImageIcon size={16} className="text-ax-text-muted" />
                      </div>
                    )}
                    <label className="relative flex-1 min-w-0 cursor-pointer rounded-ax-control focus-within:ring-2 focus-within:ring-ax-focus">
                      <div className="flex items-center gap-2 min-h-11 px-3 py-2.5 rounded-ax-control bg-ax-surface border border-ax-input-border hover:bg-ax-hover transition-colors text-sm text-ax-text-secondary hover:text-ax-text motion-reduce:transition-none">
                        <Upload size={14} className="shrink-0" />
                        <span className="min-w-0 break-all">{logoFile ? logoFile.name : 'Choisir un fichier…'}</span>
                      </div>
                      <input type="file" accept="image/*" onChange={handleLogoSelect} className="sr-only" />
                    </label>
                    {(logoPreview || affForm.logo_url) && (
                      <button type="button" aria-label="Retirer le logo" onClick={() => { setLogoFile(null); setLogoPreview(null); setAffForm({...affForm, logo_url: ''}); }} className={`${ICON_BUTTON} hover:text-ax-danger hover:bg-ax-danger-soft`}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className={FIELD_LABEL}>Catégorie</label>
                  <select value={affForm.category} onChange={e => setAffForm({...affForm, category: e.target.value})} className={INPUT}>
                    <option value="functional">Functional Fitness</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
                <div>
                  <label className={FIELD_LABEL}>Ordre</label>
                  <input type="number" value={affForm.sort_order} onChange={e => setAffForm({...affForm, sort_order: parseInt(e.target.value)||0})} className={INPUT} />
                </div>
              </div>
              <div>
                <label className={FIELD_LABEL}>Description</label>
                <input value={affForm.description ?? ''} onChange={e => setAffForm({...affForm, description: e.target.value})} placeholder="Par Mat Fraser — Programming élite" className={INPUT} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={affForm.is_active} onChange={e => setAffForm({...affForm, is_active: e.target.checked})} className="w-4 h-4 rounded accent-[var(--ax-accent)]" />
                <span className="text-sm text-ax-text">Actif</span>
              </label>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button variant="ax-mint" onClick={saveAff} disabled={savingAff || !affForm.name.trim()}>
                  {(savingAff || uploadingLogo) ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {uploadingLogo ? 'Upload du logo...' : savingAff ? 'Enregistrement...' : editingAff ? 'Modifier' : 'Créer'}
                </Button>
                <Button variant="ax-outline" onClick={closeAffForm}>Annuler</Button>
              </div>
            </div>
          )}

          {affiliates.length === 0 ? (
            <div className="text-center py-20 text-ax-text-secondary">
              <Users size={40} className="mx-auto mb-3 text-ax-text-muted" />
              <p className="text-sm font-bold">Aucun affilié</p>
            </div>
          ) : (
            <div className="space-y-2">
              {affiliates.map(a => (
                // Inactif : carte en pointillés et étiquette « inactif », sans
                // transparence qui rendait le texte illisible.
                <div key={a.id} className={`flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-2 border rounded-ax-card p-4 ${a.is_active ? 'bg-ax-surface border-ax-border' : 'bg-ax-surface-secondary border-dashed border-ax-input-border'}`}>
                  {a.logo_url ? (
                    <img src={a.logo_url} className="w-10 h-10 rounded-ax-control object-cover shrink-0" alt="" />
                  ) : (
                    <div className="w-10 h-10 rounded-ax-control bg-ax-surface-secondary border border-ax-border flex items-center justify-center shrink-0">
                      <span className="text-lg font-black text-ax-text-secondary">{a.name[0]}</span>
                    </div>
                  )}
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${a.category === 'hybrid' ? 'bg-[color:var(--ax-sub-orange-text)]' : 'bg-ax-success'}`} aria-hidden="true" />
                  <div className="flex-1 min-w-0 basis-40">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black text-ax-text break-words min-w-0">{a.name}</p>
                      <span className="text-[10px] font-bold text-ax-text-secondary whitespace-nowrap">{programs.filter(p => p.affiliate_id === a.id).length} prog.</span>
                      {!a.is_active && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-ax-badge bg-ax-danger-soft text-ax-danger">inactif</span>}
                    </div>
                    {a.description && <p className="text-xs text-ax-text-secondary break-words mt-0.5">{a.description}</p>}
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-ax-badge shrink-0 ${a.category === 'hybrid' ? `${SUB_ORANGE_TEXT} ${SUB_ORANGE_SOFT}` : 'text-ax-success bg-ax-success-soft'}`}>
                    {a.category === 'hybrid' ? 'Hybrid' : 'Functional'}
                  </span>
                  <div className="flex items-center gap-1 shrink-0 ml-auto sm:ml-0">
                    <button onClick={() => toggleAff(a)} className={`${ICON_BUTTON} hover:bg-ax-hover`} title={a.is_active ? 'Désactiver' : 'Activer'} aria-label={`${a.is_active ? 'Désactiver' : 'Activer'} ${a.name}`}>
                      <div className={`w-3 h-3 rounded-full border-2 ${a.is_active ? 'border-ax-success bg-ax-success' : 'border-ax-text-secondary'}`} />
                    </button>
                    <button onClick={() => openEditAff(a)} aria-label={`Modifier ${a.name}`} className={`${ICON_BUTTON} hover:text-ax-text hover:bg-ax-hover`}><Pencil size={14} /></button>
                    <button onClick={() => askDeleteAff(a)} aria-label={`Supprimer ${a.name}`} className={`${ICON_BUTTON} hover:text-ax-danger hover:bg-ax-danger-soft`}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══════════ PROGRAMS TAB ═══════════ */}
      {!loading && tab === 'programs' && (
        <>
          {creatingPrg && (
            <div className="bg-ax-surface border border-ax-border rounded-ax-card p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black text-ax-text uppercase tracking-wider">{editingPrg ? 'Modifier le programme' : 'Nouveau programme'}</h2>
                <button onClick={closePrgForm} aria-label="Fermer" className={`rounded-ax-control p-1 text-ax-text-secondary hover:text-ax-text hover:bg-ax-hover ${FOCUS}`}><X size={18} /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={FIELD_LABEL}>Affilié</label>
                  <select value={prgForm.affiliate_id} onChange={e => setPrgForm({...prgForm, affiliate_id: e.target.value})} className={INPUT}>
                    <option value="">— Choisir —</option>
                    {affiliates.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={FIELD_LABEL}>Nom du programme</label>
                  <input value={prgForm.name} onChange={e => setPrgForm({...prgForm, name: e.target.value})} placeholder="HWPO Flagship..." className={INPUT} />
                </div>
                <div>
                  <label className={FIELD_LABEL}>Prix (€)</label>
                  <input type="number" step="0.01" value={prgForm.price ?? ''} onChange={e => setPrgForm({...prgForm, price: e.target.value ? parseFloat(e.target.value) : null})} placeholder="49.99" className={INPUT} />
                </div>
                <div>
                  <label className={FIELD_LABEL}>URL d&apos;achat</label>
                  <input value={prgForm.url} onChange={e => setPrgForm({...prgForm, url: e.target.value})} placeholder="https://..." className={INPUT} />
                </div>
                <div>
                  <label className={FIELD_LABEL}>Image URL</label>
                  <input value={prgForm.image_url ?? ''} onChange={e => setPrgForm({...prgForm, image_url: e.target.value})} placeholder="https://..." className={INPUT} />
                </div>
                <div>
                  <label className={FIELD_LABEL}>Ordre</label>
                  <input type="number" value={prgForm.sort_order} onChange={e => setPrgForm({...prgForm, sort_order: parseInt(e.target.value)||0})} className={INPUT} />
                </div>
              </div>
              <div>
                <label className={FIELD_LABEL}>Description</label>
                <input value={prgForm.description ?? ''} onChange={e => setPrgForm({...prgForm, description: e.target.value})} placeholder="Le programme complet..." className={INPUT} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={prgForm.is_active} onChange={e => setPrgForm({...prgForm, is_active: e.target.checked})} className="w-4 h-4 rounded accent-[var(--ax-accent)]" />
                <span className="text-sm text-ax-text">Actif</span>
              </label>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button variant="ax-mint" onClick={savePrg} disabled={savingPrg || !prgForm.name.trim() || !prgForm.url.trim() || !prgForm.affiliate_id}>
                  <Check size={16} /> {savingPrg ? 'Enregistrement...' : editingPrg ? 'Modifier' : 'Créer'}
                </Button>
                <Button variant="ax-outline" onClick={closePrgForm}>Annuler</Button>
              </div>
            </div>
          )}

          {programs.length === 0 ? (
            <div className="text-center py-20 text-ax-text-secondary">
              <ShoppingCart size={40} className="mx-auto mb-3 text-ax-text-muted" />
              <p className="text-sm font-bold">Aucun programme</p>
              <p className="text-xs mt-1">Créez d&apos;abord un affilié, puis ajoutez ses programmes</p>
            </div>
          ) : (
            <div className="space-y-2">
              {programs.map(p => (
                <div key={p.id} className={`flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-2 border rounded-ax-card p-4 ${p.is_active ? 'bg-ax-surface border-ax-border' : 'bg-ax-surface-secondary border-dashed border-ax-input-border'}`}>
                  {p.image_url ? (
                    <img src={p.image_url} className="w-10 h-10 rounded-ax-control object-cover shrink-0" alt="" />
                  ) : (
                    <div className="w-10 h-10 rounded-ax-control bg-ax-surface-secondary border border-ax-border flex items-center justify-center shrink-0">
                      <ImageIcon size={16} className="text-ax-text-muted" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 basis-40">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black text-ax-text break-words min-w-0">{p.name}</p>
                      {!p.is_active && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-ax-badge bg-ax-danger-soft text-ax-danger">inactif</span>}
                    </div>
                    <p className="text-xs text-ax-text-secondary break-words mt-0.5">{affName(p.affiliate_id)}</p>
                    {p.description && <p className="text-xs text-ax-text-secondary break-words mt-0.5">{p.description}</p>}
                  </div>
                  <span className="text-sm font-black text-ax-success shrink-0">
                    {p.price != null ? `${p.price.toFixed(2)}€` : 'Gratuit'}
                  </span>
                  <div className="flex items-center gap-1 shrink-0 ml-auto sm:ml-0">
                    <a href={p.url} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir la page d'achat de ${p.name}`} className={`${ICON_BUTTON} hover:text-ax-info hover:bg-ax-info-soft`}><ExternalLink size={14} /></a>
                    <button onClick={() => togglePrg(p)} aria-label={`${p.is_active ? 'Désactiver' : 'Activer'} ${p.name}`} title={p.is_active ? 'Désactiver' : 'Activer'} className={`${ICON_BUTTON} hover:bg-ax-hover`}>
                      <div className={`w-3 h-3 rounded-full border-2 ${p.is_active ? 'border-ax-success bg-ax-success' : 'border-ax-text-secondary'}`} />
                    </button>
                    <button onClick={() => openEditPrg(p)} aria-label={`Modifier ${p.name}`} className={`${ICON_BUTTON} hover:text-ax-text hover:bg-ax-hover`}><Pencil size={14} /></button>
                    <button onClick={() => deletePrg(p.id)} aria-label={`Supprimer ${p.name}`} className={`${ICON_BUTTON} hover:text-ax-danger hover:bg-ax-danger-soft`}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
