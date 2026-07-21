'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BookOpen, Plus, Pencil, Trash2, ExternalLink, X, Check, Users, ShoppingCart, Image as ImageIcon, Upload, Loader2 } from 'lucide-react';

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

const EMPTY_AFF: Omit<Affiliate, 'id'> = { name: '', logo_url: '', category: 'functional', description: '', sort_order: 0, is_active: true };
const EMPTY_PRG: Omit<Program, 'id'> = { affiliate_id: '', name: '', description: '', price: null, currency: 'EUR', url: '', image_url: '', sort_order: 0, is_active: true };

export default function AdminProgramsPage() {
  const supabase = createClient();
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

  async function deleteAff(id: string) {
    if (!confirm('Supprimer cet affilié et tous ses programmes ?')) return;
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

  const INPUT = "w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
            <BookOpen size={22} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Programmation</h1>
            <p className="text-sm text-gray-400">{affiliates.length} affilié{affiliates.length > 1 ? 's' : ''} · {programs.length} programme{programs.length > 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={tab === 'affiliates' ? openCreateAff : openCreatePrg}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 text-sm font-bold hover:bg-emerald-500/30 transition-all border border-emerald-500/30"
        >
          <Plus size={16} />
          {tab === 'affiliates' ? 'Nouvel affilié' : 'Nouveau programme'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab('affiliates')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${tab === 'affiliates' ? 'bg-violet-500/20 text-violet-400 border-violet-500/30' : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'}`}>
          <Users size={14} /> Affiliés ({affiliates.length})
        </button>
        <button onClick={() => setTab('programs')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${tab === 'programs' ? 'bg-violet-500/20 text-violet-400 border-violet-500/30' : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'}`}>
          <ShoppingCart size={14} /> Programmes ({programs.length})
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      )}

      {/* ═══════════ AFFILIATES TAB ═══════════ */}
      {!loading && tab === 'affiliates' && (
        <>
          {creatingAff && (
            <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-white uppercase tracking-wider">{editingAff ? 'Modifier l\'affilié' : 'Nouvel affilié'}</h2>
                <button onClick={closeAffForm} className="text-gray-500 hover:text-white"><X size={18} /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Nom</label>
                  <input value={affForm.name} onChange={e => setAffForm({...affForm, name: e.target.value})} placeholder="HWPO, CompTrain..." className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Logo</label>
                  <div className="flex items-center gap-3">
                    {logoPreview ? (
                      <img src={logoPreview} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0 border border-white/10" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-white/5 border border-dashed border-white/20 flex items-center justify-center shrink-0">
                        <ImageIcon size={16} className="text-gray-600" />
                      </div>
                    )}
                    <label className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/50 transition-colors text-sm text-gray-400 hover:text-white">
                        <Upload size={14} />
                        {logoFile ? logoFile.name : 'Choisir un fichier…'}
                      </div>
                      <input type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
                    </label>
                    {(logoPreview || affForm.logo_url) && (
                      <button type="button" onClick={() => { setLogoFile(null); setLogoPreview(null); setAffForm({...affForm, logo_url: ''}); }} className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Catégorie</label>
                  <select value={affForm.category} onChange={e => setAffForm({...affForm, category: e.target.value})} className={INPUT}>
                    <option value="functional">Functional Fitness</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Ordre</label>
                  <input type="number" value={affForm.sort_order} onChange={e => setAffForm({...affForm, sort_order: parseInt(e.target.value)||0})} className={INPUT} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Description</label>
                <input value={affForm.description ?? ''} onChange={e => setAffForm({...affForm, description: e.target.value})} placeholder="Par Mat Fraser — Programming élite" className={INPUT} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={affForm.is_active} onChange={e => setAffForm({...affForm, is_active: e.target.checked})} className="rounded border-white/20 bg-white/5 text-emerald-500" />
                <span className="text-sm text-gray-300">Actif</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button onClick={saveAff} disabled={savingAff || !affForm.name.trim()} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 text-sm font-bold hover:bg-emerald-500/30 border border-emerald-500/30 disabled:opacity-40">
                  {(savingAff || uploadingLogo) ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {uploadingLogo ? 'Upload du logo...' : savingAff ? 'Enregistrement...' : editingAff ? 'Modifier' : 'Créer'}
                </button>
                <button onClick={closeAffForm} className="px-5 py-2.5 rounded-xl bg-white/5 text-gray-400 text-sm font-bold hover:text-white border border-white/10">Annuler</button>
              </div>
            </div>
          )}

          {affiliates.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <Users size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-bold">Aucun affilié</p>
            </div>
          ) : (
            <div className="space-y-2">
              {affiliates.map(a => (
                <div key={a.id} className={`flex items-center gap-4 bg-[#111111] border rounded-2xl p-4 transition-all ${a.is_active ? 'border-white/[0.06] hover:border-white/10' : 'border-white/[0.03] opacity-50'}`}>
                  {a.logo_url ? (
                    <img src={a.logo_url} className="w-10 h-10 rounded-xl object-cover shrink-0" alt="" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                      <span className="text-lg font-black text-gray-500">{a.name[0]}</span>
                    </div>
                  )}
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${a.category === 'hybrid' ? 'bg-orange-400' : 'bg-emerald-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-white truncate">{a.name}</p>
                      <span className="text-[10px] font-bold text-gray-500">{programs.filter(p => p.affiliate_id === a.id).length} prog.</span>
                      {!a.is_active && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-500/15 text-red-400">inactif</span>}
                    </div>
                    {a.description && <p className="text-xs text-gray-500 truncate mt-0.5">{a.description}</p>}
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg shrink-0 ${a.category === 'hybrid' ? 'text-orange-400 bg-orange-500/15' : 'text-emerald-400 bg-emerald-500/15'}`}>
                    {a.category === 'hybrid' ? 'Hybrid' : 'Functional'}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleAff(a)} className="p-2 rounded-lg text-gray-500 hover:text-yellow-400 hover:bg-yellow-500/10 transition-all" title={a.is_active ? 'Désactiver' : 'Activer'}>
                      <div className={`w-3 h-3 rounded-full border-2 ${a.is_active ? 'border-emerald-400 bg-emerald-400' : 'border-gray-500'}`} />
                    </button>
                    <button onClick={() => openEditAff(a)} className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all"><Pencil size={14} /></button>
                    <button onClick={() => deleteAff(a.id)} className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 size={14} /></button>
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
            <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-white uppercase tracking-wider">{editingPrg ? 'Modifier le programme' : 'Nouveau programme'}</h2>
                <button onClick={closePrgForm} className="text-gray-500 hover:text-white"><X size={18} /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Affilié</label>
                  <select value={prgForm.affiliate_id} onChange={e => setPrgForm({...prgForm, affiliate_id: e.target.value})} className={INPUT}>
                    <option value="">— Choisir —</option>
                    {affiliates.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Nom du programme</label>
                  <input value={prgForm.name} onChange={e => setPrgForm({...prgForm, name: e.target.value})} placeholder="HWPO Flagship..." className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Prix (€)</label>
                  <input type="number" step="0.01" value={prgForm.price ?? ''} onChange={e => setPrgForm({...prgForm, price: e.target.value ? parseFloat(e.target.value) : null})} placeholder="49.99" className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">URL d'achat</label>
                  <input value={prgForm.url} onChange={e => setPrgForm({...prgForm, url: e.target.value})} placeholder="https://..." className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Image URL</label>
                  <input value={prgForm.image_url ?? ''} onChange={e => setPrgForm({...prgForm, image_url: e.target.value})} placeholder="https://..." className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Ordre</label>
                  <input type="number" value={prgForm.sort_order} onChange={e => setPrgForm({...prgForm, sort_order: parseInt(e.target.value)||0})} className={INPUT} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Description</label>
                <input value={prgForm.description ?? ''} onChange={e => setPrgForm({...prgForm, description: e.target.value})} placeholder="Le programme complet..." className={INPUT} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={prgForm.is_active} onChange={e => setPrgForm({...prgForm, is_active: e.target.checked})} className="rounded border-white/20 bg-white/5 text-emerald-500" />
                <span className="text-sm text-gray-300">Actif</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button onClick={savePrg} disabled={savingPrg || !prgForm.name.trim() || !prgForm.url.trim() || !prgForm.affiliate_id} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 text-sm font-bold hover:bg-emerald-500/30 border border-emerald-500/30 disabled:opacity-40">
                  <Check size={16} /> {savingPrg ? 'Enregistrement...' : editingPrg ? 'Modifier' : 'Créer'}
                </button>
                <button onClick={closePrgForm} className="px-5 py-2.5 rounded-xl bg-white/5 text-gray-400 text-sm font-bold hover:text-white border border-white/10">Annuler</button>
              </div>
            </div>
          )}

          {programs.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-bold">Aucun programme</p>
              <p className="text-xs mt-1">Créez d'abord un affilié, puis ajoutez ses programmes</p>
            </div>
          ) : (
            <div className="space-y-2">
              {programs.map(p => (
                <div key={p.id} className={`flex items-center gap-4 bg-[#111111] border rounded-2xl p-4 transition-all ${p.is_active ? 'border-white/[0.06] hover:border-white/10' : 'border-white/[0.03] opacity-50'}`}>
                  {p.image_url ? (
                    <img src={p.image_url} className="w-10 h-10 rounded-xl object-cover shrink-0" alt="" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                      <ImageIcon size={16} className="text-gray-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-white truncate">{p.name}</p>
                      {!p.is_active && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-500/15 text-red-400">inactif</span>}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{affName(p.affiliate_id)}</p>
                    {p.description && <p className="text-xs text-gray-600 truncate mt-0.5">{p.description}</p>}
                  </div>
                  <span className="text-sm font-black text-emerald-400 shrink-0">
                    {p.price != null ? `${p.price.toFixed(2)}€` : 'Gratuit'}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all"><ExternalLink size={14} /></a>
                    <button onClick={() => togglePrg(p)} className="p-2 rounded-lg text-gray-500 hover:text-yellow-400 hover:bg-yellow-500/10 transition-all">
                      <div className={`w-3 h-3 rounded-full border-2 ${p.is_active ? 'border-emerald-400 bg-emerald-400' : 'border-gray-500'}`} />
                    </button>
                    <button onClick={() => openEditPrg(p)} className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all"><Pencil size={14} /></button>
                    <button onClick={() => deletePrg(p.id)} className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 size={14} /></button>
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
