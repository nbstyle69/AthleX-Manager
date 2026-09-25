'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Users, Search, Building2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { ADMIN_LEVEL_COLOR, PURPLE_SOFT, SUB_ORANGE_TEXT } from '@/components/admin/adminTokens';

const PAGE_SIZE = 50;

interface UserProfile {
  id: string;
  username: string;
  role: string;
  level: string;
  elo: number;
  total_matches: number;
  wins: number;
  created_at: string;
  box_name: string | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  type SortCol = 'username' | 'role' | 'box' | 'level' | 'elo' | 'matches' | 'wins' | 'date' | '';
  const [sortCol, setSortCol] = useState<SortCol>('elo');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  function toggleSort(col: SortCol) {
    if (sortCol === col) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
    else { setSortCol(col); setSortDir(col === 'elo' || col === 'matches' || col === 'wins' ? 'desc' : 'asc'); }
  }
  const supabase = createClient();

  const load = useCallback(async (currentPage: number, currentSearch: string) => {
    setLoading(true);
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    // Server-side count (with search filter if any)
    // Colonne autorisée, pas `*` : `authenticated` n'a plus SELECT sur email.
    let countQuery = supabase.from('profiles').select('id', { count: 'exact', head: true });
    if (currentSearch) countQuery = countQuery.ilike('username', `%${currentSearch}%`);
    const { count } = await countQuery;
    setTotalCount(count ?? 0);

    // Server-side paginated query
    let dataQuery = supabase
      .from('profiles')
      .select('id, username, role, level, elo, total_matches, wins, created_at')
      .order('elo', { ascending: false })
      .range(from, to);
    if (currentSearch) dataQuery = dataQuery.ilike('username', `%${currentSearch}%`);
    const { data: profiles } = await dataQuery;

    // Fetch box memberships only for current page users
    const userIds = (profiles ?? []).map(p => p.id);
    const boxMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: memberships } = await supabase
        .from('box_members')
        .select('member_id, box:boxes!box_members_box_id_fkey(name)')
        .eq('status', 'active')
        .in('member_id', userIds);
      (memberships ?? []).forEach((m: any) => {
        const box = Array.isArray(m.box) ? m.box[0] : m.box;
        if (box?.name) boxMap.set(m.member_id, box.name);
      });

      const { data: boxes } = await supabase
        .from('boxes')
        .select('owner_id, name')
        .in('owner_id', userIds);
      (boxes ?? []).forEach((b: any) => {
        if (b.owner_id && !boxMap.has(b.owner_id)) boxMap.set(b.owner_id, b.name);
      });
    }

    setUsers((profiles ?? []).map(p => ({ ...p, box_name: boxMap.get(p.id) ?? null })));
    setLoading(false);
  }, []);

  useEffect(() => { load(page, search); }, [load, page]);

  // On search change: reset to page 0 and reload
  useEffect(() => {
    const t = setTimeout(() => { setPage(0); load(0, search); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const filtered = (() => {
    let list = [...users];  // already filtered server-side
    if (sortCol) {
      const dir = sortDir === 'asc' ? 1 : -1;
      const LEVEL_ORDER: Record<string, number> = { pro: 6, gx: 5, 'rx+': 4, rx: 3, inter: 2, scaled: 1 };
      list = [...list].sort((a, b) => {
        switch (sortCol) {
          case 'username': return dir * (a.username ?? '').localeCompare(b.username ?? '');
          case 'role':     return dir * (a.role ?? '').localeCompare(b.role ?? '');
          case 'box':      return dir * (a.box_name ?? '').localeCompare(b.box_name ?? '');
          case 'level':    return dir * ((LEVEL_ORDER[a.level] ?? 0) - (LEVEL_ORDER[b.level] ?? 0));
          case 'elo':      return dir * (a.elo - b.elo);
          case 'matches':  return dir * (a.total_matches - b.total_matches);
          case 'wins':     return dir * (a.wins - b.wins);
          case 'date':     return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          default: return 0;
        }
      });
    }
    return list;
  })();

  // Même sens qu'avant (super admin vert, admin bleu, gérant violet, autres
  // neutres), en jetons lisibles dans les deux thèmes.
  const roleColor = (r: string) =>
    r === 'super_admin' ? 'text-ax-success bg-ax-success-soft' :
    r === 'admin' ? 'text-ax-info bg-ax-info-soft' :
    r === 'box_owner' ? `text-ax-purple ${PURPLE_SOFT}` :
    'text-ax-text-secondary bg-ax-neutral-soft';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 shrink-0 rounded-ax-control ${PURPLE_SOFT} flex items-center justify-center`}>
            <Users size={22} className="text-ax-purple" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-medium uppercase tracking-wide text-ax-text">Utilisateurs</h1>
            <p className="text-sm text-ax-text-secondary">{totalCount} athlètes inscrits</p>
          </div>
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ax-text-muted pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            aria-label="Rechercher un utilisateur"
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-ax-border border-t-ax-accent-text rounded-full animate-spin" />
        </div>
      ) : (
        // À 390 px, le défilement horizontal est limité au tableau : mêmes
        // colonnes, même ordre, rien de masqué.
        <Table aria-label="Utilisateurs">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {[
                { key: 'username' as SortCol, label: 'Utilisateur' },
                { key: 'role' as SortCol, label: 'Rôle' },
                { key: 'box' as SortCol, label: 'Box' },
                { key: 'level' as SortCol, label: 'Niveau' },
                { key: 'elo' as SortCol, label: 'ELO' },
                { key: 'matches' as SortCol, label: 'Matchs' },
                { key: 'wins' as SortCol, label: 'Wins' },
                { key: 'date' as SortCol, label: 'Inscrit le' },
              ].map(col => (
                <TableHead key={col.label}
                  aria-sort={sortCol === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                  className="px-5 whitespace-nowrap">
                  {/* Bouton dans l'en-tête : le tri marche aussi au clavier, même action qu'au clic. */}
                  <button type="button" onClick={() => toggleSort(col.key)}
                    className={`inline-flex items-center gap-1 rounded-ax-control font-bold uppercase tracking-wider select-none transition-colors hover:text-ax-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus motion-reduce:transition-none ${
                      sortCol === col.key ? 'text-ax-accent-text' : 'text-ax-text-secondary'
                    }`}>
                    {col.label}
                    {sortCol === col.key && (
                      sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                    )}
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(u => (
              <TableRow key={u.id}>
                <TableCell className="px-5 py-4">
                  <div className="flex items-center gap-3 min-w-[11rem]">
                    <div className="w-8 h-8 shrink-0 rounded-full bg-ax-neutral-soft flex items-center justify-center text-xs font-black text-ax-text-secondary">
                      {u.username?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <span className="font-bold text-ax-text break-words">{u.username}</span>
                  </div>
                </TableCell>
                <TableCell className="px-5 py-4">
                  <span className={`whitespace-nowrap text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-ax-badge ${roleColor(u.role)}`}>
                    {u.role}
                  </span>
                </TableCell>
                <TableCell className="px-5 py-4">
                  {u.box_name ? (
                    <span className={`flex items-center gap-1.5 text-xs font-semibold min-w-[9rem] break-words ${SUB_ORANGE_TEXT}`}>
                      <Building2 size={12} className="shrink-0" />
                      {u.box_name}
                    </span>
                  ) : (
                    <span className="text-xs text-ax-text-muted">—</span>
                  )}
                </TableCell>
                <TableCell className="px-5 py-4">
                  <span className="text-xs font-black uppercase" style={{ color: ADMIN_LEVEL_COLOR[u.level] ?? 'var(--ax-level-scaled)' }}>
                    {u.level}
                  </span>
                </TableCell>
                <TableCell className="px-5 py-4">
                  <span className="font-black text-ax-warning">{u.elo}</span>
                </TableCell>
                <TableCell className="px-5 py-4 text-ax-text">{u.total_matches}</TableCell>
                <TableCell className="px-5 py-4 text-ax-text">{u.wins}</TableCell>
                <TableCell className="px-5 py-4 text-ax-text-secondary text-xs whitespace-nowrap">
                  {new Date(u.created_at).toLocaleDateString('fr-FR')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-xs text-ax-text-secondary">
            Page {page + 1} / {totalPages} &nbsp;·&nbsp; {totalCount} utilisateurs
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ax-outline" size="ax-compact"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0 || loading}>
              <ChevronLeft size={13} /> Préc.
            </Button>
            <span className="text-xs font-black text-ax-text tabular-nums w-16 text-center">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)}
            </span>
            <Button variant="ax-outline" size="ax-compact"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}>
              Suiv. <ChevronRight size={13} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
