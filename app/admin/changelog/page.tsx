'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { FileText, Plus, Pencil, Trash2, X, Bug, Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useModalEscape } from '@/lib/modalEscape';

interface ChangelogEntry {
  id: string;
  title: string;
  body: string;
  type: 'fix' | 'feature' | 'update';
  created_at: string;
  created_by: string | null;
}

// Même couleur par type qu'avant, en jetons lisibles dans les deux thèmes.
const TYPE_OPTIONS: { value: ChangelogEntry['type']; label: string; icon: any; color: string }[] = [
  { value: 'feature', label: 'Nouveauté', icon: Sparkles, color: 'text-ax-success bg-ax-success-soft' },
  { value: 'fix', label: 'Correction', icon: Bug, color: 'text-ax-danger bg-ax-danger-soft' },
  { value: 'update', label: 'Amélioration', icon: RefreshCw, color: 'text-ax-info bg-ax-info-soft' },
];

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus';
const TEXTAREA = 'w-full min-w-0 rounded-ax-control border border-ax-input-border bg-ax-surface px-3 py-2.5 text-base text-ax-text placeholder:text-ax-text-muted sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface';
const ICON_BUTTON = `p-2 rounded-ax-control text-ax-text-secondary transition-colors motion-reduce:transition-none ${FOCUS}`;

export default function AdminChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ChangelogEntry | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<ChangelogEntry['type']>('update');
  const [saving, setSaving] = useState(false);
  const supabase = createClient();
  const { dialog, ask } = useConfirmDialog();
  // Échap ferme sans enregistrer ; le focus revient au bouton d'ouverture.
  useModalEscape(showForm, () => setShowForm(false));

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('app_changelog')
      .select('*')
      .order('created_at', { ascending: false });
    setEntries(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditing(null);
    setTitle('');
    setBody('');
    setType('update');
    setShowForm(true);
  }

  function openEdit(entry: ChangelogEntry) {
    setEditing(entry);
    setTitle(entry.title);
    setBody(entry.body);
    setType(entry.type);
    setShowForm(true);
  }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);

    if (editing) {
      await supabase
        .from('app_changelog')
        .update({ title: title.trim(), body: body.trim(), type })
        .eq('id', editing.id);
    } else {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from('app_changelog')
        .insert({ title: title.trim(), body: body.trim(), type, created_by: user?.id ?? null });
    }

    setSaving(false);
    setShowForm(false);
    load();
  }

  function askDelete(entry: ChangelogEntry) {
    ask({
      title: 'Supprimer cette entrée du journal des nouveautés ?',
      element: `« ${entry.title} », ${typeConfig(entry.type).label}, publiée le ${new Date(entry.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      body: 'Elle disparaîtra de l’application mobile. Cette action est définitive.',
      confirmLabel: 'Supprimer l’entrée',
      danger: true,
      run: () => handleDelete(entry.id),
    });
  }

  async function handleDelete(id: string) {
    await supabase.from('app_changelog').delete().eq('id', id);
    load();
  }

  const typeConfig = (t: string) => TYPE_OPTIONS.find(o => o.value === t) ?? TYPE_OPTIONS[2];

  return (
    <div className="space-y-6">
      {dialog}
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-ax-control bg-ax-info-soft flex items-center justify-center">
            <FileText size={22} className="text-ax-info" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-medium uppercase tracking-wide text-ax-text">Nouveautés</h1>
            <p className="text-sm text-ax-text-secondary">{entries.length} entrées · affiché dans l&apos;app mobile</p>
          </div>
        </div>
        <Button variant="ax-mint" onClick={openNew}>
          <Plus size={16} />
          Nouvelle entrée
        </Button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ax-overlay backdrop-blur-sm p-4">
          <div
            role="dialog" aria-modal="true" aria-labelledby="changelog-form-title"
            className="bg-ax-surface border border-ax-border shadow-ax-panel rounded-ax-panel p-6 w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto"
          >
            <div className="flex items-center justify-between gap-3 mb-5">
              <h2 id="changelog-form-title" className="font-display text-xl font-medium tracking-wide text-ax-text">
                {editing ? 'Modifier l\'entrée' : 'Nouvelle entrée'}
              </h2>
              <button onClick={() => setShowForm(false)} aria-label="Fermer" className={`rounded-ax-control p-1 text-ax-text-secondary hover:text-ax-text hover:bg-ax-hover ${FOCUS}`}>
                <X size={20} />
              </button>
            </div>

            {/* Type selector */}
            <div className="flex flex-wrap gap-2 mb-4">
              {TYPE_OPTIONS.map(opt => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setType(opt.value)}
                    aria-pressed={type === opt.value}
                    className={`flex items-center gap-2 px-3 py-2 rounded-ax-control text-xs font-bold uppercase tracking-wider transition-colors border motion-reduce:transition-none ${FOCUS} ${
                      type === opt.value
                        ? `${opt.color} border-current`
                        : 'bg-transparent text-ax-text-secondary border-ax-border hover:text-ax-text hover:bg-ax-hover'
                    }`}
                  >
                    <Icon size={14} />
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Title */}
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Titre de l'entrée..."
              aria-label="Titre de l'entrée"
              className="mb-3"
            />

            {/* Body */}
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Description détaillée (optionnel)..."
              aria-label="Description détaillée"
              rows={5}
              className={`${TEXTAREA} mb-4 resize-y`}
            />

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <Button variant="ax-outline" onClick={() => setShowForm(false)} className="flex-1">
                Annuler
              </Button>
              <Button variant="ax-mint" onClick={handleSave} disabled={saving || !title.trim()} className="flex-1">
                {saving ? 'Enregistrement...' : editing ? 'Modifier' : 'Créer'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-ax-border border-t-ax-accent-text rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-20">
          <FileText size={40} className="text-ax-text-muted mx-auto mb-3" />
          <p className="text-ax-text-secondary text-sm">Aucune entrée dans les nouveautés</p>
          <button onClick={openNew} className={`mt-3 rounded-ax-control text-ax-accent-text text-sm font-bold hover:underline ${FOCUS}`}>
            Créer la première
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => {
            const tc = typeConfig(entry.type);
            const Icon = tc.icon;
            return (
              <div
                key={entry.id}
                className="bg-ax-surface border border-ax-border rounded-ax-card p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`w-8 h-8 rounded-ax-control flex items-center justify-center shrink-0 ${tc.color}`}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="text-sm font-black text-ax-text break-words min-w-0">{entry.title}</p>
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-ax-badge ${tc.color}`}>
                          {tc.label}
                        </span>
                      </div>
                      {entry.body && (
                        <p className="text-xs text-ax-text-secondary whitespace-pre-wrap break-words">{entry.body}</p>
                      )}
                      <p className="text-[10px] text-ax-text-secondary mt-2">
                        {new Date(entry.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(entry)}
                      aria-label={`Modifier l'entrée « ${entry.title} »`}
                      className={`${ICON_BUTTON} hover:text-ax-info hover:bg-ax-info-soft`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => askDelete(entry)}
                      aria-label={`Supprimer l'entrée « ${entry.title} »`}
                      className={`${ICON_BUTTON} hover:text-ax-danger hover:bg-ax-danger-soft`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
