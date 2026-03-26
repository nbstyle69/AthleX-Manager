'use client';

import { useState } from 'react';
import { Copy, RefreshCw, Pencil, Check, X, Loader2 } from 'lucide-react';

function generateCode(boxName: string): string {
  const prefix = boxName.replace(/\s+/g, '').substring(0, 3).toUpperCase();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}${suffix}`;
}

interface Props {
  initialCode: string;
  boxName: string;
}

export default function InviteCodeWidget({ initialCode, boxName }: Props) {
  const [code, setCode] = useState(initialCode);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  async function saveCode(newCode: string) {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/box/invite-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: newCode }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Erreur');
        setSaving(false);
        return false;
      }
      setCode(json.invite_code);
      setSaving(false);
      return true;
    } catch {
      setError('Erreur réseau');
      setSaving(false);
      return false;
    }
  }

  async function handleRegenerate() {
    const newCode = generateCode(boxName);
    const ok = await saveCode(newCode);
    if (ok) setEditing(false);
  }

  async function handleSaveManual() {
    if (draft.trim().length < 3) { setError('3 caractères minimum'); return; }
    const ok = await saveCode(draft.trim());
    if (ok) setEditing(false);
  }

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-[#111111] border border-white/8 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            Code d&apos;invitation box
          </p>
          <p className="text-2xl font-black tracking-[0.3em] text-[#C9A227]">{code}</p>
          <p className="text-xs text-gray-500 mt-1">
            Partagez ce code aux athlètes pour rejoindre votre box
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className="p-2.5 rounded-xl bg-[#0A0A0A] hover:bg-white/5 text-gray-500 hover:text-white transition-colors"
            title="Copier le code"
          >
            {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
          </button>
          <button
            onClick={handleRegenerate}
            disabled={saving}
            className="p-2.5 rounded-xl bg-[#0A0A0A] hover:bg-[#C9A227]/10 text-gray-500 hover:text-[#C9A227] transition-colors disabled:opacity-40"
            title="Générer un nouveau code"
          >
            {saving && !editing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
          <button
            onClick={() => { setEditing(!editing); setDraft(code); setError(''); }}
            className={`p-2.5 rounded-xl transition-colors ${
              editing
                ? 'bg-[#C9A227]/20 text-[#C9A227]'
                : 'bg-[#0A0A0A] hover:bg-[#C9A227]/10 text-gray-500 hover:text-[#C9A227]'
            }`}
            title="Modifier manuellement"
          >
            <Pencil size={16} />
          </button>
        </div>
      </div>

      {editing && (
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={draft}
            onChange={e => { setDraft(e.target.value.toUpperCase()); setError(''); }}
            maxLength={12}
            placeholder="Nouveau code…"
            className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-bold tracking-widest uppercase placeholder:text-gray-600 focus:outline-none focus:border-[#C9A227]/50 transition-colors"
            autoFocus
          />
          <button
            onClick={handleSaveManual}
            disabled={saving || draft.trim().length < 3}
            className="flex items-center gap-1.5 bg-[#C9A227] hover:bg-[#b8922a] disabled:opacity-40 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Sauvegarder
          </button>
          <button
            onClick={() => { setEditing(false); setError(''); }}
            className="p-2.5 rounded-xl bg-[#0A0A0A] hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 font-semibold">{error}</p>
      )}
    </div>
  );
}
