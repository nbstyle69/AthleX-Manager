'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Building2, Search, Users, Calendar, CheckCircle, XCircle, ChevronRight, Plus, X, MapPin } from 'lucide-react';
import Link from 'next/link';
import { FREE_TIER, formatExpiredSince, planTierClasses } from '@/lib/boxPlanTier';
import { Sparkles, Archive, CalendarClock } from 'lucide-react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { ERROR_TITLE } from '@/lib/confirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SUB_ORANGE_SOFT, SUB_ORANGE_TEXT } from '@/components/admin/adminTokens';
import { countOf } from '@/lib/plural';

const FIELD_LABEL = 'block text-xs font-bold text-ax-text-secondary uppercase tracking-wider mb-1.5';
const TEXTAREA = 'w-full min-w-0 rounded-ax-control border border-ax-input-border bg-ax-surface px-3 py-2.5 text-base text-ax-text placeholder:text-ax-text-muted sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface';

interface BoxItem {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  plan: string;
  expired_at: string | null;
  offered: boolean;
  is_active: boolean;
  created_at: string;
  owner_name: string;
  owner_email: string;
  member_count: number;
  logo_url: string | null;
  /** Lot J2 : la liste dit seulement lesquelles sont concernées ;
      le réglage vit dans la fiche de la box. */
  auto_programming: boolean;
  archived_at: string | null;
  archive_scheduled_at: string | null;
}

export default function AdminBoxesPage() {
  const { dialog, inform } = useConfirmDialog();
  const [boxes, setBoxes] = useState<BoxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  /** Onglet de la liste : les actives, ou les archivées. */
  const [showArchived, setShowArchived] = useState(false);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/boxes${showArchived ? '?archived=1' : ''}`, { cache: 'no-store' });
    const data: any[] = res.ok ? await res.json() : [];

    const mapped: BoxItem[] = data.map((b: any) => {
      const owner = Array.isArray(b.owner) ? b.owner[0] : b.owner;
      return {
        id: b.id,
        name: b.name,
        slug: b.slug,
        city: b.city,
        plan: b.plan_tier ?? FREE_TIER,
        expired_at: b.expired_at ?? null,
        offered: b.offered === true,
        is_active: b.is_active,
        created_at: b.created_at,
        owner_name: owner?.username ?? 'Inconnu',
        owner_email: '',
        member_count: b.member_count ?? 0,
        logo_url: b.logo_url ?? null,
        auto_programming: b.auto_programming === true,
        archived_at: b.archived_at ?? null,
        archive_scheduled_at: b.archive_scheduled_at ?? null,
      };
    });
    setBoxes(mapped);
    setLoading(false);
  }, [showArchived]);

  useEffect(() => { load(); }, [load]);

  const filtered = boxes.filter(b =>
    b.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.city?.toLowerCase().includes(search.toLowerCase()) ||
    b.owner_name?.toLowerCase().includes(search.toLowerCase())
  );

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newOwnerUsername, setNewOwnerUsername] = useState('');
  const [createError, setCreateError] = useState('');

  async function handleCreate() {
    if (!newName.trim()) { setCreateError('Le nom est requis.'); return; }
    if (!newOwnerUsername.trim()) { setCreateError('Le username du propriétaire est requis.'); return; }
    setCreating(true);
    setCreateError('');

    // Find owner by username (read-only, OK with client)
    const { data: ownerData } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', newOwnerUsername.trim())
      .single();

    if (!ownerData) {
      setCreateError(`Utilisateur "${newOwnerUsername}" introuvable.`);
      setCreating(false);
      return;
    }

    // Generate invite code
    const code = newName.trim().replace(/\s+/g, '').substring(0, 3).toUpperCase()
      + String(Math.floor(Math.random() * 900) + 100);

    // Use API route with service client to bypass RLS
    const res = await fetch('/api/admin/boxes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName.trim(),
        description: newDesc.trim() || null,
        city: newCity.trim() || null,
        owner_id: ownerData.id,
        invite_code: code,
      }),
    });

    setCreating(false);
    if (!res.ok) {
      const err = await res.json();
      setCreateError(err.error ?? 'Erreur lors de la création.');
      return;
    }
    setShowCreate(false);
    setNewName(''); setNewDesc(''); setNewCity(''); setNewOwnerUsername('');
    load();
  }

  const [geocoding, setGeocoding] = useState(false);

  async function handleGeocode() {
    if (geocoding) return;
    setGeocoding(true);
    try {
      const res = await fetch('/api/admin/geocode-boxes', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        inform({ kind: 'error', title: ERROR_TITLE, body: `Erreur: ${json.error ?? 'géocodage échoué'}` });
      } else {
        inform({ kind: 'info', title: 'Géocodage terminé', body: `Géocodage terminé : ${json.updated}/${json.total} boxs mises à jour` + (json.failed ? `, ${countOf(json.failed, 'adresse introuvable', 'adresses introuvables')}` : '') });
        load();
      }
    } catch (e: any) {
      inform({ kind: 'error', title: ERROR_TITLE, body: `Erreur: ${e?.message ?? e}` });
    } finally {
      setGeocoding(false);
    }
  }

  return (
    <div className="space-y-6">
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 shrink-0 rounded-ax-control ${SUB_ORANGE_SOFT} flex items-center justify-center`}>
            <Building2 size={22} className={SUB_ORANGE_TEXT} />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-medium uppercase tracking-wide text-ax-text">Boxs</h1>
            <p className="text-sm text-ax-text-secondary">{boxes.length} box{boxes.length !== 1 ? 's' : ''} enregistrée{boxes.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {/* À 390 px, la barre passe à la ligne au lieu de sortir de l'écran. */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <Button
            variant="ax-outline"
            onClick={handleGeocode}
            disabled={geocoding}
            title="Géocode les adresses des boxs sans coordonnées pour les afficher sur la carte"
          >
            <MapPin size={16} /> {geocoding ? 'Géocodage...' : 'Géocoder les adresses'}
          </Button>
          <Button variant="ax-mint" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Créer une box
          </Button>
          <div className="flex items-center gap-1 p-1 rounded-ax-control border border-ax-border" role="tablist" aria-label="Filtre">
            {([[false, 'Actives'], [true, 'Archivées']] as const).map(([v, label]) => (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={showArchived === v}
                data-testid={v ? 'filtre-archivees' : 'filtre-actives'}
                onClick={() => setShowArchived(v)}
                className={`px-3 py-1.5 rounded-ax-control text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus motion-reduce:transition-none ${
                  showArchived === v ? 'bg-ax-accent-soft text-ax-accent-text' : 'text-ax-text-secondary hover:text-ax-text hover:bg-ax-hover'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ax-text-muted pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
              aria-label="Rechercher une box"
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Create Box Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ax-overlay backdrop-blur-sm p-4">
          <div className="bg-ax-surface border border-ax-border shadow-ax-panel rounded-ax-panel p-6 w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-medium tracking-wide text-ax-text">Créer une Box</h2>
              <button onClick={() => setShowCreate(false)} aria-label="Fermer" className="rounded-ax-control p-1 text-ax-text-secondary hover:text-ax-text hover:bg-ax-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={FIELD_LABEL}>Nom *</label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nom de ma salle ici" />
              </div>
              <div>
                <label className={FIELD_LABEL}>Description</label>
                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description de la box..."
                  className={`${TEXTAREA} h-20 resize-y`} />
              </div>
              <div>
                <label className={FIELD_LABEL}>Ville</label>
                <Input value={newCity} onChange={e => setNewCity(e.target.value)} placeholder="Paris" />
              </div>
              <div>
                <label className={FIELD_LABEL}>Username du propriétaire *</label>
                <Input value={newOwnerUsername} onChange={e => setNewOwnerUsername(e.target.value)} placeholder="nbstyle" />
              </div>
              {createError && <p className="text-xs text-ax-danger">{createError}</p>}
            </div>
            <Button variant="ax-mint" onClick={handleCreate} disabled={creating} className="w-full">
              {creating ? 'Création...' : 'Créer la box'}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-ax-border border-t-ax-accent-text rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Building2 size={48} className="text-ax-text-muted mx-auto mb-4" />
          <p className="text-ax-text-secondary">
            {search ? 'Aucun résultat.' : showArchived ? 'Aucune box archivée.' : 'Aucune box enregistrée.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(box => (
            <Link key={box.id} href={`/admin/boxes/${box.id}`} className="block bg-ax-surface border border-ax-border rounded-ax-card p-5 space-y-4 hover:border-ax-accent-text transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-background motion-reduce:transition-none">
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  {box.logo_url ? (
                    <img src={box.logo_url} alt={box.name} className="w-10 h-10 shrink-0 rounded-ax-control object-cover" />
                  ) : (
                    <div className={`w-10 h-10 shrink-0 rounded-ax-control ${SUB_ORANGE_SOFT} ${SUB_ORANGE_TEXT} flex items-center justify-center font-black text-sm`}>
                      {box.name[0]?.toUpperCase() ?? 'B'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ax-text break-words">{box.name}</p>
                    {box.city && <p className="text-xs text-ax-text-secondary break-words">{box.city}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {box.archived_at && (
                    <span
                      data-testid={`archivee-${box.id}`}
                      title={`Archivée le ${new Date(box.archived_at).toLocaleDateString('fr-FR')}`}
                      className="flex items-center gap-1 text-[10px] font-bold text-ax-warning bg-ax-warning-soft px-2 py-0.5 rounded-ax-badge"
                    >
                      <Archive size={10} /> {new Date(box.archived_at).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                  {/* Archivage (PR 3) : la liste signale, l'annulation se fait dans la fiche. */}
                  {box.archive_scheduled_at && !box.archived_at && (
                    <span
                      data-testid={`archivage-programme-${box.id}`}
                      title={`Archivage programmé le ${new Date(box.archive_scheduled_at).toLocaleDateString('fr-FR')}`}
                      className="flex items-center gap-1 text-[10px] font-bold text-ax-warning bg-ax-warning-soft px-2 py-0.5 rounded-ax-badge"
                    >
                      <CalendarClock size={10} /> Archivage programmé
                    </span>
                  )}
                  {/* Lot J2 : la liste signale, elle ne règle pas. */}
                  {box.auto_programming && (
                    <span
                      data-testid={`auto-pastille-${box.id}`}
                      title="Programmation automatique active — réglage dans la fiche de la box"
                      className="flex items-center gap-1 text-[10px] font-bold text-ax-success bg-ax-success-soft px-2 py-0.5 rounded-ax-badge"
                    >
                      <Sparkles size={10} /> Auto
                    </span>
                  )}
                  {box.is_active ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-ax-success bg-ax-success-soft px-2 py-0.5 rounded-ax-badge">
                      <CheckCircle size={10} /> Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-ax-danger bg-ax-danger-soft px-2 py-0.5 rounded-ax-badge">
                      <XCircle size={10} /> Inactive
                    </span>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 text-ax-text-secondary">
                  <Users size={12} />
                  <span className="font-semibold">{box.member_count} membre{box.member_count !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-1.5 text-ax-text-secondary">
                  <Calendar size={12} />
                  <span className="font-semibold">{new Date(box.created_at).toLocaleDateString('fr-FR')}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-ax-border">
                <div className="min-w-0">
                  <p className="text-[10px] text-ax-text-secondary uppercase tracking-wider font-bold">Gérant</p>
                  <p className="text-xs font-semibold text-ax-text break-words">{box.owner_name}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {box.expired_at && (
                    <span className={`text-[10px] ${SUB_ORANGE_TEXT}`}>{formatExpiredSince(box.expired_at)}</span>
                  )}
                  {box.offered && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-ax-badge text-ax-success bg-ax-success-soft">offert</span>
                  )}
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-ax-badge ${planTierClasses(box.plan)}`}>
                    {box.plan}
                  </span>
                  <ChevronRight size={14} className="text-ax-text-muted group-hover:text-ax-accent-text transition-colors" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
