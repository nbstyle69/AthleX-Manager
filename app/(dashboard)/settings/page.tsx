'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Upload, ImageIcon, Trash2, CheckCircle, Phone, MapPin, Calendar, User, Users } from 'lucide-react';

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

export default function SettingsPage() {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [box, setBox] = useState<any>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [savedInfo, setSavedInfo] = useState(false);
  const [foundedAt, setFoundedAt] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [coaches, setCoaches] = useState<{id:string; username:string; avatar_url:string|null}[]>([]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch box directly (skip redundant getMyBox + second query)
      let boxData: any = null;
      const { data: ownedBox } = await supabase
        .from('boxes').select('*').eq('owner_id', user.id).maybeSingle();

      if (ownedBox) {
        boxData = ownedBox;
      } else {
        const { data: membership } = await supabase
          .from('box_members').select('box_id')
          .eq('member_id', user.id).eq('role', 'owner').eq('status', 'active').maybeSingle();
        if (membership) {
          const { data: coBox } = await supabase
            .from('boxes').select('*').eq('id', membership.box_id).maybeSingle();
          boxData = coBox;
        }
      }

      if (!boxData) return;

      // Set box immediately → spinner disappears
      setBox(boxData);
      setLogoUrl(boxData.logo_url ?? null);
      setName(boxData.name ?? '');
      setAddress(boxData.address ?? '');
      setWebsiteUrl(boxData.website_url ?? '');
      setContactEmail(boxData.contact_email ?? '');
      setPhone(boxData.phone ?? '');
      setGoogleMapsUrl(boxData.google_maps_url ?? '');
      setFoundedAt(boxData.founded_at ?? '');

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

    setSavingInfo(true);
    setSavedInfo(false);

    const trimmedAddress = address.trim();
    const payload: Record<string, any> = {
      name: name.trim(),
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

    const { data: updated, error } = await supabase.from('boxes')
      .update(payload).eq('id', box.id).select('*').maybeSingle();

    if (error) {
      alert(`Erreur: ${error.message}`);
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
              placeholder="CrossFit Lyon, Box Forge…"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A227]/40 transition-colors"
            />
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
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A227]/40 transition-colors"
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
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A227]/40 transition-colors"
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
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A227]/40 transition-colors"
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
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A227]/40 transition-colors"
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
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A227]/40 transition-colors"
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
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A227]/40 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSaveInfo}
            disabled={savingInfo}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A227] text-black text-sm font-bold hover:bg-[#d4ad2e] transition-colors disabled:opacity-50"
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
