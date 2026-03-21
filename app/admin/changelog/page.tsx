'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FileText, Plus, Pencil, Trash2, X, Bug, Sparkles, RefreshCw } from 'lucide-react';

interface ChangelogEntry {
  id: string;
  title: string;
  body: string;
  type: 'fix' | 'feature' | 'update';
  created_at: string;
  created_by: string | null;
}

const TYPE_OPTIONS: { value: ChangelogEntry['type']; label: string; icon: any; color: string }[] = [
  { value: 'feature', label: 'Feature', icon: Sparkles, color: 'text-emerald-400 bg-emerald-500/15' },
  { value: 'fix', label: 'Fix', icon: Bug, color: 'text-red-400 bg-red-500/15' },
  { value: 'update', label: 'Update', icon: RefreshCw, color: 'text-blue-400 bg-blue-500/15' },
];

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

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette entrée ?')) return;
    await supabase.from('app_changelog').delete().eq('id', id);
    load();
  }

  const typeConfig = (t: string) => TYPE_OPTIONS.find(o => o.value === t) ?? TYPE_OPTIONS[2];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <FileText size={22} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Changelog</h1>
            <p className="text-sm text-gray-400">{entries.length} entrées · affiché dans l'app mobile</p>
          </div>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 text-sm font-bold hover:bg-emerald-500/30 transition-all border border-emerald-500/20"
        >
          <Plus size={16} />
          Nouvelle entrée
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111111] border border-white/[0.08] rounded-2xl p-6 w-full max-w-lg mx-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-white">
                {editing ? 'Modifier l\'entrée' : 'Nouvelle entrée'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white">
                <X size={20} />
              </button>
            </div>

            {/* Type selector */}
            <div className="flex gap-2 mb-4">
              {TYPE_OPTIONS.map(opt => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setType(opt.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                      type === opt.value
                        ? `${opt.color} border-current`
                        : 'bg-white/5 text-gray-500 border-white/10 hover:text-white'
                    }`}
                  >
                    <Icon size={14} />
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Title */}
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Titre de l'entrée..."
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 mb-3"
            />

            {/* Body */}
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Description détaillée (optionnel)..."
              rows={5}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 mb-4 resize-none"
            />

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 text-gray-400 text-sm font-bold hover:bg-white/10 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !title.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 text-sm font-bold hover:bg-emerald-500/30 transition-all disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : editing ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-20">
          <FileText size={40} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Aucune entrée de changelog</p>
          <button onClick={openNew} className="mt-3 text-emerald-400 text-sm font-bold hover:underline">
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
                className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5 hover:border-white/10 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tc.color}`}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-black text-white">{entry.title}</p>
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg ${tc.color}`}>
                          {entry.type}
                        </span>
                      </div>
                      {entry.body && (
                        <p className="text-xs text-gray-400 whitespace-pre-wrap">{entry.body}</p>
                      )}
                      <p className="text-[10px] text-gray-600 mt-2">
                        {new Date(entry.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(entry)}
                      className="p-2 rounded-lg text-gray-600 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
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
