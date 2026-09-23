'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Users, FolderOpen, MessageSquare, LayoutDashboard, LogOut, Dumbbell, Sun, Moon, CalendarClock, CalendarDays, Newspaper, BarChart3, Trophy, Settings, Tag, CreditCard, CircleHelp, LifeBuoy, Inbox, Store, UserPlus, MailPlus, ChevronDown, UserCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/ThemeProvider';
import BoxSwitcher, { type SwitcherBox } from '@/components/layout/BoxSwitcher';
import MobileNavBar, { useMobileMenu } from '@/components/layout/MobileNavBar';
import { COACH_HREFS } from '@/lib/authz/coach-perimeter';
import { ATHLETE_HOME } from '@/lib/authz/post-login';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';

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
      { href: '/plans',       label: 'Formules',    icon: Tag },
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
    key: 'pilotage',
    label: 'Pilotage',
    items: [
      { href: '/stats', label: 'Statistiques', icon: BarChart3 },
    ],
  },
];

const PINNED: NavItem[] = [
  { href: '/support',  label: 'Support',  icon: LifeBuoy },
  { href: '/settings', label: 'Réglages', icon: Settings },
];

// Les tutoriels sont écrits pour les deux casquettes : l'entrée est épinglée
// pour tout le monde, coach compris, et `/help` est nommée dans le périmètre
// coach pour que la garde serveur et la barre latérale disent la même chose.
const HELP: NavItem = { href: '/help', label: 'Aide', icon: CircleHelp };

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
  const { open: menuOpen, setOpen: setMenuOpen, onNavigate, onCloseAutoFocus } = useMobileMenu(pathname);

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
  const planColor = box?.plan === 'multi' ? 'text-ax-purple' : 'text-ax-text';
  const planLabel = PLAN_LABELS[box?.plan ?? ''] ?? 'Aucun plan';

  const linkClass = (active: boolean) => cn(
    'flex items-center gap-3 px-3 py-2.5 rounded-ax-control text-sm font-semibold transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus motion-reduce:transition-none',
    active ? 'bg-ax-accent-soft text-ax-accent-text' : 'text-ax-text-secondary hover:text-ax-text hover:bg-ax-hover',
  );

  const badge = (count: number) => (
    <span className="ml-auto bg-ax-accent text-ax-accent-foreground text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
      {count > 99 ? '99+' : count}
    </span>
  );

  const navLink = (item: NavItem) => {
    const active = isActive(item.href, pathname);
    const count  = badges[item.href] ?? 0;
    const Icon   = item.icon;
    return (
      <Link key={item.href} href={item.href} className={linkClass(active)} onClick={onNavigate}>
        <Icon size={17} className={active ? 'text-ax-accent-text' : ''} />
        {item.label}
        {count > 0 && badge(count)}
      </Link>
    );
  };

  const logo = (
    <div className="w-full h-full rounded-ax-control overflow-hidden shrink-0 flex items-center justify-center bg-ax-accent-foreground">
      <img src="/logo.png" alt="AthleX" width={36} height={36} className="object-contain w-full h-full" />
    </div>
  );

  const planBadgeClass = cn('text-[10px] font-extrabold uppercase tracking-widest py-0.5', planColor);

  const panel = (
    <>
      {/* Logo + box */}
      <div className="px-5 py-6 border-b border-ax-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 shrink-0">{logo}</div>
          <div className="min-w-0">
            <p className="font-display text-sm font-medium text-ax-text-muted tracking-widest uppercase">AthleX Manager</p>
            <p className="text-sm font-bold text-ax-text truncate leading-tight">
              {box?.name ?? 'Ma Box'}
            </p>
          </div>
        </div>
        {/* L'état d'abonnement de la box est une information d'argent : même
            frontière que les routes et les RPC. Le coach ne le voit pas — et il
            ne le voyait pas juste : sa lecture de `box_subscriptions` étant
            refusée, le badge lui affichait « Aucun plan » sur une box payée. */}
        {isOwnerAdmin && (
          <Badge className={planBadgeClass}>
            {planLabel}
          </Badge>
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
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-ax-control text-[11px] font-bold uppercase tracking-widest text-ax-text-muted hover:text-ax-text hover:bg-ax-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus motion-reduce:transition-none"
              >
                <ChevronDown size={13} className={cn('transition-transform', open ? '' : '-rotate-90')} />
                {group.label}
                {!open && hasActive && <span className="w-1.5 h-1.5 rounded-full bg-ax-accent-text shrink-0" />}
                {!open && groupCount > 0 && badge(groupCount)}
              </button>
              {open && <div className="mt-0.5 space-y-0.5">{group.items.map(navLink)}</div>}
            </div>
          );
        })}
      </nav>

      {/* Épinglés + footer */}
      <div className="px-3 pt-3 border-t border-ax-border space-y-0.5">
        {isOwnerAdmin && PINNED.map(navLink)}
        {navLink(HELP)}
        {isSupportAdmin && (
          <Link href="/support/admin" className={linkClass(pathname.startsWith('/support/admin'))} onClick={onNavigate}>
            <Inbox size={17} className={pathname.startsWith('/support/admin') ? 'text-ax-accent-text' : ''} />
            Support (Admin)
            {supportAdminUnread > 0 && badge(supportAdminUnread)}
          </Link>
        )}
      </div>

      <div className="px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-ax-accent-soft flex items-center justify-center text-ax-accent-text text-xs font-black">
            {email[0]?.toUpperCase()}
          </div>
          <p className="text-xs text-ax-text-secondary truncate flex-1">{email}</p>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <Button
            variant="ax-outline"
            size="ax-compact"
            onClick={toggle}
            title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
            className="flex-1 justify-start"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          </Button>
        </div>
        {/* Le back-office et l'espace athlète sont deux lieux, et un même compte
            peut relever des deux (coach ici, membre ailleurs). Sans ce lien, il
            faut taper l'URL pour revenir chez soi. */}
        <Link
          href={ATHLETE_HOME}
          className={cn(buttonVariants({ variant: 'ax-outline', size: 'ax-compact' }), 'w-full justify-start')}
          onClick={onNavigate}
        >
          <UserCircle size={15} />
          Mon espace athlète
        </Link>
        <Button
          variant="ax-outline"
          size="ax-compact"
          onClick={handleSignOut}
          className="w-full justify-start mt-1 hover:text-ax-danger hover:bg-ax-danger-soft"
        >
          <LogOut size={15} />
          Déconnexion
        </Button>
      </div>
    </>
  );

  return (
    <>
      <MobileNavBar
        logo={logo}
        title={box?.name ?? 'Ma Box'}
        badge={isOwnerAdmin && <Badge className={planBadgeClass}>{planLabel}</Badge>}
        open={menuOpen}
        onOpenChange={setMenuOpen}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {panel}
      </MobileNavBar>
      <aside className="hidden lg:flex fixed top-0 left-0 h-full w-60 bg-ax-glass backdrop-blur-ax-glass border-r border-ax-border flex-col z-40">
        {panel}
      </aside>
    </>
  );
}
