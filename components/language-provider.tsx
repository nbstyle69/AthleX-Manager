'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react';
import { translations, type Lang, type Translation } from '@/lib/translations';

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translation;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = 'athlex:lang';
const COOKIE = 'athlex_lang';
const DEFAULT: Lang = 'fr';

// La navigation du site publique passe par de vrais liens : chaque page est un
// nouveau document. Sans persistance, le choix de langue meurt à chaque clic.
function readStoredLang(): Lang {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'fr' || stored === 'en') return stored;
    const cookie = document.cookie.match(/(?:^|;\s*)athlex_lang=(fr|en)/);
    if (cookie) return cookie[1] as Lang;
  } catch {
    // stockage refusé (navigation privée stricte) : on reste sur le défaut
  }
  return DEFAULT;
}

// Le rendu serveur est en français : appliquer la langue stockée avant la
// peinture évite que l'anglophone voie un éclair de français à chaque page.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT);

  useIsomorphicLayoutEffect(() => {
    const stored = readStoredLang();
    if (stored !== DEFAULT) setLangState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      document.cookie = `${COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      // même en cas de refus d'écriture, la langue s'applique à la page courante
    }
  }, []);

  const t = translations[lang];

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
