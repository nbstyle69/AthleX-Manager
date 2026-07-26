'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Users, FolderOpen, MessageSquare, LayoutDashboard, LogOut, Dumbbell, Sun, Moon, CalendarClock, Newspaper, BarChart3, Trophy, Settings, BookOpen, CreditCard, LifeBuoy, Inbox } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/ThemeProvider';

const NAV = [
  { href: '/',             label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/articles',     label: 'Actualités',  icon: Newspaper },
  { href: '/schedules',    label: 'Horaires',    icon: CalendarClock },
  { href: '/wods',         label: 'Whiteboard',  icon: Dumbbell },
  { href: '/tournaments',  label: 'Tournois',    icon: Trophy },
  { href: '/groups',       label: 'Groupes',     icon: FolderOpen },
  { href: '/members',      label: 'Membres',     icon: Users },
  { href: '/programs',     label: 'Offres & Programmes', icon: BookOpen },
  { href: '/subscribers',  label: 'Abonnés',     icon: CreditCard },
  { href: '/stats',        label: 'Statistiques', icon: BarChart3 },
  { href: '/messages',     label: 'Messages',    icon: MessageSquare },
  { href: '/support',      label: 'Support',     icon: LifeBuoy },
  { href: '/settings',     label: 'Réglages',    icon: Settings },
];

interface SidebarProps {
  box: { name: string; plan: string } | null;
  email: string;
  unreadCount?: number;
  supportUnread?: number;
  isSupportAdmin?: boolean;
  supportAdminUnread?: number;
}

export default function Sidebar({ box, email, unreadCount = 0, supportUnread = 0, isSupportAdmin = false, supportAdminUnread = 0 }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const { theme, toggle } = useTheme();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const planColor = box?.plan === 'pro' ? '#8B5CF6' : box?.plan === 'elite' ? '#FFFFFF' : '#FFFFFF';
  const planLabel = box?.plan === 'pro' ? 'Pro' : box?.plan === 'elite' ? 'Elite' : 'Starter';

  return (
    <aside className="fixed top-0 left-0 h-full w-60 bg-[#080808] border-r border-white/[0.06] flex flex-col z-40">
      {/* Logo + box */}
      <div className="px-5 py-6 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 flex items-center justify-center bg-black">
            <img src="/logo.png" alt="Test" width={36} height={36} className="object-contain w-full h-full" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-white/30 tracking-widest uppercase">Test</p>
            <p className="text-sm font-bold text-white truncate leading-tight">
              {box?.name ?? 'Ma Box'}
            </p>
          </div>
        </div>
        <span
          className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md"
          style={{ backgroundColor: `${planColor}25`, color: planColor }}
        >
          {planLabel}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/'
            ? pathname === '/'
            : href === '/support'
              ? (pathname === '/support' || (pathname.startsWith('/support') && !pathname.startsWith('/support/admin')))
              : pathname.startsWith(href);
          return (
            <Link
              key={href} href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all relative',
                active
                  ? 'bg-white/20 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              )}
            >
              <Icon size={17} className={active ? 'text-white' : ''} />
              {label}
              {label === 'Messages' && unreadCount > 0 && (
                <span className="ml-auto bg-white text-[#0A0A0A] text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
              {label === 'Support' && supportUnread > 0 && (
                <span className="ml-auto bg-white text-[#0A0A0A] text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {supportUnread > 99 ? '99+' : supportUnread}
                </span>
              )}
            </Link>
          );
        })}
        {isSupportAdmin && (() => {
          const active = pathname.startsWith('/support/admin');
          return (
            <Link
              href="/support/admin"
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all relative',
                active ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
              )}
            >
              <Inbox size={17} className={active ? 'text-white' : ''} />
              Support (Admin)
              {supportAdminUnread > 0 && (
                <span className="ml-auto bg-white text-[#0A0A0A] text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {supportAdminUnread > 99 ? '99+' : supportAdminUnread}
                </span>
              )}
            </Link>
          );
        })()}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center text-white text-xs font-black">
            {email[0]?.toUpperCase()}
          </div>
          <p className="text-xs text-gray-400 truncate flex-1">{email}</p>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={toggle}
            title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
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
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
