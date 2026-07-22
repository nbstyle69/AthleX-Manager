import Link from 'next/link';
import { ArrowLeft, Dumbbell, Building2, ChevronRight } from 'lucide-react';

export default function LoginChooserPage() {
  const cards = [
    {
      href: '/login/athlete',
      icon: Dumbbell,
      title: 'Athlète',
      desc: 'Accède à ton compte, ton abonnement, tes crédits et tes programmes.',
    },
    {
      href: '/login/box',
      icon: Building2,
      title: 'Gérant · Coach',
      desc: 'Ouvre le back-office de ta box : membres, tournois, abonnements.',
    },
  ];

  return (
    <div className="w-full max-w-md mx-auto px-4">
      <Link
        href="/landing"
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Retour à l&apos;accueil
      </Link>

      <div className="flex flex-col items-center mb-10 gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="AthleX" width={96} height={96} className="w-24 h-24 object-contain" />
        <p className="text-sm text-gray-400 font-medium">Comment souhaitez-vous vous connecter ?</p>
      </div>

      <div className="space-y-3">
        {cards.map(({ href, icon: Icon, title, desc }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-4 bg-[#111111] border border-white/8 rounded-2xl p-5 hover:border-white/25 transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
              <Icon size={22} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-white">{title}</p>
              <p className="text-sm text-gray-400 mt-0.5">{desc}</p>
            </div>
            <ChevronRight size={18} className="text-gray-600 group-hover:text-white transition-colors shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
