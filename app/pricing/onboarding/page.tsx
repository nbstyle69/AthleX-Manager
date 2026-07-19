'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  Zap, Building2, Mail, Lock, ChevronRight, ArrowLeft, Check,
  Eye, EyeOff, AlertCircle, Loader2, ImagePlus, X,
  MapPin, Globe, Phone, Calendar,
} from 'lucide-react';

type Step = 'account' | 'box' | 'done';
type Mode = 'signup' | 'login';

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>('account');
  const [mode, setMode] = useState<Mode>('signup');

  // Account fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  // Box fields
  const [boxName, setBoxName] = useState('');
  const [boxAddress, setBoxAddress] = useState('');
  const [boxWebsite, setBoxWebsite] = useState('');
  const [boxContactEmail, setBoxContactEmail] = useState('');
  const [boxPhone, setBoxPhone] = useState('');
  const [boxGoogleMaps, setBoxGoogleMaps] = useState('');
  const [boxFoundedAt, setBoxFoundedAt] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Result
  const [result, setResult] = useState<{
    box_id: string;
    invite_code: string;
    is_early_adopter: boolean;
    trial_days: number;
  } | null>(null);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('Le logo doit faire moins de 2 Mo'); return; }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setError(null);
  }

  function removeLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleCreateBox() {
    if (!email || !password) { setError('Email et mot de passe requis'); return; }
    if (!boxName.trim()) { setError('Nom de la box requis'); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/create-box', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          box_name: boxName,
          box_address: boxAddress,
          box_website: boxWebsite,
          box_contact_email: boxContactEmail,
          box_phone: boxPhone,
          box_google_maps: boxGoogleMaps,
          box_founded_at: boxFoundedAt || null,
          mode,
        }),
      });
      const data = await res.json();

      if (data.already_exists && data.box_id) {
        window.location.href = `/pricing?box_id=${data.box_id}`;
        return;
      }

      if (!res.ok) {
        setError(data.error ?? 'Erreur lors de la création');
        setLoading(false);
        return;
      }

      // Upload logo if selected
      if (logoFile && data.box_id) {
        try {
          const fd = new FormData();
          fd.append('box_id', data.box_id);
          fd.append('logo', logoFile);
          await fetch('/api/upload-box-logo', { method: 'POST', body: fd });
        } catch { /* logo upload failure is non-blocking */ }
      }

      setResult(data);
      setStep('done');
    } catch {
      setError('Erreur réseau');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans antialiased">
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] bg-[#080808]/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/pricing" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Zap size={15} className="text-white" />
            </div>
            <span className="text-base font-black tracking-tight">Athle<span className="text-white">X</span></span>
          </Link>
        </div>
      </nav>

      <div className="pt-28 pb-20 px-6 flex justify-center">
        <div className="w-full max-w-md">

          {/* Progress */}
          <div className="flex items-center gap-3 mb-8">
            {['Compte', 'Box', 'Terminé'].map((label, i) => {
              const steps: Step[] = ['account', 'box', 'done'];
              const current = steps.indexOf(step);
              const isActive = i <= current;
              return (
                <div key={label} className="flex-1">
                  <div className={`h-1.5 rounded-full transition-colors ${isActive ? 'bg-white' : 'bg-white/8'}`} />
                  <p className={`text-[10px] font-bold mt-1.5 uppercase tracking-wider ${isActive ? 'text-white' : 'text-gray-600'}`}>
                    {label}
                  </p>
                </div>
              );
            })}
          </div>

          {/* ── Step 1: Account ── */}
          {step === 'account' && (
            <div className="bg-[#111111] border border-white/8 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
                  <Mail size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black">
                    {mode === 'signup' ? 'Créer un compte' : 'Se connecter'}
                  </h2>
                  <p className="text-xs text-gray-500">Étape 1/3</p>
                </div>
              </div>

              {/* Toggle signup / login */}
              <div className="bg-[#0A0A0A] border border-white/8 rounded-xl p-1 flex gap-1 mb-6">
                <button
                  onClick={() => { setMode('signup'); setError(null); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                    mode === 'signup' ? 'bg-white text-[#0A0A0A]' : 'text-gray-500 hover:text-white'
                  }`}
                >
                  Inscription
                </button>
                <button
                  onClick={() => { setMode('login'); setError(null); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                    mode === 'login' ? 'bg-white text-[#0A0A0A]' : 'text-gray-500 hover:text-white'
                  }`}
                >
                  Connexion
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="owner@mabox.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Mot de passe</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white"
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {mode === 'signup' && (
                    <p className="text-[10px] text-gray-600 mt-1">Minimum 6 caractères</p>
                  )}
                </div>
              </div>

              <button
                onClick={() => {
                  if (!email || !password) { setError('Remplis tous les champs'); return; }
                  if (mode === 'signup' && password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères'); return; }
                  setError(null);
                  setStep('box');
                }}
                className="w-full mt-6 flex items-center justify-center gap-2 bg-white hover:bg-[#B8911F] text-[#0A0A0A] font-bold py-3.5 rounded-xl transition-colors"
              >
                Continuer <ChevronRight size={16} />
              </button>

              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mt-4">
                  <AlertCircle size={15} className="text-red-400 shrink-0" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Box ── */}
          {step === 'box' && (
            <div className="bg-[#111111] border border-white/8 rounded-2xl p-8">
              <button
                onClick={() => setStep('account')}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-white mb-4 transition-colors"
              >
                <ArrowLeft size={14} /> Retour
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
                  <Building2 size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black">Créer ta box</h2>
                  <p className="text-xs text-gray-500">Étape 2/3</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Logo upload */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                    Logo de la box (optionnel)
                  </label>
                  <p className="text-[10px] text-gray-600 mb-2">Visible par tes membres dans l&apos;app. Carré, 512×512px min, max 2 Mo.</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                  <div className="flex items-center gap-4">
                    {logoPreview ? (
                      <div className="relative">
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="w-16 h-16 rounded-2xl object-cover border border-white/10"
                        />
                        <button
                          type="button"
                          onClick={removeLogo}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-400 transition-colors"
                        >
                          <X size={10} className="text-white" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center">
                        <Building2 size={22} className="text-gray-600" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 bg-white/10 border border-white/20 text-white font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-white/20 transition-colors"
                    >
                      <ImagePlus size={14} />
                      {logoPreview ? 'Changer' : 'Ajouter un logo'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                    Nom de la box *
                  </label>
                  <input
                    type="text"
                    required
                    value={boxName}
                    onChange={e => setBoxName(e.target.value)}
                    placeholder="Nom de ma salle ici"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                    Adresse
                  </label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type="text"
                      value={boxAddress}
                      onChange={e => setBoxAddress(e.target.value)}
                      placeholder="12 rue du Sport, 69001 Lyon"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                    Site web
                  </label>
                  <div className="relative">
                    <Globe size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type="url"
                      value={boxWebsite}
                      onChange={e => setBoxWebsite(e.target.value)}
                      placeholder="https://www.mabox.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                    Email de contact
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type="email"
                      value={boxContactEmail}
                      onChange={e => setBoxContactEmail(e.target.value)}
                      placeholder="contact@mabox.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                    Téléphone
                  </label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type="tel"
                      value={boxPhone}
                      onChange={e => setBoxPhone(e.target.value)}
                      placeholder="+33600000000"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                    Lien Google Maps
                  </label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type="url"
                      value={boxGoogleMaps}
                      onChange={e => setBoxGoogleMaps(e.target.value)}
                      placeholder="https://maps.app.goo.gl/..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                    Date d&apos;ouverture de la salle
                  </label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type="date"
                      value={boxFoundedAt}
                      onChange={e => setBoxFoundedAt(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors [color-scheme:dark]"
                    />
                  </div>
                </div>
              </div>

              {/* Recap */}
              <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4 mt-5">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Récapitulatif</p>
                <div className="space-y-1.5">
                  <p className="text-sm text-gray-300"><span className="text-gray-500">Email :</span> {email}</p>
                  <p className="text-sm text-gray-300"><span className="text-gray-500">Box :</span> {boxName || '—'}</p>
                  {boxAddress && <p className="text-sm text-gray-300"><span className="text-gray-500">Adresse :</span> {boxAddress}</p>}
                  {boxPhone && <p className="text-sm text-gray-300"><span className="text-gray-500">Tél :</span> {boxPhone}</p>}
                  <p className="text-sm text-gray-300"><span className="text-gray-500">Mode :</span> {mode === 'signup' ? 'Nouveau compte' : 'Connexion'}</p>
                </div>
              </div>

              <button
                onClick={handleCreateBox}
                disabled={loading || !boxName.trim()}
                className="w-full mt-6 flex items-center justify-center gap-2 bg-white hover:bg-[#B8911F] disabled:opacity-50 text-[#0A0A0A] font-bold py-3.5 rounded-xl transition-colors"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <Building2 size={16} />
                    Créer ma box — Essai gratuit
                    <ChevronRight size={16} />
                  </>
                )}
              </button>

              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mt-4">
                  <AlertCircle size={15} className="text-red-400 shrink-0" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Done ── */}
          {step === 'done' && result && (
            <div className="bg-[#111111] border border-white/8 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 rounded-3xl bg-green-500/15 flex items-center justify-center mx-auto mb-5">
                <Check size={32} className="text-green-400" />
              </div>

              <h2 className="text-2xl font-black mb-2">Box créée avec succès !</h2>

              {result.is_early_adopter ? (
                <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 mb-5">
                  <p className="text-sm font-bold text-white">🏅 Félicitations, tu es un Fondateur !</p>
                  <p className="text-xs text-gray-400 mt-1">{result.trial_days} jours d&apos;essai gratuit + badge permanent</p>
                </div>
              ) : (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 mb-5">
                  <p className="text-sm font-bold text-green-400">✅ Essai gratuit activé</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Tu as <strong className="text-white">{result.trial_days} jours</strong> pour tester toutes les fonctionnalités. Aucun paiement requis.
                  </p>
                </div>
              )}

              <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4 mb-6 text-left">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-3">Informations importantes</p>
                <div className="space-y-2">
                  <p className="text-sm"><span className="text-gray-500">Code invitation :</span>{' '}
                    <span className="font-mono font-bold text-white text-base">{result.invite_code}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Partage ce code à tes adhérents pour qu&apos;ils rejoignent ta box dans l&apos;app mobile.
                  </p>
                  <div className="border-t border-white/5 my-2" />
                  <p className="text-xs text-gray-500">
                    <span className="text-gray-400 font-semibold">Email :</span> {email}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Link
                  href="/login"
                  className="w-full flex items-center justify-center gap-2 bg-white text-[#0A0A0A] font-bold py-3.5 rounded-xl hover:bg-gray-200 transition-colors text-sm"
                >
                  Accéder à mon back office
                  <ChevronRight size={16} />
                </Link>
                <p className="text-[10px] text-gray-600 mt-3">
                  L&apos;abonnement sera proposé automatiquement à la fin de ton essai gratuit.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
