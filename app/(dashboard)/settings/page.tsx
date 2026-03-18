'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Upload, ImageIcon, Trash2, CheckCircle } from 'lucide-react';

export default function SettingsPage() {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [box, setBox] = useState<any>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('boxes')
        .select('*')
        .eq('owner_id', user.id)
        .single();
      if (data) {
        setBox(data);
        setLogoUrl(data.logo_url ?? null);
      }
    }
    load();
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !box) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image (PNG, JPG, WEBP).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('L\'image ne doit pas dépasser 2 Mo.');
      return;
    }

    setUploading(true);
    setSaved(false);

    const ext = file.name.split('.').pop() ?? 'png';
    const path = `${box.id}/logo.${ext}`;

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from('box-logos')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      alert(`Erreur upload: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('box-logos')
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl + '?t=' + Date.now();

    // Update box record
    const { error: updateError } = await supabase
      .from('boxes')
      .update({ logo_url: publicUrl })
      .eq('id', box.id);

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
    if (!box) return;
    setUploading(true);

    await supabase
      .from('boxes')
      .update({ logo_url: null })
      .eq('id', box.id);

    setLogoUrl(null);
    setUploading(false);
  }

  if (!box) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-[#C9A227]/30 border-t-[#C9A227] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-black text-white">Réglages</h1>
        <p className="text-sm text-gray-400 mt-1">Personnalisez votre box — {box.name}</p>
      </div>

      {/* Logo section */}
      <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-6 space-y-5">
        <div>
          <h2 className="text-sm font-bold text-white mb-1">Logo de la box</h2>
          <p className="text-xs text-gray-500">
            Ce logo sera visible par tous les membres de votre box dans l&apos;application mobile.
            Format recommandé : carré, 512×512px minimum, PNG ou JPG, max 2 Mo.
          </p>
        </div>

        <div className="flex items-center gap-6">
          {/* Preview */}
          <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden bg-white/[0.03] shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo box" className="w-full h-full object-cover rounded-2xl" />
            ) : (
              <ImageIcon size={32} className="text-gray-600" />
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
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
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C9A227]/20 text-[#C9A227] text-sm font-bold hover:bg-[#C9A227]/30 transition-colors disabled:opacity-50"
            >
              <Upload size={15} />
              {uploading ? 'Upload en cours…' : logoUrl ? 'Changer le logo' : 'Uploader un logo'}
            </button>

            {logoUrl && (
              <button
                onClick={handleRemove}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 text-red-400 text-sm font-bold hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                <Trash2 size={15} />
                Supprimer le logo
              </button>
            )}

            {saved && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                <CheckCircle size={14} />
                Logo mis à jour !
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
