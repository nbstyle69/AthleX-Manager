'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Users, FolderOpen, MessageSquare, LayoutDashboard, LogOut, Dumbbell, Sun, Moon, CalendarClock, CalendarDays, Newspaper, BarChart3, Trophy, Settings, BookOpen, CreditCard, LifeBuoy, Inbox, Store, UserPlus, MailPlus, ChevronDown, UserCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/ThemeProvider';
import BoxSwitcher, { type SwitcherBox } from '@/components/layout/BoxSwitcher';
import { COACH_HREFS } from '@/lib/authz/coach-perimeter';
import { ATHLETE_HOME } from '@/lib/authz/post-login';

type NavItem = { href: string; label: string; icon: typeof Users };
type NavGroup = { key: string; label: string; items: NavItem[] };

const DASHBOARD: NavItem = { href: '/', label: 'Dashboard', icon: LayoutDashboard };

// Regroupement par casquette du gérant. L'ordre de « Communauté » suit le
// parcours de vie d'un adhérent : prospect → invité → membre → abonné.
const GROUPS: NavGroup[] = [
  {
    key: 'entrainement',
    label: 'Entraînement',
    items: [
      { href: '/wods',        label: 'Whiteboard',    icon: Dumbbell },
      { href: '/programming', label: 'Marketplace',   icon: Store },
      { href: '/schedules',   label: 'Horaires',      icon: CalendarClock },
      { href: '/templates',   label: 'Créneaux types', icon: CalendarDays },
    ],
  },
  {
    key: 'communaute',
    label: 'Communauté',
    items: [
      { href: '/prospects',   label: 'Prospects',   icon: UserPlus },
      { href: '/invitations', label: 'Invitations', icon: MailPlus },
      { href: '/members',     label: 'Membres',     icon: Users },
      { href: '/subscribers', label: 'Abonnés',     icon: CreditCard },
      { href: '/groups',      label: 'Groupes',     icon: FolderOpen },
    ],
  },
  {
    key: 'animation',
    label: 'Animation',
    items: [
      { href: '/tournaments', label: 'Tournois',   icon: Trophy },
      { href: '/articles',    label: 'Actualités', icon: Newspaper },
      { href: '/messages',    label: 'Messages',   icon: MessageSquare },
    ],
  },
  {
    key: 'business',
    label: 'Business',
    items: [
      { href: '/programs', label: 'Programmes athlètes', icon: BookOpen },
      { href: '/stats',    label: 'Statistiques',        icon: BarChart3 },
    ],
  },
];

const PINNED: NavItem[] = [
  { href: '/support',  label: 'Support',  icon: LifeBuoy },
  { href: '/settings', label: 'Réglages', icon: Settings },
];

// La nav du coach est dérivée du même périmètre que la garde serveur
// (`COACH_HREFS`) : masquer un lien n'est pas refuser l'accès, mais les deux ne
// doivent pas pouvoir diverger.

function isActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  // /support ne doit pas s'allumer sur la boîte de réception admin, qui a sa
  // propre entrée.
  if (href === '/support') return pathname.startsWith('/support') && !pathname.startsWith('/support/admin');
  return pathname.startsWith(href);
}

function storageKey(email: string) {
  return `athlex.sidebar.collapsed.${email}`;
}

interface SidebarProps {
  box: { name: string; plan: string } | null;
  email: string;
  unreadCount?: number;
  supportUnread?: number;
  isSupportAdmin?: boolean;
  supportAdminUnread?: number;
  invitationsToCollect?: number;
  boxes?: SwitcherBox[];
  activeBoxId?: string;
  isOwnerAdmin?: boolean;
}

export default function Sidebar({ box, email, unreadCount = 0, supportUnread = 0, isSupportAdmin = false, supportAdminUnread = 0, invitationsToCollect = 0, boxes = [], activeBoxId, isOwnerAdmin = false }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const { theme, toggle } = useTheme();

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const groups = useMemo<NavGroup[]>(
    () => (isOwnerAdmin
      ? GROUPS
      : GROUPS
        .map(g => ({ ...g, items: g.items.filter(i => COACH_HREFS.includes(i.href)) }))
        .filter(g => g.items.length > 0)),
    [isOwnerAdmin],
  );

  const badges = useMemo<Record<string, number>>(() => ({
    '/messages':    unreadCount,
    '/support':     supportUnread,
    '/invitations': invitationsToCollect,
  }), [unreadCount, supportUnread, invitationsToCollect]);

  // Restauration de l'état plié/déplié : par utilisateur, et seulement après
  // hydratation (le serveur ne connaît pas le localStorage).
  useEffect(() => {
    if (!email) return;
    try {
      const raw = localStorage.getItem(storageKey(email));
      if (raw) setCollapsed(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      // état d'affichage : un stockage illisible ne doit pas casser la nav
    }
  }, [email]);

  const persist = useCallback((next: Record<string, boolean>) => {
    setCollapsed(next);
    if (!email) return;
    try {
      localStorage.setItem(storageKey(email), JSON.stringify(next));
    } catch {
      // idem : le pli est un confort, pas une donnée
    }
  }, [email]);

  // Le groupe qui contient la page courante s'ouvre de lui-même : on ne peut
  // pas se retrouver sur un écran dont l'entrée est masquée.
  const activeGroupKey = useMemo(
    () => groups.find(g => g.items.some(i => isActive(i.href, pathname)))?.key ?? null,
    [groups, pathname],
  );

  useEffect(() => {
    if (!activeGroupKey) return;
    setCollapsed(prev => {
      if (!prev[activeGroupKey]) return prev;
      const next = { ...prev, [activeGroupKey]: false };
      if (email) {
        try { localStorage.setItem(storageKey(email), JSON.stringify(next)); } catch { /* voir plus haut */ }
      }
      return next;
    });
  }, [activeGroupKey, email]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  // Les paliers réellement écrits par la facturation : `trial`, `complete`,
  // `multi`. Le badge affichait « Starter » pour tout le reste, donc pour un
  // plan complet actif.
  const PLAN_LABELS: Record<string, string> = {
    trial:    'Essai',
    complete: 'Complet',
    multi:    'Multi-box',
  };
  const planColor = box?.plan === 'multi' ? '#8B5CF6' : '#FFFFFF';
  const planLabel = PLAN_LABELS[box?.plan ?? ''] ?? 'Aucun plan';

  const linkClass = (active: boolean) => cn(
    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all relative',
    active ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5',
  );

  const badge = (count: number) => (
    <span className="ml-auto bg-white text-[#0A0A0A] text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
      {count > 99 ? '99+' : count}
    </span>
  );

  const navLink = (item: NavItem) => {
    const active = isActive(item.href, pathname);
    const count  = badges[item.href] ?? 0;
    const Icon   = item.icon;
    return (
      <Link key={item.href} href={item.href} className={linkClass(active)}>
        <Icon size={17} className={active ? 'text-white' : ''} />
        {item.label}
        {count > 0 && badge(count)}
      </Link>
    );
  };

  return (
    <aside className="fixed top-0 left-0 h-full w-60 bg-[#080808] border-r border-white/[0.06] flex flex-col z-40">
      {/* Logo + box */}
      <div className="px-5 py-6 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 flex items-center justify-center bg-black">
            <img src="/logo.png" alt="AthleX" width={36} height={36} className="object-contain w-full h-full" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-white/30 tracking-widest uppercase">AthleX Manager</p>
            <p className="text-sm font-bold text-white truncate leading-tight">
              {box?.name ?? 'Ma Box'}
            </p>
          </div>
        </div>
        {/* L'état d'abonnement de la box est une information d'argent : même
            frontière que les routes et les RPC. Le coach ne le voit pas — et il
            ne le voyait pas juste : sa lecture de `box_subscriptions` étant
            refusée, le badge lui affichait « Aucun plan » sur une box payée. */}
        {isOwnerAdmin && (
          <span
            className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md"
            style={{ backgroundColor: `${planColor}25`, color: planColor }}
          >
            {planLabel}
          </span>
        )}
        {boxes.length > 1 && activeBoxId && (
          <BoxSwitcher boxes={boxes} activeBoxId={activeBoxId} />
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {isOwnerAdmin && <div className="space-y-0.5">{navLink(DASHBOARD)}</div>}

        {groups.map(group => {
          const open        = !collapsed[group.key];
          const hasActive   = group.items.some(i => isActive(i.href, pathname));
          // Un groupe replié ne doit jamais avaler une notification : les
          // compteurs de ses entrées remontent sur son en-tête.
          const groupCount  = group.items.reduce((sum, i) => sum + (badges[i.href] ?? 0), 0);
          return (
            <div key={group.key} className="mt-4">
              <button
                type="button"
                onClick={() => persist({ ...collapsed, [group.key]: open })}
                aria-expanded={open}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all"
              >
                <ChevronDown size={13} className={cn('transition-transform', open ? '' : '-rotate-90')} />
                {group.label}
                {!open && hasActive && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />}
                {!open && groupCount > 0 && badge(groupCount)}
              </button>
              {open && <div className="mt-0.5 space-y-0.5">{group.items.map(navLink)}</div>}
            </div>
          );
        })}
      </nav>

      {/* Épinglés + footer */}
      <div className="px-3 pt-3 border-t border-white/[0.06] space-y-0.5">
        {isOwnerAdmin && PINNED.map(navLink)}
        {isSupportAdmin && (
          <Link href="/support/admin" className={linkClass(pathname.startsWith('/support/admin'))}>
            <Inbox size={17} className={pathname.startsWith('/support/admin') ? 'text-white' : ''} />
            Support (Admin)
            {supportAdminUnread > 0 && badge(supportAdminUnread)}
          </Link>
        )}
      </div>

      <div className="px-4 py-4">
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
        {/* Le back-office et l'espace athlète sont deux lieux, et un même compte
            peut relever des deux (coach ici, membre ailleurs). Sans ce lien, il
            faut taper l'URL pour revenir chez soi. */}
        <Link
          href={ATHLETE_HOME}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all"
        >
          <UserCircle size={15} />
          Mon espace athlète
        </Link>
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
