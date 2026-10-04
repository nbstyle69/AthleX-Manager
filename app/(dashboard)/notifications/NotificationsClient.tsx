'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Bell, BellOff, Loader2, Search, Send, User } from 'lucide-react';
import HelpButton from '@/components/help/HelpButton';
import { createClient } from '@/lib/supabase/client';
import { getMyBox } from '@/lib/getMyBox';
import { messageErreur } from '@/lib/erreurs';
import { ERROR_TITLE } from '@/lib/confirmDialog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  MESSAGE_MAX, TITRE_MAX,
  compteurListe, dateHistorique, envoiPossible, envoyerNotification, filtrerMembres, grouperParLettre,
  libelleDestinataire, membrePreselectionne, resultatEnvoi, resultatHistorique,
  type MembreAZ, type Ton,
} from '@/lib/boxNotifications';

interface Historique {
  id: string;
  title: string;
  target: string;
  created_at: string;
  delivered_count: number | null;
}

const TON_TEXTE: Record<Ton, string> = { success: 'text-ax-success', warning: 'text-ax-warning' };
const TON_BORD: Record<Ton, string> = { success: 'border-ax-success', warning: 'border-ax-warning' };

const pastille = (actif: boolean) => cn(
  'rounded-ax-control border px-3.5 py-2 text-sm font-semibold transition-colors motion-reduce:transition-none',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface',
  actif ? 'border-ax-accent bg-ax-accent text-ax-accent-foreground' : 'border-ax-border bg-ax-hover text-ax-text hover:border-ax-input-border',
);

const libelle = 'block text-xs font-semibold text-ax-text-secondary mb-1.5';

export default function NotificationsClient({ membreParam }: { membreParam: string | null }) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [boxId, setBoxId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [membres, setMembres] = useState<MembreAZ[]>([]);
  const [historique, setHistorique] = useState<Historique[]>([]);

  const [mode, setMode] = useState<'all' | 'one'>('all');
  const [choisi, setChoisi] = useState<string | null>(null);
  const [titre, setTitre] = useState('');
  const [message, setMessage] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [resultat, setResultat] = useState<{ ton: Ton; texte: string } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const chargerHistorique = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('box_notifications')
      .select('id, title, target, created_at, delivered_count')
      .eq('box_id', id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    setHistorique((data ?? []) as Historique[]);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const box = await getMyBox(supabase);
        if (!user || !box) return;
        setUserId(user.id);
        setBoxId(box.id);
        const { data, error } = await supabase
          .from('box_members')
          .select('member_id, profile:profiles(username)')
          .eq('box_id', box.id)
          .eq('status', 'active');
        if (error) throw error;
        const actifs = (data ?? []).map((m: any) => ({ user_id: m.member_id as string, username: (m.profile?.username as string) ?? '?' }));
        setMembres(actifs);
        const pre = membrePreselectionne(membreParam, actifs);
        if (pre) { setMode('one'); setChoisi(pre); }
        await chargerHistorique(box.id);
      } catch (e) {
        setLoadError(messageErreur(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase, membreParam, chargerHistorique]);

  const pret = envoiPossible(titre, envoi) && (mode === 'all' || !!choisi);

  async function envoyer() {
    if (!boxId || !userId || !pret) return;
    const target = mode === 'all' ? 'all' : choisi!;
    setEnvoi(true);
    setResultat(null);
    setErreur(null);
    const r = await envoyerNotification(supabase, { boxId, userId, titre, message, target });
    if (r.ok) {
      setResultat(resultatEnvoi(r.sent, target === 'all' ? null : libelleDestinataire(target, membres)));
    } else {
      setErreur(r.erreur);
    }
    // La ligne existe dès que l'insertion a réussi, même si l'envoi a échoué :
    // le formulaire repart à zéro (comme l'app) et l'historique la montre.
    if (r.ok || r.enregistree) {
      setTitre(''); setMessage(''); setMode('all'); setChoisi(null);
      try { await chargerHistorique(boxId); } catch { /* relu au prochain chargement */ }
    }
    setEnvoi(false);
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-medium uppercase tracking-wide text-ax-text">Notifications</h1>
          <HelpButton />
        </div>
        <p className="text-sm text-ax-text-secondary mt-1">Envoie un message sur le téléphone de tes membres actifs.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-ax-text" /></div>
      ) : loadError ? (
        <div role="alert" className="rounded-ax-control border border-ax-danger bg-ax-danger-soft px-4 py-3 text-sm text-ax-danger">
          <p className="font-semibold">{ERROR_TITLE}</p>
          <p className="mt-1">{loadError}</p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          <Card className="w-full lg:w-[400px] lg:shrink-0">
            <CardHeader className="p-6 pb-3">
              <CardTitle>Nouvelle notification</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-3">
              <div>
                <span id="notif-destinataire" className={libelle}>Destinataire</span>
                <div role="group" aria-labelledby="notif-destinataire" className="flex flex-wrap gap-2">
                  <button type="button" aria-pressed={mode === 'all'} className={pastille(mode === 'all')}
                    onClick={() => { setMode('all'); setChoisi(null); }}>
                    Tous les membres ({membres.length})
                  </button>
                  <button type="button" aria-pressed={mode === 'one'} className={pastille(mode === 'one')}
                    onClick={() => setMode('one')}>
                    Un membre
                  </button>
                </div>
              </div>

              {mode === 'one' && (
                choisi ? (
                  <div data-testid="notif-choisi" className="flex items-center gap-2.5 rounded-ax-control border border-ax-input-border bg-ax-background px-3.5 py-3">
                    <User size={16} className="shrink-0 text-ax-text-secondary" aria-hidden />
                    <span className="flex-1 min-w-0 truncate text-sm font-semibold text-ax-text">{libelleDestinataire(choisi, membres)}</span>
                    <button type="button" onClick={() => setChoisi(null)}
                      aria-label={`Changer de membre (actuellement ${libelleDestinataire(choisi, membres)})`}
                      className="shrink-0 rounded-ax-control px-1.5 py-0.5 text-xs font-semibold text-ax-accent-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus">
                      Changer
                    </button>
                  </div>
                ) : (
                  <ChoixMembre membres={membres} onChoisir={setChoisi} />
                )
              )}

              <div>
                <label htmlFor="notif-titre" className={libelle}>Titre</label>
                <Input id="notif-titre" value={titre} maxLength={TITRE_MAX} onChange={(e) => setTitre(e.target.value)}
                  placeholder="Titre de la notification…" className="bg-ax-background" />
              </div>
              <div>
                <label htmlFor="notif-message" className={libelle}>Message (optionnel)</label>
                <textarea id="notif-message" value={message} maxLength={MESSAGE_MAX} onChange={(e) => setMessage(e.target.value)}
                  placeholder="Corps du message…" rows={3}
                  className="flex min-h-20 w-full rounded-ax-control border border-ax-input-border bg-ax-background px-3 py-2.5 text-base text-ax-text placeholder:text-ax-text-muted sm:text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ax-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface" />
              </div>

              <Button type="button" variant="ax-mint" className="w-full" disabled={!pret} onClick={envoyer} data-testid="notif-envoyer">
                {envoi ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Send size={16} aria-hidden />}
                {envoi ? 'Envoi…' : 'Envoyer'}
              </Button>

              {resultat && (
                <div role="status" data-testid={`notif-resultat-${resultat.ton}`}
                  className={cn('flex items-start gap-2.5 rounded-ax-card border px-3.5 py-3 text-[13px] leading-[18px] text-ax-text', TON_BORD[resultat.ton])}>
                  {resultat.ton === 'success'
                    ? <Bell size={16} className="mt-px shrink-0 text-ax-success" aria-hidden />
                    : <BellOff size={16} className="mt-px shrink-0 text-ax-warning" aria-hidden />}
                  <span>{resultat.texte}</span>
                </div>
              )}
              {erreur && (
                <div role="alert" className="rounded-ax-control border border-ax-danger bg-ax-danger-soft px-4 py-3 text-sm text-ax-danger">
                  <p className="font-semibold">{ERROR_TITLE}</p>
                  <p className="mt-1">{erreur}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="w-full min-w-0 lg:flex-1">
            <CardHeader className="p-6 pb-3">
              <CardTitle>Historique</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              {historique.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-ax-text-muted">
                  <Bell size={16} aria-hidden /> Aucune notification envoyée.
                </p>
              ) : (
                <Table aria-label="Historique des notifications">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Titre</TableHead>
                      <TableHead>Destinataire</TableHead>
                      <TableHead>Résultat</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historique.map((n) => {
                      const r = resultatHistorique(n.delivered_count);
                      return (
                        <TableRow key={n.id} data-testid={`notif-ligne-${n.id}`}>
                          <TableCell className="whitespace-nowrap text-[13px] text-ax-text-secondary">{dateHistorique(n.created_at)}</TableCell>
                          <TableCell className="font-semibold break-words min-w-[10rem]">{n.title}</TableCell>
                          <TableCell className="text-[13px] text-ax-text-secondary">{libelleDestinataire(n.target, membres)}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {r && (
                              <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', TON_TEXTE[r.ton])}>
                                {r.ton === 'success' ? <Bell size={14} aria-hidden /> : <BellOff size={14} aria-hidden />}
                                {r.texte}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/**
 * Champ « Rechercher ou choisir dans la liste » : liste des membres actifs de
 * A à Z, rangée par lettre, filtrée par la saisie (sans accents ni casse).
 * Clavier : flèches, Entrée pour choisir, Échap pour fermer.
 */
function ChoixMembre({ membres, onChoisir }: { membres: MembreAZ[]; onChoisir: (id: string) => void }) {
  const [saisie, setSaisie] = useState('');
  const [ouvert, setOuvert] = useState(true);
  const [actif, setActif] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listeRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const listeId = `${uid}-liste`;

  const filtres = useMemo(() => filtrerMembres(membres, saisie), [membres, saisie]);
  const sections = useMemo(() => grouperParLettre(filtres), [filtres]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setActif(0); }, [saisie]);
  useEffect(() => {
    listeRef.current?.querySelector(`[data-index="${actif}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [actif]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!ouvert) { setOuvert(true); return; }
      const d = e.key === 'ArrowDown' ? 1 : -1;
      setActif((i) => Math.min(Math.max(i + d, 0), Math.max(filtres.length - 1, 0)));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (ouvert && filtres[actif]) onChoisir(filtres[actif].user_id);
    } else if (e.key === 'Escape') {
      if (ouvert) { e.preventDefault(); setOuvert(false); }
    }
  }

  let index = -1;
  return (
    <div>
      <div className="relative">
        <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ax-text-secondary" />
        <Input ref={inputRef} role="combobox" aria-label="Rechercher ou choisir dans la liste"
          aria-expanded={ouvert} aria-controls={listeId} aria-autocomplete="list"
          aria-activedescendant={ouvert && filtres[actif] ? `${uid}-m-${actif}` : undefined}
          value={saisie} placeholder="Rechercher ou choisir dans la liste"
          onChange={(e) => { setSaisie(e.target.value); setOuvert(true); }}
          onClick={() => setOuvert(true)} onKeyDown={onKeyDown}
          className="bg-ax-background pl-10 border-ax-accent-text" />
      </div>
      {ouvert && (
        <div className="mt-2 rounded-ax-control border border-ax-input-border bg-ax-surface py-1.5 shadow-ax-panel">
          <p aria-live="polite" className="px-3.5 py-1 text-xs text-ax-text-secondary">
            {compteurListe(membres.length, filtres.length, saisie)}
          </p>
          <div ref={listeRef} id={listeId} role="listbox" aria-label="Membres actifs" className="max-h-72 overflow-y-auto">
            {sections.map((s) => (
              <div key={s.lettre} role="group" aria-label={s.lettre}>
                <p aria-hidden className="px-3.5 pt-2 pb-0.5 text-[9px] font-medium uppercase leading-3 tracking-[1px] text-ax-accent-text">{s.lettre}</p>
                {s.membres.map((m) => {
                  index += 1;
                  const i = index;
                  return (
                    <div key={m.user_id} id={`${uid}-m-${i}`} data-index={i} role="option" aria-selected={i === actif}
                      onMouseDown={(e) => e.preventDefault()} onClick={() => onChoisir(m.user_id)} onMouseEnter={() => setActif(i)}
                      className={cn('flex cursor-pointer items-center gap-2.5 px-3.5 py-2 text-sm font-semibold text-ax-text', i === actif && 'bg-ax-hover')}>
                      <User size={16} aria-hidden className="shrink-0 text-ax-text-secondary" />
                      <span className="min-w-0 truncate">{m.username}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
