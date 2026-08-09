'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getMyBox } from '@/lib/getMyBox';
import { writeFailure } from '@/lib/writeGuard';
import { Upload, ImageIcon, Trash2, CheckCircle, Phone, MapPin, Calendar, User, Users, FileText } from 'lucide-react';

type GeoResult = {
  latitude: number;
  longitude: number;
  city: string | null;
  postal_code: string | null;
  country: string | null;
};

// Extrait des coordonnées d'un lien Google Maps (le plus fiable : pin exact).
function parseLatLngFromGoogleMapsUrl(url: string): { latitude: number; longitude: number } | null {
  if (!url) return null;
  // !3d<lat>!4d<lng> = position exacte du lieu (prioritaire)
  let m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (m) return { latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) };
  // @<lat>,<lng> = centre de la vue (fallback)
  m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) };
  // q=/query=/ll=<lat>,<lng>
  m = url.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) };
  return null;
}

// Géocode une adresse en coordonnées via Nominatim (OpenStreetMap, gratuit, sans clé API).
async function geocodeAddress(address: string): Promise<GeoResult | null> {
  try {
    const url =
      'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=fr&limit=1&q=' +
      encodeURIComponent(address);
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'fr' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const hit = data[0];
    // Rejette les résultats trop vagues (pays, région, département) → évite un marqueur faux.
    const vague = ['country', 'state', 'region', 'county', 'administrative'];
    if (hit.addresstype && vague.includes(hit.addresstype)) return null;
    const lat = parseFloat(hit.lat);
    const lon = parseFloat(hit.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    const a = hit.address ?? {};
    return {
      latitude: lat,
      longitude: lon,
      city: a.city ?? a.town ?? a.village ?? a.municipality ?? null,
      postal_code: a.postcode ?? null,
      country: a.country ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Colonnes de `boxes` lues avec le JWT de l'owner. Jamais `*` : la Phase 3
 * révoque `invite_code`, `stripe_account_id` et `dunning_grace_days` à
 * `authenticated`. Le délai d'impayé passe par /api/box/dunning.
 */
const BOX_SETTINGS_COLUMNS = 'id, owner_id, name, slug, tagline, description, logo_url, cover_url, terms_pdf_url, address, city, postal_code, country, latitude, longitude, phone, contact_email, website_url, instagram_url, google_maps_url, founded_at, is_active, is_listed' as const;

export default function SettingsPage() {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const termsRef = useRef<HTMLInputElement>(null);

  const [box, setBox] = useState<any>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [savedCover, setSavedCover] = useState(false);
  const [termsPdfUrl, setTermsPdfUrl] = useState<string | null>(null);
  const [uploadingTerms, setUploadingTerms] = useState(false);
  const [savedTerms, setSavedTerms] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [savedInfo, setSavedInfo] = useState(false);
  const [foundedAt, setFoundedAt] = useState('');
  const [dunningGraceDays, setDunningGraceDays] = useState('7');
  const [ownerName, setOwnerName] = useState('');
  const [coaches, setCoaches] = useState<{id:string; username:string; avatar_url:string|null}[]>([]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const active = await getMyBox(supabase, user.id);
      if (!active) return;

      const { data: boxData } = await supabase
        .from('boxes').select(BOX_SETTINGS_COLUMNS).eq('id', active.id).maybeSingle();

      if (!boxData) return;

      // Set box immediately → spinner disappears
      setBox(boxData);
      setLogoUrl(boxData.logo_url ?? null);
      setCoverUrl(boxData.cover_url ?? null);
      setTermsPdfUrl(boxData.terms_pdf_url ?? null);
      setName(boxData.name ?? '');
      setDescription(boxData.description ?? '');
      setAddress(boxData.address ?? '');
      setWebsiteUrl(boxData.website_url ?? '');
      setContactEmail(boxData.contact_email ?? '');
      setPhone(boxData.phone ?? '');
      setGoogleMapsUrl(boxData.google_maps_url ?? '');
      setFoundedAt(boxData.founded_at ?? '');
      const dunningRes = await fetch('/api/box/dunning');
      if (dunningRes.ok) {
        const dunning = await dunningRes.json();
        setDunningGraceDays(String(dunning.dunning_grace_days ?? 7));
      }

      // Fetch owner + coaches in parallel
      const [ownerRes, coachRes] = await Promise.all([
        boxData.owner_id
          ? supabase.from('profiles').select('username').eq('id', boxData.owner_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from('box_members')
          .select('member_id, profiles:member_id(username, avatar_url)')
          .eq('box_id', boxData.id)
          .eq('role', 'coach'),
      ]);

      if (ownerRes.data) setOwnerName((ownerRes.data as any).username ?? '');
      if (coachRes.data) {
        setCoaches((coachRes.data as any[]).map((c: any) => ({
          id: c.member_id,
          username: (Array.isArray(c.profiles) ? c.profiles[0] : c.profiles)?.username ?? 'Coach',
          avatar_url: (Array.isArray(c.profiles) ? c.profiles[0] : c.profiles)?.avatar_url ?? null,
        })));
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
    const { data: updated, error: updateError } = await supabase
      .from('boxes')
      .update({ logo_url: publicUrl })
      .eq('id', box.id)
      .select('id');

    const updateFail = writeFailure(updateError, updated);
    if (updateFail) {
      alert(`Erreur mise à jour: ${updateFail}`);
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

    const { data, error } = await supabase
      .from('boxes')
      .update({ logo_url: null })
      .eq('id', box.id)
      .select('id');

    const fail = writeFailure(error, data);
    if (fail) alert(`Suppression du logo impossible : ${fail}`);
    else setLogoUrl(null);
    setUploading(false);
  }

  async function handleUploadCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !box) return;

    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image (PNG, JPG, WEBP).');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      alert('L\'image ne doit pas dépasser 4 Mo.');
      return;
    }

    setUploadingCover(true);
    setSavedCover(false);

    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${box.id}/cover.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('box-logos')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      alert(`Erreur upload: ${uploadError.message}`);
      setUploadingCover(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('box-logos').getPublicUrl(path);
    const publicUrl = urlData.publicUrl + '?t=' + Date.now();

    const { data: updated, error: updateError } = await supabase
      .from('boxes')
      .update({ cover_url: publicUrl })
      .eq('id', box.id)
      .select('id');

    const updateFail = writeFailure(updateError, updated);
    if (updateFail) {
      alert(`Erreur mise à jour: ${updateFail}`);
    } else {
      setCoverUrl(publicUrl);
      setSavedCover(true);
      setTimeout(() => setSavedCover(false), 3000);
    }

    setUploadingCover(false);
  }

  async function handleRemoveCover() {
    if (!box) return;
    setUploadingCover(true);
    const { data, error } = await supabase
      .from('boxes').update({ cover_url: null }).eq('id', box.id).select('id');
    const fail = writeFailure(error, data);
    if (fail) alert(`Suppression de la bannière impossible : ${fail}`);
    else setCoverUrl(null);
    setUploadingCover(false);
  }

  async function handleUploadTerms(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !box) return;

    if (file.type !== 'application/pdf') {
      alert('Veuillez sélectionner un fichier PDF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Le PDF ne doit pas dépasser 10 Mo.');
      return;
    }

    setUploadingTerms(true);
    setSavedTerms(false);

    const path = `${box.id}/terms.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('box-logos')
      .upload(path, file, { upsert: true, contentType: 'application/pdf' });

    if (uploadError) {
      alert(`Erreur upload: ${uploadError.message}`);
      setUploadingTerms(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('box-logos').getPublicUrl(path);
    const publicUrl = urlData.publicUrl + '?t=' + Date.now();

    const { data: updated, error: updateError } = await supabase
      .from('boxes')
      .update({ terms_pdf_url: publicUrl })
      .eq('id', box.id)
      .select('id');

    const updateFail = writeFailure(updateError, updated);
    if (updateFail) {
      alert(`Erreur mise à jour: ${updateFail}`);
    } else {
      setTermsPdfUrl(publicUrl);
      setSavedTerms(true);
      setTimeout(() => setSavedTerms(false), 3000);
    }

    setUploadingTerms(false);
  }

  async function handleRemoveTerms() {
    if (!box) return;
    setUploadingTerms(true);
    const { data, error } = await supabase
      .from('boxes').update({ terms_pdf_url: null }).eq('id', box.id).select('id');
    const fail = writeFailure(error, data);
    if (fail) alert(`Suppression du PDF impossible : ${fail}`);
    else setTermsPdfUrl(null);
    setUploadingTerms(false);
  }

  async function handleSaveInfo() {
    if (!box) return;
    if (!name.trim()) { alert('Le nom de la box est requis.'); return; }
    if (websiteUrl.trim() && !/^https?:\/\/.+/i.test(websiteUrl.trim())) {
      alert('Le site web doit commencer par http:// ou https://');
      return;
    }
    if (contactEmail.trim() && !contactEmail.trim().includes('@')) {
      alert('Vérifie le format de l\'email.');
      return;
    }
    if (googleMapsUrl.trim() && !/^https?:\/\/.+/i.test(googleMapsUrl.trim())) {
      alert('Le lien Google Maps doit commencer par http:// ou https://');
      return;
    }

    const graceDays = Number(dunningGraceDays);
    if (!Number.isInteger(graceDays) || graceDays < 0 || graceDays > 90) {
      alert('Le délai avant suspension doit être un nombre de jours entre 0 et 90.');
      return;
    }

    setSavingInfo(true);
    setSavedInfo(false);

    const trimmedAddress = address.trim();
    const payload: Record<string, any> = {
      name: name.trim(),
      description: description.trim() || null,
      address: trimmedAddress || null,
      website_url: websiteUrl.trim() || null,
      contact_email: contactEmail.trim() || null,
      phone: phone.trim() || null,
      google_maps_url: googleMapsUrl.trim() || null,
      founded_at: foundedAt || null,
    };

    // Coordonnées pour l'affichage sur la carte (app mobile + page publique).
    // Priorité 1 : lien Google Maps (pin exact). Priorité 2 : géocodage de l'adresse.
    const trimmedMaps = googleMapsUrl.trim();
    const coordsFromUrl = parseLatLngFromGoogleMapsUrl(trimmedMaps);

    if (coordsFromUrl) {
      payload.latitude = coordsFromUrl.latitude;
      payload.longitude = coordsFromUrl.longitude;
    } else if (trimmedAddress) {
      // Re-géocode seulement si l'adresse a changé (ou si pas encore de coordonnées).
      if (trimmedAddress !== (box.address ?? '') || box.latitude == null || box.longitude == null) {
        const geo = await geocodeAddress(trimmedAddress);
        if (geo) {
          payload.latitude = geo.latitude;
          payload.longitude = geo.longitude;
          if (geo.city) payload.city = geo.city;
          if (geo.postal_code) payload.postal_code = geo.postal_code;
          if (geo.country) payload.country = geo.country;
        } else {
          alert("Adresse introuvable : impossible de la situer précisément. Vérifie l'adresse (rue, code postal, ville) ou colle le lien Google Maps du lieu.");
        }
      }
    } else {
      // Ni lien ni adresse → on retire les coordonnées.
      payload.latitude = null;
      payload.longitude = null;
    }

    const dunningRes = await fetch('/api/box/dunning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dunning_grace_days: graceDays }),
    });
    if (!dunningRes.ok) {
      const json = await dunningRes.json().catch(() => ({ error: 'Erreur' }));
      alert(`Erreur: ${json.error ?? 'délai avant suspension non enregistré'}`);
      setSavingInfo(false);
      return;
    }

    const { data: updated, error } = await supabase.from('boxes')
      .update(payload).eq('id', box.id).select(BOX_SETTINGS_COLUMNS).maybeSingle();

    if (error || !updated) {
      alert(`Erreur: ${error?.message ?? 'aucune ligne modifiée (droits insuffisants)'}`);
    } else {
      if (updated) setBox(updated);
      setSavedInfo(true);
      setTimeout(() => setSavedInfo(false), 3000);
    }
    setSavingInfo(false);
  }

  if (!box) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/20 text-white text-sm font-bold hover:bg-white/30 transition-colors disabled:opacity-50"
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

      {/* Banner / cover section */}
      <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-6 space-y-5">
        <div>
          <h2 className="text-sm font-bold text-white mb-1">Bannière de la box</h2>
          <p className="text-xs text-gray-500">
            Image d&apos;en-tête affichée sur votre page publique et dans l&apos;annuaire des box.
            Format recommandé : paysage, 1200×400px, PNG ou JPG, max 4 Mo.
          </p>
        </div>

        {/* Preview */}
        <div className="w-full h-36 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden bg-white/[0.03] relative">
          {coverUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverUrl} alt="Bannière box" className="w-full h-full object-cover" />
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  className="absolute bottom-3 left-4 w-14 h-14 rounded-xl border-2 border-[#111] object-cover shadow-lg"
                />
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-gray-600">
              <ImageIcon size={28} />
              <span className="text-xs">Aucune bannière</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={coverRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleUploadCover}
            className="hidden"
          />
          <button
            onClick={() => coverRef.current?.click()}
            disabled={uploadingCover}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/20 text-white text-sm font-bold hover:bg-white/30 transition-colors disabled:opacity-50"
          >
            <Upload size={15} />
            {uploadingCover ? 'Upload en cours…' : coverUrl ? 'Changer la bannière' : 'Uploader une bannière'}
          </button>

          {coverUrl && (
            <button
              onClick={handleRemoveCover}
              disabled={uploadingCover}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 text-red-400 text-sm font-bold hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              <Trash2 size={15} />
              Supprimer la bannière
            </button>
          )}

          {savedCover && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <CheckCircle size={14} />
              Bannière mise à jour !
            </div>
          )}
        </div>
      </div>

      {/* Conditions générales (CGV) PDF section */}
      <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-6 space-y-5">
        <div>
          <h2 className="text-sm font-bold text-white mb-1">Conditions générales (PDF)</h2>
          <p className="text-xs text-gray-500">
            Document PDF présentant les conditions propres à ta salle (engagement, résiliation, gel, règlement intérieur…).
            Il est proposé aux futurs membres <strong>avant le paiement</strong> et reste accessible dans leur espace athlète. PDF, max 10 Mo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {termsPdfUrl && (
            <a
              href={termsPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] text-gray-200 text-sm font-bold hover:bg-white/10 transition-colors"
            >
              <FileText size={15} />
              Voir le PDF actuel
            </a>
          )}
          <input
            ref={termsRef}
            type="file"
            accept="application/pdf"
            onChange={handleUploadTerms}
            className="hidden"
          />
          <button
            onClick={() => termsRef.current?.click()}
            disabled={uploadingTerms}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/20 text-white text-sm font-bold hover:bg-white/30 transition-colors disabled:opacity-50"
          >
            <Upload size={15} />
            {uploadingTerms ? 'Upload en cours…' : termsPdfUrl ? 'Changer le PDF' : 'Uploader un PDF'}
          </button>

          {termsPdfUrl && (
            <button
              onClick={handleRemoveTerms}
              disabled={uploadingTerms}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 text-red-400 text-sm font-bold hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              <Trash2 size={15} />
              Supprimer le PDF
            </button>
          )}

          {savedTerms && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <CheckCircle size={14} />
              Conditions mises à jour !
            </div>
          )}
        </div>
      </div>

      {/* Box info section */}
      <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-6 space-y-5">
        <div>
          <h2 className="text-sm font-bold text-white mb-1">Informations de la box</h2>
          <p className="text-xs text-gray-500">
            Ces informations sont visibles par tous les membres dans l&apos;application mobile.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              Nom de la box *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom de ma salle ici"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/40 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Présente ta box : ambiance, coachs, spécialités, équipements… (visible sur ta page publique)"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/40 transition-colors resize-y"
            />
            <p className="text-[11px] text-gray-600 mt-1.5">
              Affichée dans la section « À propos » de ta page publique AthleX.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              Adresse
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="12 rue du Sport, 69001 Lyon"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/40 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              Site web
            </label>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://www.mabox.fr"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/40 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              Email de contact
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="contact@mabox.fr"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/40 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              Téléphone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+33 6 12 34 56 78"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/40 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              Lien Google Maps
            </label>
            <input
              type="url"
              value={googleMapsUrl}
              onChange={(e) => setGoogleMapsUrl(e.target.value)}
              placeholder="https://maps.google.com/..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/40 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              Date d&apos;ouverture de la salle
            </label>
            <input
              type="date"
              value={foundedAt}
              onChange={(e) => setFoundedAt(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/40 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              Impayé : délai avant suspension (jours)
            </label>
            <input
              type="number"
              min={0}
              max={90}
              value={dunningGraceDays}
              onChange={(e) => setDunningGraceDays(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/40 transition-colors"
            />
            <p className="text-xs text-gray-500 mt-1.5">
              Passé ce délai après un prélèvement refusé, le membre ne peut plus réserver. L&apos;accès est rétabli dès le paiement. 0 = suspension immédiate.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSaveInfo}
            disabled={savingInfo}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-bold hover:bg-[#d4ad2e] transition-colors disabled:opacity-50"
          >
            {savingInfo ? 'Enregistrement…' : 'Enregistrer'}
          </button>

          {savedInfo && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <CheckCircle size={14} />
              Informations mises à jour !
            </div>
          )}
        </div>
      </div>

      {/* Read-only info section */}
      <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-6 space-y-5">
        <div>
          <h2 className="text-sm font-bold text-white mb-1">Détails de la box</h2>
          <p className="text-xs text-gray-500">
            Informations automatiques (non modifiables).
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <User size={16} className="text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Propriétaire</p>
              <p className="text-sm text-white font-semibold">{ownerName || '—'}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <Users size={16} className="text-purple-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Coachs</p>
              {coaches.length === 0 ? (
                <p className="text-sm text-gray-500 italic">Aucun coach assigné</p>
              ) : (
                <div className="flex flex-wrap gap-2 mt-1">
                  {coaches.map(c => (
                    <div key={c.id} className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5">
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-purple-500/30 flex items-center justify-center text-[9px] font-black text-purple-300">
                          {c.username[0]?.toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm text-white font-medium">{c.username}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
