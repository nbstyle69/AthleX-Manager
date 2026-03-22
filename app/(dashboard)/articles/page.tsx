'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Newspaper, Plus, Trash2, Loader2, X, Image as ImageIcon, MessageCircle, Heart } from 'lucide-react';

interface Article {
  id: string;
  box_id: string;
  title: string;
  content: string;
  image_url: string | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
}

const EMPTY = { title: '', content: '', image_url: '' };

export default function ArticlesPage() {
  const supabase = createClient();

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [boxId, setBoxId] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [editArticle, setEditArticle] = useState<Article | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: box } = await supabase.from('boxes').select('id').eq('owner_id', user.id).single();
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
    setForm({ title: article.title, content: article.content, image_url: article.image_url ?? '' });
    setFormError(null);
    setModal(true);
  }

  async function saveArticle() {
    if (!form.title.trim() || !form.content.trim() || !boxId) return;
    setSaving(true);
    setFormError(null);

    const payload = {
      box_id: boxId,
      title: form.title.trim(),
      content: form.content.trim(),
      image_url: form.image_url.trim() || null,
    };

    if (editArticle) {
      const { error } = await supabase.from('box_articles').update(payload).eq('id', editArticle.id);
      if (error) { setSaving(false); setFormError(error.message); return; }
    } else {
      const { error } = await supabase.from('box_articles').insert(payload);
      if (error) { setSaving(false); setFormError(error.message); return; }
    }

    setSaving(false);
    setModal(false);
    load();
  }

  async function deleteArticle(article: Article) {
    if (!confirm(`Supprimer "${article.title}" ?`)) return;
    await supabase.from('box_articles').delete().eq('id', article.id);
    load();
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Loader2 size={28} className="animate-spin text-[#C9A227]" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Actualités</h1>
          <p className="text-sm text-gray-400 mt-1">{articles.length} article(s)</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-[#C9A227] hover:bg-[#B8911F] text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
          <Plus size={16} /> Nouvel article
        </button>
      </div>

      {articles.length === 0 ? (
        <div className="bg-[#111111] border border-white/8 rounded-2xl p-12 text-center">
          <Newspaper size={40} className="text-gray-600 mx-auto mb-4" />
          <p className="text-white font-bold mb-1">Aucun article</p>
          <p className="text-sm text-gray-500">Publiez des actualités pour vos membres.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {articles.map(a => (
            <div key={a.id} className="bg-[#111111] border border-white/8 rounded-2xl p-5 hover:border-white/12 transition-colors">
              <div className="flex items-start gap-4">
                {a.image_url && (
                  <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-white/5">
                    <img src={a.image_url} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-white">{a.title}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEdit(a)} className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
                        <Newspaper size={14} />
                      </button>
                      <button onClick={() => deleteArticle(a)} className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 line-clamp-2">{a.content}</p>
                  <div className="flex items-center gap-4 mt-3">
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Heart size={12} /> {a.likes_count}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-white">
                {editArticle ? 'Modifier l\'article' : 'Nouvel article'}
              </h2>
              <button onClick={() => setModal(false)} className="p-1 rounded-lg hover:bg-white/5 text-gray-400">
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Titre *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Titre de l'article"
                className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A227]/50" />
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Contenu *</label>
              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                rows={6} placeholder="Rédigez votre article…"
                className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A227]/50 resize-none" />
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                <ImageIcon size={10} className="inline mr-1" /> URL image (optionnel)
              </label>
              <input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                placeholder="https://…"
                className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A227]/50" />
            </div>

            {formError && <p className="text-xs text-red-400">{formError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModal(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                Annuler
              </button>
              <button onClick={saveArticle} disabled={saving || !form.title.trim() || !form.content.trim()}
                className="flex items-center gap-2 bg-[#C9A227] hover:bg-[#B8911F] text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {editArticle ? 'Modifier' : 'Publier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
