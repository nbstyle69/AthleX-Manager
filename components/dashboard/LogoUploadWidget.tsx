'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Upload, ImageIcon, Trash2, CheckCircle } from 'lucide-react';

export default function LogoUploadWidget() {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [boxId, setBoxId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('boxes')
        .select('id, logo_url')
        .eq('owner_id', user.id)
        .single();
      if (data) {
        setBoxId(data.id);
        setLogoUrl(data.logo_url ?? null);
      }
    }
    load();
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !boxId) return;

    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image (PNG, JPG, WEBP).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("L'image ne doit pas dépasser 2 Mo.");
      return;
    }

    setUploading(true);
    setSaved(false);

    const ext = file.name.split('.').pop() ?? 'png';
    const path = `${boxId}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('box-logos')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      alert(`Erreur upload: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('box-logos')
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl + '?t=' + Date.now();

    const { error: updateError } = await supabase
      .from('boxes')
      .update({ logo_url: publicUrl })
      .eq('id', boxId);

    if (updateError) {
      alert(`Erreur mise à jour: ${updateError.message}`);
    } else {
      setLogoUrl(publicUrl);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }

    setUploading(false);
  }

  async function handleRemove() {
    if (!boxId) return;
    setUploading(true);

    await supabase
      .from('boxes')
      .update({ logo_url: null })
      .eq('id', boxId);

    setLogoUrl(null);
    setUploading(false);
  }

  return (
    <div className="bg-[#111111] border border-white/8 rounded-2xl p-6">
      <h2 className="text-sm font-bold text-white mb-1">Logo de la box</h2>
      <p className="text-xs text-gray-500 mb-4">
        Visible par tous les membres dans l&apos;app mobile. Carré, 512×512px min, max 2 Mo.
      </p>

      <div className="flex items-center gap-5">
        <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden bg-white/[0.03] shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo box" className="w-full h-full object-cover rounded-2xl" />
          ) : (
            <ImageIcon size={28} className="text-gray-600" />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 text-white text-xs font-bold hover:bg-white/30 transition-colors disabled:opacity-50"
          >
            <Upload size={14} />
            {uploading ? 'Upload…' : logoUrl ? 'Changer' : 'Uploader'}
          </button>

          {logoUrl && (
            <button
              onClick={handleRemove}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} />
              Supprimer
            </button>
          )}

          {saved && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <CheckCircle size={13} />
              Logo mis à jour !
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
