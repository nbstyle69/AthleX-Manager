'use client';

import { useRef, useState } from 'react';
import { Loader2, Check, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  userId: string;
  email: string;
  username: string;
  fullName: string;
  bio: string;
  avatarUrl: string;
}

export default function AccountProfileForm({ userId, email, username, fullName, bio, avatarUrl }: Props) {
  const supabase = createClient();
  const [form, setForm] = useState({ username, full_name: fullName, bio });
  const [avatar, setAvatar] = useState(avatarUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatar(data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l\'upload de la photo.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!form.username.trim()) {
      setError('Le pseudo est obligatoire.');
      return;
    }
    setSaving(true);
    setError(null);
    setDone(false);
    const { error: updErr } = await supabase
      .from('profiles')
      .update({
        username: form.username.trim(),
        full_name: form.full_name.trim() || null,
        bio: form.bio.trim() || null,
        avatar_url: avatar || null,
      })
      .eq('id', userId);
    setSaving(false);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    setDone(true);
    setTimeout(() => setDone(false), 3000);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
          {avatar
            ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
            : <span className="text-gray-600 text-xl font-black">{(form.username || '?').charAt(0).toUpperCase()}</span>}
        </div>
        <div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-300 bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 transition-all disabled:opacity-60"
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {uploading ? 'Envoi…' : 'Changer la photo'}
          </button>
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-gray-400 mb-1 block">E-mail</label>
        <input
          value={email}
          disabled
          className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-500 outline-none cursor-not-allowed"
        />
        <p className="text-[11px] text-gray-600 mt-1">Pour changer d'e-mail, utilise l'application mobile.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-gray-400 mb-1 block">Pseudo *</label>
          <input
            value={form.username}
            onChange={e => setForm({ ...form, username: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-400 mb-1 block">Nom complet</label>
          <input
            value={form.full_name}
            onChange={e => setForm({ ...form, full_name: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-gray-400 mb-1 block">Bio</label>
        <textarea
          value={form.bio}
          onChange={e => setForm({ ...form, bio: e.target.value })}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50 min-h-[70px]"
          placeholder="Quelques mots sur toi…"
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold transition-all flex items-center gap-2"
        >
          {saving && <Loader2 size={15} className="animate-spin" />}
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {done && <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold"><Check size={14} /> Enregistré</span>}
      </div>
    </div>
  );
}
