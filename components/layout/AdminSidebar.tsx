'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Shield, LayoutDashboard, Swords, Users, Trophy, LogOut, Sun, Moon, Building2, Globe2, Award, Dumbbell, FileText, MapPin, BarChart3, Handshake, Flag, LifeBuoy, Gauge, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/ThemeProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const NAV = [
  { href: '/admin',                label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/admin/daily-contests', label: 'Contestations',  icon: Swords },
  { href: '/admin/tournaments',    label: 'Tournois',       icon: Trophy },
  { href: '/admin/users',          label: 'Utilisateurs',   icon: Users },
  { href: '/admin/reports',        label: 'Signalements',   icon: Flag },
  { href: '/admin/boxes',            label: 'Boxs',            icon: Building2 },
  { href: '/admin/inter-competitions', label: 'Compet. Inter-box', icon: Globe2 },
  { href: '/admin/physical-competitions', label: 'Compet. Physiques', icon: MapPin },
  { href: '/admin/badges',              label: 'Badges',            icon: Award },
  { href: '/admin/movements',           label: 'Mouvements',        icon: Dumbbell },
  { href: '/admin/volume-caps',         label: 'Plafonds WOD',      icon: Gauge },
  { href: '/admin/auto-programming',    label: 'Prog. automatique', icon: Sparkles },
  { href: '/admin/support',              label: 'Support',           icon: LifeBuoy },
  { href: '/admin/partners',             label: 'Partenaires',       icon: Handshake },
  { href: '/admin/analytics',            label: 'Statistiques',      icon: BarChart3 },
  { href: '/admin/changelog',           label: 'Changelog',         icon: FileText },
];

interface AdminSidebarProps {
  username: string;
  email: string;
  supportUnread?: number;
}

export default function AdminSidebar({ username, email, supportUnread = 0 }: AdminSidebarProps) {
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
    <aside className="fixed top-0 left-0 h-full w-60 bg-ax-glass backdrop-blur-ax-glass border-r border-ax-border flex flex-col z-40">
      {/* Header */}
      <div className="px-5 py-6 border-b border-ax-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-ax-control overflow-hidden shrink-0 flex items-center justify-center bg-ax-accent-soft">
            <Shield size={20} className="text-ax-accent-text" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-sm font-medium text-ax-text-muted tracking-widest uppercase">AthleX Manager</p>
            <p className="text-sm font-bold text-ax-text truncate leading-tight">Super Admin</p>
          </div>
        </div>
        <Badge variant="accent" className="text-[10px] font-extrabold uppercase tracking-widest py-0.5">
          ADMIN
        </Badge>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
          return (
            <Link
              key={href} href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-ax-control text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus motion-reduce:transition-none',
                active
                  ? 'bg-ax-accent-soft text-ax-accent-text'
                  : 'text-ax-text-secondary hover:text-ax-text hover:bg-ax-hover'
              )}
            >
              <Icon size={17} className={active ? 'text-ax-accent-text' : ''} />
              {label}
              {label === 'Support' && supportUnread > 0 && (
                <span className="ml-auto bg-ax-accent text-ax-accent-foreground text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {supportUnread > 99 ? '99+' : supportUnread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-ax-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-ax-accent-soft flex items-center justify-center text-ax-accent-text text-xs font-black">
            {username[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-ax-text truncate">{username}</p>
            <p className="text-[10px] text-ax-text-muted truncate">{email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <Button
            variant="ax-outline"
            onClick={toggle}
            className="flex-1 justify-start min-h-10 px-3 py-2 text-sm"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          </Button>
        </div>
        <Button
          variant="ax-outline"
          onClick={handleSignOut}
          className="w-full justify-start min-h-10 px-3 py-2 text-sm hover:text-ax-danger hover:bg-ax-danger-soft"
        >
          <LogOut size={15} />
          DÃ©connexion
        </Button>
      </div>
    </aside>
  );
}
