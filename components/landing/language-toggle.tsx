'use client';

import { useLanguage } from '@/components/language-provider';
import { cn } from '@/lib/utils';
import './public-chrome.css';

/** « FR | EN » en texte, comme la landing : langue active en clair, l'autre atténuée. */
export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLanguage();
  return (
    <div role="group" aria-label={lang === 'en' ? 'Language' : 'Langue'} className={cn('axp-lang', className)}>
      {(['fr', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-label={l === 'fr' ? 'Français' : 'English'}
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
