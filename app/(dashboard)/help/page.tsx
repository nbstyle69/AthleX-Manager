import HelpBrowser from '@/components/help/HelpBrowser';
import { getTutorialIndex, type TutorialMeta } from '@/lib/tutorials';
import { LOCALES, type Locale } from '@/lib/tutorials/i18n';

export const metadata = { title: 'Aide · AthleX Manager' };

/** Un index illisible donne une liste vide, pas une erreur de rendu. */
function indexes(): Record<Locale, TutorialMeta[]> {
  const built = { fr: [], en: [] } as Record<Locale, TutorialMeta[]>;
  for (const locale of LOCALES) {
    try {
      built[locale] = getTutorialIndex(locale);
    } catch (err) {
      console.error(`[help] index indisponible (${locale})`, err);
    }
  }
  return built;
}

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8 md:px-8">
      <HelpBrowser indexes={indexes()} />
    </div>
  );
}
