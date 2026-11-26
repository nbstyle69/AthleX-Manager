import type { Metadata, Viewport } from 'next';
import { CoachsPage } from '@/components/landing-gym/landing-experience';
import { translations } from '@/data/landing';
import '@/components/landing/public-chrome.css';
import '../landing/landing.css';

type Props = { searchParams: Promise<{ lang?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { lang } = await searchParams;
  const locale = lang === 'en' ? 'en' : 'fr';
  const t = translations[locale].coachs.meta;
  return {
    metadataBase: new URL('https://www.athlexapp.eu'),
    title: t.title,
    description: t.description,
    alternates: {
      canonical: locale === 'en' ? '/coachs?lang=en' : '/coachs',
      languages: { fr: '/coachs', en: '/coachs?lang=en' },
    },
    openGraph: {
      title: t.title,
      description: t.description,
      locale: locale === 'en' ? 'en_GB' : 'fr_FR',
      alternateLocale: locale === 'en' ? 'fr_FR' : 'en_GB',
      type: 'website',
      siteName: 'AthleX',
      url: locale === 'en' ? '/coachs?lang=en' : '/coachs',
    },
  };
}

// Toujours sombre, comme l'accueil.
export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#101214',
};

export default async function Page({ searchParams }: Props) {
  const params = await searchParams;
  return (
    // Même racine que l'accueil : landing.css y est borné, axp-dark garde les jetons sombres.
    <div className="athlex-landing axp-dark">
      <CoachsPage initialLocale={params.lang === 'en' ? 'en' : 'fr'} />
    </div>
  );
}
