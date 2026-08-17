'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  Building2, Mail, Lock, ChevronRight, ArrowLeft, Check,
  Eye, EyeOff, AlertCircle, Loader2, ImagePlus, X,
  MapPin, Globe, Phone, Calendar,
} from 'lucide-react';
import { LandingHeader } from '@/components/landing/header';
import { useLanguage } from '@/components/language-provider';

type Step = 'account' | 'box' | 'done';
type Mode = 'signup' | 'login';

export default function OnboardingPage() {
  const { t } = useLanguage();
  const o = t.funnel.onboarding;
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
    if (file.size > 2 * 1024 * 1024) { setError(o.logoTooBig); return; }
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
    if (!email || !password) { setError(o.credentialsRequired); return; }
    if (!boxName.trim()) { setError(o.boxNameRequired); return; }

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
        setError(data.error ?? o.createError);
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
      setError(t.funnel.common.networkError);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased">
      <LandingHeader variant="funnel" />

      <div className="pt-12 pb-20 px-6 flex justify-center">
        <div className="w-full max-w-md">

          {/* Progress */}
          <div className="flex items-center gap-3 mb-8">
            {o.steps.map((label, i) => {
              const steps: Step[] = ['account', 'box', 'done'];
              const current = steps.indexOf(step);
              const isActive = i <= current;
              return (
                <div key={label} className="flex-1">
                  <div className={`h-1.5 rounded-full transition-colors ${isActive ? 'bg-white' : 'bg-white/8'}`} />
                  <p className={`text-[10px] font-bold mt-1.5 uppercase tracking-wider ${isActive ? 'text-foreground' : 'text-gray-600'}`}>
                    {label}
                  </p>
                </div>
              );
            })}
          </div>

          {/* ── Step 1: Account ── */}
          {step === 'account' && (
            <div className="bg-card border border-border rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
                  <Mail size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black">
                    {mode === 'signup' ? o.signupTitle : o.loginTitle}
                  </h2>
                  <p className="text-xs text-gray-500">{o.stepLabel}1/3</p>
                </div>
              </div>

              {/* Toggle signup / login */}
              <div className="bg-background border border-border rounded-xl p-1 flex gap-1 mb-6">
                <button
                  onClick={() => { setMode('signup'); setError(null); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                    mode === 'signup' ? 'bg-white text-[#0A0A0A]' : 'text-gray-500 hover:text-foreground'
                  }`}
                >
                  {o.signupTab}
                </button>
                <button
                  onClick={() => { setMode('login'); setError(null); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                    mode === 'login' ? 'bg-white text-[#0A0A0A]' : 'text-gray-500 hover:text-foreground'
                  }`}
                >
                  {o.loginTab}
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">{t.funnel.common.email}</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder={t.funnel.common.ownerEmailPlaceholder}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">{t.funnel.common.password}</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm text-foreground placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-foreground"
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {mode === 'signup' && (
                    <p className="text-[10px] text-gray-600 mt-1">{o.passwordHint}</p>
                  )}
                </div>
              </div>

              <button
                onClick={() => {
                  if (!email || !password) { setError(o.fillAll); return; }
                  if (mode === 'signup' && password.length < 6) { setError(o.passwordTooShort); return; }
                  setError(null);
                  setStep('box');
                }}
                className="w-full mt-6 flex items-center justify-center gap-2 bg-white hover:bg-[#B8911F] text-[#0A0A0A] font-bold py-3.5 rounded-xl transition-colors"
              >
                {o.continue} <ChevronRight size={16} />
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
            <div className="bg-card border border-border rounded-2xl p-8">
              <button
                onClick={() => setStep('account')}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-foreground mb-4 transition-colors"
              >
                <ArrowLeft size={14} /> {t.funnel.common.back}
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
                  <Building2 size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black">{o.boxTitle}</h2>
                  <p className="text-xs text-gray-500">{o.stepLabel}2/3</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Logo upload */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                    {o.logoLabel} ({t.funnel.common.optional})
                  </label>
                  <p className="text-[10px] text-gray-600 mb-2">{o.logoHint}</p>
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
                      {logoPreview ? o.logoChange : o.logoAdd}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                    {o.boxName}
                  </label>
                  <input
                    type="text"
                    required
                    value={boxName}
                    onChange={e => setBoxName(e.target.value)}
                    placeholder={o.boxNamePlaceholder}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                    {o.address}
                  </label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type="text"
                      value={boxAddress}
                      onChange={e => setBoxAddress(e.target.value)}
                      placeholder={o.addressPlaceholder}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                    {o.website}
                  </label>
                  <div className="relative">
                    <Globe size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type="url"
                      value={boxWebsite}
                      onChange={e => setBoxWebsite(e.target.value)}
                      placeholder="https://www.mabox.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                    {o.contactEmail}
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type="email"
                      value={boxContactEmail}
                      onChange={e => setBoxContactEmail(e.target.value)}
                      placeholder="contact@mabox.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                    {o.phone}
                  </label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type="tel"
                      value={boxPhone}
                      onChange={e => setBoxPhone(e.target.value)}
                      placeholder="+33600000000"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                    {o.mapsLink}
                  </label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type="url"
                      value={boxGoogleMaps}
                      onChange={e => setBoxGoogleMaps(e.target.value)}
                      placeholder="https://maps.app.goo.gl/..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                    {o.foundedAt}
                  </label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type="date"
                      value={boxFoundedAt}
                      onChange={e => setBoxFoundedAt(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-gray-600 focus:outline-none focus:border-white transition-colors [color-scheme:dark]"
                    />
                  </div>
                </div>
              </div>

              {/* Recap */}
              <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4 mt-5">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">{o.recap}</p>
                <div className="space-y-1.5">
                  <p className="text-sm text-gray-300"><span className="text-gray-500">{o.recapEmail}</span> {email}</p>
                  <p className="text-sm text-gray-300"><span className="text-gray-500">{o.recapBox}</span> {boxName || '—'}</p>
                  {boxAddress && <p className="text-sm text-gray-300"><span className="text-gray-500">{o.recapAddress}</span> {boxAddress}</p>}
                  {boxPhone && <p className="text-sm text-gray-300"><span className="text-gray-500">{o.recapPhone}</span> {boxPhone}</p>}
                  <p className="text-sm text-gray-300"><span className="text-gray-500">{o.recapMode}</span> {mode === 'signup' ? o.modeSignup : o.modeLogin}</p>
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
                    {o.createCta}
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
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <div className="w-16 h-16 rounded-3xl bg-green-500/15 flex items-center justify-center mx-auto mb-5">
                <Check size={32} className="text-green-400" />
              </div>

              <h2 className="text-2xl font-black mb-2">{o.doneTitle}</h2>

              {result.is_early_adopter ? (
                <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 mb-5">
                  <p className="text-sm font-bold text-foreground">{o.founderTitle}</p>
                  <p className="text-xs text-muted-foreground mt-1">{result.trial_days}{o.founderAfter}</p>
                </div>
              ) : (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 mb-5">
                  <p className="text-sm font-bold text-green-400">{o.trialTitle}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {o.trialBefore}<strong className="text-foreground">{result.trial_days}{o.trialDays}</strong>{o.trialAfter}
                  </p>
                </div>
              )}

              <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4 mb-6 text-left">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-3">{o.infoTitle}</p>
                <div className="space-y-2">
                  <p className="text-sm"><span className="text-gray-500">{o.inviteCode}</span>{' '}
                    <span className="font-mono font-bold text-foreground text-base">{result.invite_code}</span>
                  </p>
                  <p className="text-xs text-gray-500">{o.inviteHint}</p>
                  <div className="border-t border-white/5 my-2" />
                  <p className="text-xs text-gray-500">
                    <span className="text-muted-foreground font-semibold">{o.recapEmail}</span> {email}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Link
                  href="/login"
                  className="w-full flex items-center justify-center gap-2 bg-white text-[#0A0A0A] font-bold py-3.5 rounded-xl hover:bg-gray-200 transition-colors text-sm"
                >
                  {o.accessCta}
                  <ChevronRight size={16} />
                </Link>
                <p className="text-[10px] text-gray-600 mt-3">{o.billingHint}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
