'use client';

import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import {
  SCORE_PROPOSAL_NOTE, SCORE_TYPES, SCORE_UNDEFINED_NOTE, ScoreLock, ScoreType, scoreTypeAllowed,
} from '@/lib/wodScoreType';

interface Props {
  value: ScoreType | '';
  onChange: (v: ScoreType) => void;
  lock: ScoreLock;
  /** WOD existant sans type : « Non défini » au lieu d'un champ à remplir. */
  existing: boolean;
  triggerClassName: string;
}

/**
 * Champ « Score * » de l'éditeur de WOD (maquette #453, 180:139) : une liste à
 * deux lignes par option (libellé + phrase d'aide), que `<select>` ne sait pas
 * afficher. Les types incompatibles avec des scores déjà posés sont grisés.
 */
export default function ScoreTypeSelect({ value, onChange, lock, existing, triggerClassName }: Props) {
  const locked = lock.allowed !== null && lock.allowed.length === 0;
  const hint = SCORE_TYPES.find(s => s.value === value)?.hint ?? (existing ? SCORE_UNDEFINED_NOTE : null);
  return (
    <div data-testid="champ-score">
      <label id="score-type-label" className="block text-xs font-semibold text-ax-text-secondary mb-1.5 uppercase tracking-wider">Score *</label>
      <Select.Root value={value} onValueChange={v => onChange(v as ScoreType)} disabled={locked}>
        <Select.Trigger aria-labelledby="score-type-label" data-testid="score-trigger"
          className={`${triggerClassName} flex items-center justify-between gap-2 text-left data-[placeholder]:text-ax-text-muted`}>
          <Select.Value placeholder={existing ? 'Non défini' : '— Choisir —'} />
          <Select.Icon><ChevronDown size={16} className="text-ax-text-secondary" /></Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content position="popper" sideOffset={6} collisionPadding={8}
            className="z-[60] w-[var(--radix-select-trigger-width)] max-h-[var(--radix-select-content-available-height)] overflow-y-auto bg-ax-surface border border-ax-border rounded-ax-control shadow-ax-panel">
            <Select.Viewport className="p-1">
              {SCORE_TYPES.map(s => (
                <Select.Item key={s.value} value={s.value} disabled={!scoreTypeAllowed(lock, s.value)}
                  className="relative flex items-start gap-2 rounded-ax-control px-3 py-2 pr-8 outline-none cursor-pointer data-[highlighted]:bg-ax-hover data-[state=checked]:bg-ax-hover data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed">
                  <div className="min-w-0">
                    <Select.ItemText><span className="text-sm font-semibold text-ax-text">{s.label}</span></Select.ItemText>
                    <p className="text-xs text-ax-text-muted">{s.help}</p>
                  </div>
                  <Select.ItemIndicator className="absolute right-3 top-3"><Check size={14} className="text-ax-text" /></Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
            <p className="px-4 py-2 border-t border-ax-border text-[11px] text-ax-text-muted">{SCORE_PROPOSAL_NOTE}</p>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
      {hint && <p data-testid="score-hint" className="text-[11px] text-ax-text-muted mt-1.5">{hint}</p>}
      {lock.reason && <p data-testid="score-verrou" className="text-[11px] text-ax-warning mt-1">{lock.reason}</p>}
    </div>
  );
}
