'use client';

import { useState, useEffect, useCallback } from 'react';
import HelpButton from '@/components/help/HelpButton';
import { createClient } from '@/lib/supabase/client';
import { Newspaper, Plus, Trash2, Loader2, X, Image as ImageIcon, MessageCircle, Heart } from 'lucide-react';
import { getMyBox } from '@/lib/getMyBox';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { ERROR_TITLE, fullDate } from '@/lib/confirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Article {
  id: string;
  box_id: string;
  title: string;
  body: string;
  image_url: string | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
}

const EMPTY = { title: '', body: '', image_url: '' };

export default function ArticlesPage() {
  const supabase = createClient();
  const { dialog, ask, inform } = useConfirmDialog();

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [boxId, setBoxId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [editArticle, setEditArticle] = useState<Article | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const box = await getMyBox(supabase);
      if (box) setBoxId(box.id);
    })();
  }, []);

  const load = useCallback(async () => {
    if (!boxId) return;
    setLoading(true);
    const { data } = await supabase
      .from('box_articles')
      .select('*')
      .eq('box_id', boxId)
      .order('created_at', { ascending: false });

    const articles = data ?? [];

    // Fetch counts
    const enriched: Article[] = await Promise.all(
      articles.map(async (a: any) => {
        const [{ count: likes }, { count: comments }] = await Promise.all([
          supabase.from('box_article_likes').select('*', { count: 'exact', head: true }).eq('article_id', a.id),
          supabase.from('box_article_comments').select('*', { count: 'exact', head: true }).eq('article_id', a.id),
        ]);
        return { ...a, likes_count: likes ?? 0, comments_count: comments ?? 0 };
      })
    );

    setArticles(enriched);
    setLoading(false);
  }, [boxId]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditArticle(null);
    setForm(EMPTY);
    setFormError(null);
    setModal(true);
  }

  function openEdit(article: Article) {
    setEditArticle(article);
    setForm({ title: article.title, body: article.body, image_url: article.image_url ?? '' });
    setFormError(null);
    setModal(true);
  }

  async function saveArticle() {
    if (!form.title.trim() || !form.body.trim() || !boxId) return;
    setSaving(true);
    setFormError(null);

    const base = {
      title: form.title.trim(),
      body: form.body.trim(),
      image_url: form.image_url.trim() || null,
    };

    if (editArticle) {
      const { error } = await supabase.from('box_articles').update(base).eq('id', editArticle.id);
      if (error) { setSaving(false); setFormError(error.message); return; }
    } else {
      const { error } = await supabase.from('box_articles').insert({ ...base, box_id: boxId, author_id: userId });
      if (error) { setSaving(false); setFormError(error.message); return; }
    }

    setSaving(false);
    setModal(false);
    load();
  }

  function askDeleteArticle(article: Article) {
    ask({
      title: 'Supprimer cet article ?',
      element: `${article.title} — publié le ${fullDate(article.created_at)} · ${article.likes_count} j’aime · ${article.comments_count} commentaire(s)`,
      body: 'L’article disparaît du fil de la box avec ses commentaires et ses j’aime. Cette action est définitive.',
      confirmLabel: 'Supprimer l’article',
      danger: true,
      run: () => deleteArticle(article),
    });
  }

  async function deleteArticle(article: Article) {
    const { error } = await supabase.from('box_articles').delete().eq('id', article.id);
    if (error) inform({ kind: 'error', title: ERROR_TITLE, body: error.message });
    load();
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Loader2 size={28} className="animate-spin text-ax-text" />
    </div>
  );

  return (
    <div className="space-y-6">
      {dialog}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-medium uppercase tracking-wide text-ax-text">Actualités</h1>
            <HelpButton />
          </div>
          <p className="text-sm text-ax-text-secondary mt-1">{articles.length} article(s)</p>
        </div>
        <Button onClick={openCreate} variant="ax-white">
          <Plus size={16} /> Nouvel article
        </Button>
      </div>

      {articles.length === 0 ? (
        <div className="bg-ax-surface border border-ax-border rounded-ax-card p-12 text-center">
          <Newspaper size={40} className="text-ax-text-muted mx-auto mb-4" />
          <p className="text-ax-text font-bold mb-1">Aucun article</p>
          <p className="text-sm text-ax-text-muted">Publiez des actualités pour vos membres.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {articles.map(a => (
            <div key={a.id} className="bg-ax-surface border border-ax-border rounded-ax-card p-5 hover:border-ax-input-border transition-colors">
              <div className="flex items-start gap-4">
                {a.image_url && (
                  <div className="w-20 h-20 rounded-ax-control overflow-hidden shrink-0 bg-ax-hover">
                    <img src={a.image_url} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-ax-text">{a.title}</h3>
                      <p className="text-xs text-ax-text-muted mt-0.5">
                        {new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEdit(a)} className="p-2 rounded-ax-control hover:bg-ax-hover text-ax-text-secondary hover:text-ax-text transition-colors">
                        <Newspaper size={14} />
                      </button>
                      <button onClick={() => askDeleteArticle(a)} className="p-2 rounded-ax-control hover:bg-ax-danger-soft text-ax-text-secondary hover:text-ax-danger transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-ax-text-secondary mt-2 line-clamp-2">{a.body}</p>
                  <div className="flex items-center gap-4 mt-3">
                    <span className="flex items-center gap-1.5 text-xs text-ax-text-muted">
                      <Heart size={12} /> {a.likes_count}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-ax-text-muted">
                      <MessageCircle size={12} /> {a.comments_count}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal create/edit */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ax-overlay backdrop-blur-sm">
          <div className="bg-ax-surface border border-ax-border rounded-ax-card w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-ax-text">
                {editArticle ? 'Modifier l\'article' : 'Nouvel article'}
              </h2>
              <button onClick={() => setModal(false)} className="p-1 rounded-ax-control hover:bg-ax-hover text-ax-text-secondary">
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="text-[10px] font-bold text-ax-text-muted uppercase tracking-wider mb-1 block">Titre *</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Titre de l'article" />
            </div>

            <div>
              <label className="text-[10px] font-bold text-ax-text-muted uppercase tracking-wider mb-1 block">Contenu *</label>
              <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                rows={6} placeholder="Rédigez votre article…"
                className="w-full rounded-ax-control border border-ax-input-border bg-ax-surface px-3 py-2.5 text-sm text-ax-text placeholder:text-ax-text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface motion-reduce:transition-none resize-none" />
            </div>

            <div>
              <label className="text-[10px] font-bold text-ax-text-muted uppercase tracking-wider mb-1 block">
                <ImageIcon size={10} className="inline mr-1" /> URL image (optionnel)
              </label>
              <Input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                placeholder="https://…" />
            </div>

            {formError && <p className="text-xs text-ax-danger">{formError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModal(false)}
                className="px-4 py-2.5 rounded-ax-control text-sm font-semibold text-ax-text-secondary hover:text-ax-text hover:bg-ax-hover transition-colors">
                Annuler
              </button>
              <Button onClick={saveArticle} disabled={saving || !form.title.trim() || !form.body.trim()} variant="ax-white">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {editArticle ? 'Modifier' : 'Publier'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
