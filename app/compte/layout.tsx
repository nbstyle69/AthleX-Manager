import Link from 'next/link';
import { Search } from 'lucide-react';
import LogoutButton from './LogoutButton';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <header className="sticky top-0 z-30 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="AthleX" width={28} height={28} className="w-7 h-7 object-contain" />
            <span className="font-black text-white">AthleX</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/box"
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 hover:text-white border border-white/10 hover:bg-white/5 px-3 py-2 rounded-lg transition-colors"
            >
              <Search size={14} /> Trouver une box
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
