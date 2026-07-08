'use client';

import { useLanguage } from '@/components/language-provider';
import { Logo } from './logo';

export function LandingFooter() {
  const { t } = useLanguage();
  const cols: { title: string; links: readonly string[] }[] = [
    { title: t.footer.product, links: t.footer.links.product },
    { title: t.footer.resources, links: t.footer.links.resources },
    { title: t.footer.legal, links: t.footer.links.legal },
  ];
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 px-6 py-14 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">{t.footer.tagline}</p>
        </div>
        {cols.map((col) => (
          <div key={col.title}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">{col.title}</h3>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l}>
                  <a href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} AthleX. {t.footer.rights}
        </div>
      </div>
    </footer>
  );
}
