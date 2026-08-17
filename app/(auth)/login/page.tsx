'use client';

import Link from 'next/link';
import { ArrowLeft, Dumbbell, Building2, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';

export default function LoginChooserPage() {
  const { t } = useLanguage();
  const cards = [
    {
      href: '/login/athlete',
      icon: Dumbbell,
      title: t.funnel.chooser.athleteTitle,
      desc: t.funnel.chooser.athleteDesc,
    },
    {
      href: '/login/box',
      icon: Building2,
      title: t.funnel.chooser.ownerTitle,
      desc: t.funnel.chooser.ownerDesc,
    },
  ];

  return (
    <div className="w-full max-w-md mx-auto px-4">
      <Link
        href="/landing"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        {t.funnel.common.backHome}
      </Link>

      <div className="flex flex-col items-center mb-10 gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="AthleX" width={96} height={96} className="w-24 h-24 object-contain" />
        <p className="text-sm text-muted-foreground font-medium">{t.funnel.chooser.subtitle}</p>
      </div>

      <div className="space-y-3">
        {cards.map(({ href, icon: Icon, title, desc }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-4 bg-card border border-border rounded-2xl p-5 hover:border-white/25 transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
              <Icon size={22} className="text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-foreground">{title}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
            </div>
            <ChevronRight size={18} className="text-gray-600 group-hover:text-foreground transition-colors shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
