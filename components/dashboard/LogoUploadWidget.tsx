'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getMyBox } from '@/lib/getMyBox';
import { writeFailure } from '@/lib/writeGuard';
import { Upload, ImageIcon, Trash2, CheckCircle } from 'lucide-react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { ERROR_TITLE, INPUT_TITLE } from '@/lib/confirmDialog';
import { Button } from '@/components/ui/button';

export default function LogoUploadWidget() {
  const { dialog, inform } = useConfirmDialog();
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
      const active = await getMyBox(supabase);
      if (!active) return;
      const { data } = await supabase
        .from('boxes')
        .select('id, logo_url')
        .eq('id', active.id)
        .maybeSingle();
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
      inform({ kind: 'info', title: INPUT_TITLE, body: 'Veuillez sélectionner une image (PNG, JPG, WEBP).' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      inform({ kind: 'info', title: INPUT_TITLE, body: "L'image ne doit pas dépasser 2 Mo." });
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
      inform({ kind: 'error', title: ERROR_TITLE, body: `Erreur upload: ${uploadError.message}` });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('box-logos')
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl + '?t=' + Date.now();

    const { data: updated, error: updateError } = await supabase
      .from('boxes')
      .update({ logo_url: publicUrl })
      .eq('id', boxId)
      .select('id');

    const updateFail = writeFailure(updateError, updated);
    if (updateFail) {
      inform({ kind: 'error', title: ERROR_TITLE, body: `Erreur mise à jour: ${updateFail}` });
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

    const { data, error } = await supabase
      .from('boxes')
      .update({ logo_url: null })
      .eq('id', boxId)
      .select('id');

    const fail = writeFailure(error, data);
    if (fail) inform({ kind: 'error', title: ERROR_TITLE, body: `Suppression du logo impossible : ${fail}` });
    else setLogoUrl(null);
    setUploading(false);
  }

  return (
    <div className="bg-ax-surface border border-ax-border rounded-ax-card p-6">
      {dialog}
      <h2 className="text-sm font-bold text-ax-text mb-1">Logo de la box</h2>
      <p className="text-xs text-ax-text-muted mb-4">
        Visible par tous les membres dans l&apos;app mobile. Carré, 512×512px min, max 2 Mo.
      </p>

      <div className="flex items-center gap-5">
        <div className="w-20 h-20 rounded-ax-card border-2 border-dashed border-ax-border flex items-center justify-center overflow-hidden bg-ax-hover shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo box" className="w-full h-full object-cover rounded-ax-card" />
          ) : (
            <ImageIcon size={28} className="text-ax-text-muted" />
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
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            variant="ax-outline"
            size="ax-compact"
          >
            <Upload size={14} />
            {uploading ? 'Upload…' : logoUrl ? 'Changer' : 'Uploader'}
          </Button>

          {logoUrl && (
            <button
              onClick={handleRemove}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 rounded-ax-control border border-ax-danger bg-ax-danger-soft text-ax-danger text-xs font-bold hover:brightness-110 transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} />
              Supprimer
            </button>
          )}

          {saved && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-ax-success">
              <CheckCircle size={13} />
              Logo mis à jour !
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
