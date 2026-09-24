'use client';

import { useState } from 'react';
import { Copy, RefreshCw, Pencil, Check, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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
    <div className="bg-ax-surface border border-ax-border rounded-ax-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-xs font-bold text-ax-text-secondary uppercase tracking-wider mb-1">
            Code d&apos;invitation box
          </p>
          <p className="text-2xl font-black tracking-[0.3em] text-ax-text">{code}</p>
          <p className="text-xs text-ax-text-muted mt-1">
            Partagez ce code aux athlètes pour rejoindre votre box
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className="p-2.5 rounded-ax-control bg-ax-background hover:bg-ax-hover text-ax-text-muted hover:text-ax-text transition-colors"
            title="Copier le code"
          >
            {copied ? <Check size={16} className="text-ax-success" /> : <Copy size={16} />}
          </button>
          <button
            onClick={handleRegenerate}
            disabled={saving}
            className="p-2.5 rounded-ax-control bg-ax-background hover:bg-ax-hover text-ax-text-muted hover:text-ax-text transition-colors disabled:opacity-40"
            title="Générer un nouveau code"
          >
            {saving && !editing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
          <button
            onClick={() => { setEditing(!editing); setDraft(code); setError(''); }}
            className={`p-2.5 rounded-ax-control transition-colors ${
              editing
                ? 'bg-ax-hover text-ax-text'
                : 'bg-ax-background hover:bg-ax-hover text-ax-text-muted hover:text-ax-text'
            }`}
            title="Modifier manuellement"
          >
            <Pencil size={16} />
          </button>
        </div>
      </div>

      {editing && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Input
            type="text"
            value={draft}
            onChange={e => { setDraft(e.target.value.toUpperCase()); setError(''); }}
            maxLength={12}
            placeholder="Nouveau code…"
            className="w-auto min-w-[11rem] flex-1 font-bold uppercase tracking-widest"
            autoFocus
          />
          <Button
            onClick={handleSaveManual}
            disabled={saving || draft.trim().length < 3}
            variant="ax-white"
            className="shrink-0"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Sauvegarder
          </Button>
          <button
            onClick={() => { setEditing(false); setError(''); }}
            className="p-2.5 rounded-ax-control bg-ax-background hover:bg-ax-danger-soft text-ax-text-muted hover:text-ax-danger transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-ax-danger font-semibold">{error}</p>
      )}
    </div>
  );
}
