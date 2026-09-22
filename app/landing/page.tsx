import type { Metadata, Viewport } from 'next';
import { LandingPage } from '@/components/landing-gym/landing-experience';
import { translations } from '@/data/landing';
import './landing.css';

type Props = { searchParams: Promise<{ lang?: string; profil?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { lang } = await searchParams;
  const locale = lang === 'en' ? 'en' : 'fr';
  const t = translations[locale].meta;
  return {
    metadataBase: new URL('https://www.athlexapp.eu'),
    title: t.title,
    description: t.description,
    alternates: {
      canonical: locale === 'en' ? '/landing?lang=en' : '/landing',
      languages: { fr: '/landing', en: '/landing?lang=en' },
    },
    openGraph: {
      title: t.title,
      description: t.description,
      locale: locale === 'en' ? 'en_GB' : 'fr_FR',
      alternateLocale: locale === 'en' ? 'fr_FR' : 'en_GB',
      type: 'website',
      siteName: 'AthleX',
      url: locale === 'en' ? '/landing?lang=en' : '/landing',
    },
  };
}

// La landing est sombre en toutes circonstances, mode clair du Manager compris.
export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#101214',
};

export default async function Page({ searchParams }: Props) {
  const params = await searchParams;
  return (
    // Racine unique de `landing.css` : toutes ses règles et variables y sont bornées.
    <div className="athlex-landing">
      <LandingPage
        initialLocale={params.lang === 'en' ? 'en' : 'fr'}
        initialProfile={params.profil === 'athlete' || params.profil === 'pro' ? params.profil : null}
      />
    </div>
  );
}
