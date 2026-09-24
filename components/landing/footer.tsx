'use client';

import { useLanguage } from '@/components/language-provider';
import { Logo } from './logo';
import './public-chrome.css';

/** Pied de page des pages publiques, à l'identité de celui de la landing. */
export function LandingFooter() {
  const { t } = useLanguage();
  const legalHrefs = ['/privacy#confidentialite', '/privacy#cgu', '/privacy#mentions-legales'];
  const cols: { title: string; links: readonly string[]; hrefs?: string[] }[] = [
    { title: t.footer.product, links: t.footer.links.product },
    { title: t.footer.resources, links: t.footer.links.resources },
    { title: t.footer.legal, links: t.footer.links.legal, hrefs: legalHrefs },
  ];
  return (
    <footer className="axp-dark axp-footer">
      <div className="axp-footer-top">
        <div>
          <span className="axp-brand">
            <Logo />
          </span>
          <p>{t.footer.tagline}</p>
        </div>
        <div className="axp-footer-cols">
          {cols.map((col) => (
            <div key={col.title}>
              <h3>{col.title}</h3>
              <ul>
                {col.links.map((l, i) => (
                  <li key={l}>
                    <a href={col.hrefs?.[i] ?? '#'}>{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="axp-footer-bottom">
        © {new Date().getFullYear()} AthleX — NBS Innovation. {t.footer.rights}
      </div>
    </footer>
  );
}
