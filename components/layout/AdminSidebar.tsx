'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Shield, LayoutDashboard, Swords, Users, Trophy, LogOut, Sun, Moon, Building2, Globe2, Award, Dumbbell, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/ThemeProvider';

const NAV = [
  { href: '/admin',                label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/admin/daily-contests', label: 'Contestations',  icon: Swords },
  { href: '/admin/tournaments',    label: 'Tournois',       icon: Trophy },
  { href: '/admin/users',          label: 'Utilisateurs',   icon: Users },
  { href: '/admin/boxes',            label: 'Boxes',            icon: Building2 },
  { href: '/admin/inter-competitions', label: 'Compet. Inter-box', icon: Globe2 },
  { href: '/admin/badges',              label: 'Badges',            icon: Award },
  { href: '/admin/movements',           label: 'Mouvements',        icon: Dumbbell },
  { href: '/admin/changelog',           label: 'Changelog',         icon: FileText },
];

interface AdminSidebarProps {
  username: string;
  email: string;
}

export default function AdminSidebar({ username, email }: AdminSidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const { theme, toggle } = useTheme();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    document.cookie = 'sb-access-token=; Max-Age=0; path=/';
    document.cookie = 'sb-refresh-token=; Max-Age=0; path=/';
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="fixed top-0 left-0 h-full w-60 bg-[#080808] border-r border-white/[0.06] flex flex-col z-40">
      {/* Header */}
      <div className="px-5 py-6 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 flex items-center justify-center bg-emerald-500/20">
            <Shield size={20} className="text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-white/30 tracking-widest uppercase">TheHub</p>
            <p className="text-sm font-bold text-white truncate leading-tight">Super Admin</p>
          </div>
        </div>
        <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400">
          ADMIN
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
          return (
            <Link
              key={href} href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all',
                active
                  ? 'bg-emerald-500/20 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              )}
            >
              <Icon size={17} className={active ? 'text-emerald-400' : ''} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs font-black">
            {username[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white truncate">{username}</p>
            <p className="text-[10px] text-gray-500 truncate">{email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={toggle}
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          </button>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut size={15} />
          DÃ©connexion
        </button>
      </div>
    </aside>
  );
}

