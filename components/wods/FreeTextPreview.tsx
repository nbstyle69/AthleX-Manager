'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { freeTextPreview } from '@/lib/freeTextWod';
import { countOf } from '@/lib/plural';

/**
 * « Ce que l'app comprend » (maquette #453, 179:3) : la lecture du texte libre
 * par l'app, ligne par ligne. Vert = compté dans les badges, orange = à
 * corriger, puis les lignes non comptées avec leur raison.
 */
export default function FreeTextPreview({ text, managerCatalog }: { text: string; managerCatalog: readonly string[] }) {
  const p = freeTextPreview(text, managerCatalog);
  if (!p.groups.length && !p.ignored.length) return null;
  const item = (it: { ok: boolean; text: string }, k: number) => (
    <li key={k} className={`flex items-start gap-2 text-xs ${it.ok ? 'text-ax-text' : 'text-ax-warning'}`}>
      {it.ok
        ? <CheckCircle2 size={13} className="text-ax-success shrink-0 mt-px" aria-label="Compté" />
        : <AlertTriangle size={13} className="shrink-0 mt-px" aria-label="À corriger" />}
      <span className="break-words min-w-0">{it.text}</span>
    </li>
  );
  return (
    <div data-testid="apercu-texte-libre" className="bg-ax-surface-secondary border border-ax-border rounded-ax-control p-4 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[11px] font-semibold text-ax-text-secondary uppercase tracking-wider">Ce que l’app comprend</p>
        <p data-testid="apercu-compteur" className="text-[11px] text-ax-text-secondary">
          {countOf(p.okCount, 'mouvement compte', 'mouvements comptent')} · {p.fixCount} à corriger
        </p>
      </div>
      {p.groups.map((g, i) => (
        <div key={i} className="space-y-1">
          {g.line && <p className="text-xs font-semibold text-ax-text-secondary break-words">{g.line}</p>}
          <ul className={`space-y-1 ${g.line ? 'pl-2' : ''}`}>{g.items.map(item)}</ul>
        </div>
      ))}
      {p.ignored.length > 0 && (
        <p data-testid="apercu-non-comptees" className="text-[11px] text-ax-text-muted break-words">
          Non comptées : {p.ignored.map(i => `« ${i.text} »${i.count > 1 ? ` ×${i.count}` : ''} (${i.reason})`).join(' · ')}
        </p>
      )}
      <p className="text-[11px] text-ax-text-muted">Crédités dans les badges seulement quand le score prouve la séance terminée.</p>
    </div>
  );
}
