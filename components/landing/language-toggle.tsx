'use client';

import { useLanguage } from '@/components/language-provider';
import { cn } from '@/lib/utils';

export function LanguageToggle() {
  const { lang, setLang } = useLanguage();
  return (
    <div
      role="group"
      aria-label="Language"
      className="inline-flex items-center rounded-full border border-border bg-secondary/40 p-0.5 text-xs font-semibold"
    >
      {(['fr', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-label={l === 'fr' ? 'Français' : 'English'}
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={cn(
            'rounded-full px-2.5 py-1 uppercase tracking-wide transition-colors',
            lang === l ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
