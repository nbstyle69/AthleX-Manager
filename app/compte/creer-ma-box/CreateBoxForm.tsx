'use client';

import { useState } from 'react';
import { Building2, MapPin, Globe, Mail, Phone, Calendar, Loader2, AlertCircle, ChevronRight } from 'lucide-react';

/**
 * « Créer ma box » depuis un compte connecté.
 *
 * C'est le seul chemin par lequel un athlète existant devient gérant : le
 * tunnel d'inscription refuse un e-mail déjà connu (issue #342). L'intention
 * est portée par la session — la route lit le cookie, pas un e-mail ni un mot
 * de passe dans le corps — et le rôle ne bascule qu'une fois la box créée.
 */
export default function CreateBoxForm({ email }: { email: string }) {
  const [boxName, setBoxName] = useState('');
  const [address, setAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [maps, setMaps] = useState('');
  const [foundedAt, setFoundedAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inp = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors';
  const withIcon = 'w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors';
  const lbl = 'block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider';

  async function submit() {
    if (!boxName.trim()) { setError('Le nom de la box est requis.'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/create-box', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'existing_account',
          box_name: boxName,
          box_address: address,
          box_website: website,
          box_contact_email: contactEmail,
          box_phone: phone,
          box_google_maps: maps,
          box_founded_at: foundedAt || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? 'Erreur lors de la création.'); return; }
      // Nouvelle box ou box déjà possédée : dans les deux cas, le tableau de
      // bord du gérant est la bonne destination.
      window.location.href = '/';
    } catch {
      setError('Connexion impossible. Réessaie.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-6 space-y-5" data-testid="creer-ma-box">
      <p className="text-sm text-gray-400">
        Tu es connecté avec <span className="text-white font-semibold">{email}</span>. La box sera rattachée à ce compte,
        qui en deviendra le gérant. Ton historique d&apos;athlète reste intact.
      </p>

      <div>
        <label className={lbl}>Nom de la box *</label>
        <div className="relative">
          <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
          <input value={boxName} onChange={e => setBoxName(e.target.value)} placeholder="Nom de ma salle ici" className={withIcon} data-testid="box-nom" />
        </div>
      </div>
      <div>
        <label className={lbl}>Adresse</label>
        <div className="relative">
          <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder="12 rue du Sport, 69001 Lyon" className={withIcon} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Site web</label>
          <div className="relative">
            <Globe size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
            <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://" className={withIcon} />
          </div>
        </div>
        <div>
          <label className={lbl}>E-mail de contact</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
            <input value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="contact@mabox.fr" className={withIcon} />
          </div>
        </div>
        <div>
          <label className={lbl}>Téléphone</label>
          <div className="relative">
            <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="06 12 34 56 78" className={withIcon} />
          </div>
        </div>
        <div>
          <label className={lbl}>Date d&apos;ouverture</label>
          <div className="relative">
            <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
            <input type="date" value={foundedAt} onChange={e => setFoundedAt(e.target.value)} className={withIcon} />
          </div>
        </div>
      </div>
      <div>
        <label className={lbl}>Lien Google Maps</label>
        <input value={maps} onChange={e => setMaps(e.target.value)} placeholder="https://maps.google.com/…" className={inp} />
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3" data-testid="box-erreur">
          <AlertCircle size={15} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <button
        onClick={() => void submit()}
        disabled={loading}
        data-testid="box-creer"
        className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-100 disabled:opacity-50 text-[#0A0A0A] font-bold py-3.5 rounded-xl transition-colors"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <>Créer ma box <ChevronRight size={16} /></>}
      </button>
    </div>
  );
}
