import HelpBrowser from '@/components/help/HelpBrowser';
import { getTutorialIndex } from '@/lib/tutorials';

/**
 * Page Aide : les deux index de langue sont rendus côté serveur puis remis au
 * navigateur, qui filtre et cherche sans aucun appel réseau (§6).
 */
export const metadata = { title: 'Aide · AthleX Manager' };

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8 md:px-8">
      <HelpBrowser indexes={{ fr: getTutorialIndex('fr'), en: getTutorialIndex('en') }} />
    </div>
  );
}
