import Link from 'next/link';
import LogoutButton from './LogoutButton';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <header className="sticky top-0 z-30 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="AthleX" width={28} height={28} className="w-7 h-7 object-contain" />
            <span className="font-black text-white">AthleX</span>
          </Link>
          <LogoutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
