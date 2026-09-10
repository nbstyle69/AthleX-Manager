'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Store, Plus, Pencil, Trash2, X, Check, Loader2, Search, Package,
  Globe, Lock, Video, Upload, Info, AlertTriangle,
} from 'lucide-react';
import { SUBSCRIPTION_COLORS, SUBSCRIPTION_COLOR_HEX, subscriptionColorHex } from '@/lib/audience';
import WodEditor from '@/components/wods/WodEditor';
import { ACTIVE_BOX_COOKIE, getMyAdminBoxes } from '@/lib/getMyBox';
import ProgWodImportModal from '@/components/wods/ProgWodImportModal';
import {
  BLOCK_COLOR, BLOCK_LABEL, DAY_LABELS, EMPTY_WOD_FORM, TYPE_COLOR,
  WodFormState, formatCap, movementLines, sharedWodColumns,
} from '@/lib/wodFields';
import { disciplineLabel } from '@/lib/disciplines';

const DISCIPLINES = ['crossfit', 'hyrox', 'hybrid', 'haltero', 'endurance'];
const LEVELS = ['all', 'beginner', 'intermediate', 'advanced'];
const LEVEL_LABEL: Record<string, string> = {
  all: 'Tous niveaux', beginner: 'Débutant', intermediate: 'Intermédiaire', advanced: 'Avancé',
};
const INPUT_CLS = 'w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

interface Box { id: string; name: string }

interface Programming {
  id: string;
  publisher_box_id: string;
  title: string;
  description: string | null;
  discipline: string | null;
  level: string | null;
  days_per_week: number | null;
  weeks_count: number;
  billing: 'free' | 'one_time' | 'monthly';
  price_cents: number;
  currency: string;
  is_published: boolean;
  publisher_name?: string;
  goal: string | null;
  target_audience: string | null;
  equipment: string | null;
  /** Enrichissement `list_programming_catalog` (catalogue seulement). */
  wods_total?: number;
  wods_per_week?: number[];
  preview_week1?: { day: number; titles: string[] }[];
}

interface CatalogRow {
  programming_id: string; title: string; description: string | null; discipline: string | null; level: string | null;
  days_per_week: number | null; weeks_count: number; billing: Programming['billing']; price_cents: number; currency: string;
  publisher_box_id: string; publisher_box_name: string | null; goal: string | null; target_audience: string | null;
  equipment: string | null; wods_total: number; wods_per_week: number[] | null;
  preview_week1: { day: number; titles: string[] }[] | null; subscribed: boolean;
}

interface ProgWod {
  id: string;
  programming_id: string;
  week_number: number;
  day_of_week: number;
  title: string;
  description: string | null;
  wod_type: string | null;
  time_cap_seconds: number | null;
  rounds: number | null;
  notes: string | null;
  block_name: string | null;
  video_url: string | null;
  leaderboard_enabled: boolean;
  emom_interval_minutes: number | null;
  tabata_work_seconds: number | null;
  tabata_rest_seconds: number | null;
  sort_order: number;
}

interface Subscription {
  id: string;
  programming_id: string;
  subscriber_box_id: string;
  status: string;
  auto_apply_weekly: boolean;
  current_period_end: string | null;
  color: string | null;
  week_anchor: string | null;
  stripe_subscription_id?: string | null;
  cancel_requested_at?: string | null;
  remove_future_on_cancel?: boolean;
}

/** Même condition que list_applicable_programmings / apply_program_week côté serveur. */
function isLiveSub(s: Subscription): boolean {
  if (s.status !== 'active') return false;
  return !s.current_period_end || new Date(s.current_period_end).getTime() > Date.now();
}

const EMPTY_OFFER = {
  title: '', description: '', discipline: 'crossfit', level: 'all',
  days_per_week: '5', weeks_count: '4', billing: 'free' as const,
  price: '', goal: '', target_audience: '', equipment: '',
};

export default function ProgrammingPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'catalogue' | 'mine'>('catalogue');

  const [myBoxes, setMyBoxes] = useState<Box[]>([]);
  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [catalogue, setCatalogue] = useState<Programming[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [myOffers, setMyOffers] = useState<Programming[]>([]);

  // filters
  const [q, setQ] = useState('');
  const [fDiscipline, setFDiscipline] = useState('');
  const [fLevel, setFLevel] = useState('');
  const [fFree, setFFree] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    // Les box administrées viennent de `get_my_admin_boxes()` — la source que
    // la barre latérale et le résolveur serveur utilisent déjà. L'inventaire
    // refait ici sur `owner_id` + `box_members.role = 'owner'` divergeait, et
    // son échec se lisait « Aucune box active » sur une box qui existe.
    let boxes: Box[];
    try {
      boxes = (await getMyAdminBoxes(supabase)).map((b) => ({ id: b.id, name: b.name }));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Lecture des box impossible');
      setLoading(false);
      return;
    }
    setMyBoxes(boxes);
    const cookieBox = readCookie(ACTIVE_BOX_COOKIE);
    const active = (cookieBox && boxes.find((b) => b.id === cookieBox)?.id) || boxes[0]?.id || null;
    setActiveBoxId(active);
    const myBoxIds = boxes.map((b) => b.id);

    // Catalogue : offres publiées par d'autres box, enrichies côté serveur
    // (compte de WOD par semaine, aperçu de la semaine 1, objectif, public, matériel).
    if (active) {
      const { data: cat, error: catError } = await supabase.rpc('list_programming_catalog', { p_box_id: active });
      if (catError) setLoadError(catError.message);
      setCatalogue(((cat ?? []) as CatalogRow[]).map((r) => ({
        id: r.programming_id, publisher_box_id: r.publisher_box_id, title: r.title, description: r.description,
        discipline: r.discipline, level: r.level, days_per_week: r.days_per_week, weeks_count: r.weeks_count,
        billing: r.billing, price_cents: r.price_cents, currency: r.currency, is_published: true,
        publisher_name: r.publisher_box_name ?? 'Box', goal: r.goal, target_audience: r.target_audience,
        equipment: r.equipment, wods_total: r.wods_total, wods_per_week: r.wods_per_week ?? [],
        preview_week1: r.preview_week1 ?? [],
      })));
    } else {
      setCatalogue([]);
    }

    // My subscriptions (across my boxes) + my own offers.
    if (myBoxIds.length) {
      const { data: mySubs } = await supabase
        .from('box_programming_subscriptions')
        .select('*').in('subscriber_box_id', myBoxIds);
      setSubs((mySubs ?? []) as Subscription[]);

      const { data: offers, error: offersError } = await supabase
        .from('box_programming')
        // Les semaines types sont des programmations internes : elles vivent sur
        // le Whiteboard, pas dans les offres vendables de la box.
        .select('*').in('publisher_box_id', myBoxIds)
        .eq('is_template', false)
        .order('created_at', { ascending: false });
      if (offersError) setLoadError(offersError.message);
      setMyOffers((offers ?? []) as Programming[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const myBoxIds = new Set(myBoxes.map((b) => b.id));

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-white/40" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-1">
        <Store className="text-white" size={26} />
        <h1 className="text-2xl font-black text-white">Marketplace</h1>
      </div>
      <p className="text-sm text-gray-400 mb-6">
        Achète ou vends des programmations entre box. Ce que tu reçois arrive dans ton Whiteboard ; réservé au gérant et aux coachs.
      </p>

      {loadError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-6">
          <p className="text-sm text-red-300">
            Lecture incomplète : {loadError}. Les listes ci-dessous peuvent être vides pour cette raison,
            pas parce qu&apos;il n&apos;y a rien.
          </p>
        </div>
      )}

      <div className="flex gap-1 mb-6 border-b border-white/10">
        {([['catalogue', 'Catalogue'], ['mine', 'Mes offres']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${
              tab === k ? 'border-white text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'catalogue' ? (
        <Catalogue
          catalogue={catalogue} subs={subs} myBoxes={myBoxes} myBoxIds={myBoxIds}
          q={q} setQ={setQ} fDiscipline={fDiscipline} setFDiscipline={setFDiscipline}
          fLevel={fLevel} setFLevel={setFLevel} fFree={fFree} setFFree={setFFree}
          onChanged={load}
        />
      ) : (
        <MyOffers offers={myOffers} activeBoxId={activeBoxId} onChanged={load} />
      )}
    </div>
  );
}

/* ─────────────────────────── Catalogue ─────────────────────────── */
function Catalogue({
  catalogue, subs, myBoxes, myBoxIds, q, setQ, fDiscipline, setFDiscipline,
  fLevel, setFLevel, fFree, setFFree, onChanged,
}: {
  catalogue: Programming[]; subs: Subscription[]; myBoxes: Box[]; myBoxIds: Set<string>;
  q: string; setQ: (v: string) => void; fDiscipline: string; setFDiscipline: (v: string) => void;
  fLevel: string; setFLevel: (v: string) => void; fFree: boolean; setFFree: (v: boolean) => void;
  onChanged: () => void;
}) {
  const [subModal, setSubModal] = useState<Programming | null>(null);
  const [detail, setDetail] = useState<Programming | null>(null);

  const subscribedProgIds = new Set(subs.filter(isLiveSub).map((s) => s.programming_id));

  const visible = catalogue.filter((p) => {
    if (myBoxIds.has(p.publisher_box_id)) return false; // don't subscribe to your own offers
    // Une offre sans WOD n'a rien à vendre : absente du catalogue, sauf si on y
    // est déjà abonné (il faut pouvoir voir pourquoi rien n'arrive).
    if ((p.wods_total ?? 0) === 0 && !subscribedProgIds.has(p.id)) return false;
    if (q && !p.title.toLowerCase().includes(q.toLowerCase())) return false;
    if (fDiscipline && p.discipline !== fDiscipline) return false;
    if (fLevel && p.level !== fLevel) return false;
    if (fFree && p.billing !== 'free') return false;
    return true;
  });

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/30" />
        </div>
        <select value={fDiscipline} onChange={(e) => setFDiscipline(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white">
          <option value="">Toutes disciplines</option>
          {DISCIPLINES.map((d) => <option key={d} value={d}>{disciplineLabel(d)}</option>)}
        </select>
        <select value={fLevel} onChange={(e) => setFLevel(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white">
          <option value="">Tous niveaux</option>
          {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
        </select>
        <button onClick={() => setFFree(!fFree)}
          className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
            fFree ? 'bg-white text-black border-white' : 'bg-white/5 text-gray-300 border-white/10'}`}>
          Gratuit
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-16 text-gray-500 text-sm">Aucune programmation disponible pour ces filtres.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((p) => {
            const subscribed = subscribedProgIds.has(p.id);
            const liveSubs = subs.filter((s) => s.programming_id === p.id && isLiveSub(s));
            const perWeek = p.wods_per_week ?? [];
            const filled = perWeek.filter((n) => n > 0).length;
            const cardColor = subscribed ? subscriptionColorHex(liveSubs[0]?.color) : null;
            return (
              <div
                key={p.id}
                className={`rounded-2xl bg-white/[0.03] border p-5 flex flex-col ${cardColor ? 'border-2' : 'border-white/10'}`}
                style={cardColor ? { borderColor: cardColor } : undefined}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <button onClick={() => setDetail(p)} className="text-left font-bold text-white text-base leading-tight hover:underline">{p.title}</button>
                  {p.billing === 'free'
                    ? <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Gratuit</span>
                    : <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-white/10 text-white">{(p.price_cents / 100).toFixed(0)}€{p.billing === 'monthly' ? '/mois' : ''}</span>}
                </div>
                <p className="text-xs text-gray-500 mb-1">par {p.publisher_name}</p>
                {p.goal
                  ? <p className="text-sm text-gray-300 mb-1 line-clamp-1" title={p.goal}>Objectif : {p.goal}</p>
                  : p.description && <p className="text-sm text-gray-400 mb-1 line-clamp-2">{p.description}</p>}
                <p className="text-xs text-gray-500 mb-3">
                  {(p.wods_total ?? 0) === 0
                    ? <span className="text-amber-400 flex items-center gap-1"><AlertTriangle size={11} /> Aucun WOD pour l&apos;instant</span>
                    : `${p.wods_total} WOD · ${filled}/${p.weeks_count} semaine${p.weeks_count > 1 ? 's' : ''} remplie${filled > 1 ? 's' : ''}`}
                </p>
                <div className="flex flex-wrap gap-1.5 mb-4 mt-auto">
                  {p.discipline && <Tag>{disciplineLabel(p.discipline)}</Tag>}
                  {p.level && <Tag>{LEVEL_LABEL[p.level] ?? p.level}</Tag>}
                  {p.days_per_week && <Tag>{p.days_per_week} j/sem</Tag>}
                  <Tag>{p.weeks_count} sem</Tag>
                </div>
                <button onClick={() => setDetail(p)} className="mb-2 text-xs font-semibold text-gray-400 hover:text-white flex items-center gap-1">
                  <Info size={12} /> Voir le détail
                </button>
                {subscribed ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm font-bold">
                      <Check size={15} /> Abonné
                    </div>
                    <SubscriptionOptions subscriptions={liveSubs} onChanged={onChanged} />
                  </div>
                ) : (
                  <button onClick={() => setSubModal(p)}
                    className="py-2 rounded-lg bg-white text-black text-sm font-bold hover:bg-gray-200 transition-colors">
                    S&apos;abonner
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {detail && (
        <OfferDetailPanel
          programming={detail}
          subscribed={subscribedProgIds.has(detail.id)}
          onClose={() => setDetail(null)}
          onSubscribe={() => { setSubModal(detail); setDetail(null); }}
        />
      )}

      {subModal && (
        <SubscribeModal
          programming={subModal} myBoxes={myBoxes} subs={subs}
          onClose={() => setSubModal(null)} onDone={() => { setSubModal(null); onChanged(); }}
        />
      )}
    </div>
  );
}

/* ────────────────────── Fiche détaillée d'une offre ────────────────────── */
function OfferDetailPanel({ programming: p, subscribed, onClose, onSubscribe }: {
  programming: Programming; subscribed: boolean; onClose: () => void; onSubscribe: () => void;
}) {
  const perWeek = p.wods_per_week ?? [];
  const preview = p.preview_week1 ?? [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#111] border border-white/10 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <h3 className="text-lg font-black text-white">{p.title}</h3>
            <p className="text-xs text-gray-500">par {p.publisher_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="flex flex-wrap gap-1.5 my-3">
          {p.discipline && <Tag>{disciplineLabel(p.discipline)}</Tag>}
          {p.level && <Tag>{LEVEL_LABEL[p.level] ?? p.level}</Tag>}
          {p.days_per_week && <Tag>{p.days_per_week} j/sem</Tag>}
          <Tag>{p.weeks_count} sem</Tag>
          <Tag>{p.billing === 'free' ? 'Gratuit' : `${(p.price_cents / 100).toFixed(0)}€${p.billing === 'monthly' ? '/mois' : ''}`}</Tag>
          <Tag>{p.wods_total ?? 0} WOD</Tag>
        </div>

        {p.description && <p className="text-sm text-gray-300 whitespace-pre-line mb-4">{p.description}</p>}

        <dl className="grid sm:grid-cols-3 gap-3 mb-4">
          {([['Objectif', p.goal], ['Public visé', p.target_audience], ['Matériel', p.equipment]] as const).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-white/[0.03] border border-white/10 p-3">
              <dt className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">{k}</dt>
              <dd className="text-sm text-gray-200">{v || <span className="text-gray-600">Non renseigné</span>}</dd>
            </div>
          ))}
        </dl>

        <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1.5">WOD par semaine</p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {perWeek.map((n, i) => (
            <span key={i} className={`px-2 py-1 rounded-lg text-xs font-bold border ${n > 0 ? 'bg-white/5 text-white border-white/10' : 'bg-amber-500/5 text-amber-400 border-amber-500/20'}`}>
              S{i + 1} : {n > 0 ? `${n} WOD` : 'vide'}
            </span>
          ))}
        </div>

        <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1.5">Aperçu de la semaine 1</p>
        {preview.length === 0 ? (
          <p className="text-xs text-gray-500 mb-4">La semaine 1 est vide.</p>
        ) : (
          <div className="space-y-1.5 mb-4">
            {preview.map((d) => (
              <div key={d.day} className="flex gap-3 text-sm">
                <span className="w-20 shrink-0 text-[11px] font-black uppercase text-gray-400 pt-0.5">{DAY_LABELS[d.day - 1] ?? `J${d.day}`}</span>
                <ul className="text-gray-200">
                  {d.titles.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-gray-500 mb-4">
          Avec l&apos;application automatique, la semaine 1 se pose dans ton Whiteboard le dimanche suivant à 18h ; tu peux aussi la poser tout de suite depuis le Whiteboard (« Programmation »). Le contenu reçu n&apos;est pas modifiable, mais tu choisis qui le voit.
        </p>

        {subscribed ? (
          <div className="flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm font-bold"><Check size={15} /> Abonné</div>
        ) : (
          <button onClick={onSubscribe} className="w-full py-2.5 rounded-lg bg-white text-black text-sm font-bold hover:bg-gray-200">S&apos;abonner</button>
        )}
      </div>
    </div>
  );
}

/**
 * Options de la souscription : couleur (contour des cartes reçues dans le
 * Whiteboard) et application automatique de la semaine due par le cron du
 * dimanche 18h. Celle-ci reste désactivée par défaut — sinon le contenu se pose
 * seul sur le calendrier d'un gérant qui vient d'appliquer une autre semaine.
 */
function SubscriptionOptions({
  subscriptions, onChanged,
}: {
  subscriptions: Subscription[]; onChanged: () => void;
}) {
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (subscriptions.length === 0) return null;
  const on = subscriptions.every((s) => s.auto_apply_weekly);
  const color = subscriptions[0].color ?? 'sky';

  async function toggle() {
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from('box_programming_subscriptions')
      .update({ auto_apply_weekly: !on })
      .in('id', subscriptions.map((s) => s.id));
    setSaving(false);
    if (err) { setError(err.message); return; }
    onChanged();
  }

  async function setColor(c: string) {
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from('box_programming_subscriptions')
      .update({ color: c })
      .in('id', subscriptions.map((s) => s.id));
    setSaving(false);
    if (err) { setError(err.message); return; }
    onChanged();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Couleur de l'abonnement">
        <span className="text-[10px] font-semibold text-gray-500 mr-1">Couleur</span>
        {SUBSCRIPTION_COLORS.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={c === color} disabled={saving}
            onClick={() => setColor(c)} title={c}
            className={`w-4 h-4 rounded-full border-2 transition-transform ${c === color ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'}`}
            style={{ backgroundColor: SUBSCRIPTION_COLOR_HEX[c] }} />
        ))}
      </div>
      <button onClick={toggle} disabled={saving}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold border transition-colors ${
          on ? 'bg-white/10 text-white border-white/20' : 'bg-white/[0.02] text-gray-400 border-white/10 hover:text-white'}`}>
        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-white border-white' : 'border-white/30'}`}>
          {on && <Check size={10} className="text-black" />}
        </span>
        <span className="text-left leading-tight">
          Application automatique chaque semaine
          <span className="block text-[10px] font-semibold text-gray-500 normal-case">
            {on ? 'La semaine due se pose seule le dimanche 18h (semaine 1 le premier dimanche).' : 'Tu poses les semaines depuis le Whiteboard, « Programmation ».'}
          </span>
        </span>
      </button>
      {error && <p className="text-[10px] text-red-400 mt-1">{error}</p>}
      <UnsubscribeLink subscriptions={subscriptions} onChanged={onChanged} />
    </div>
  );
}

/**
 * « Se désabonner » avec confirmation. Gratuit / paiement unique : immédiat.
 * Abonnement Stripe : résiliation à fin de période, le webhook conclut. La
 * case « retirer les séances futures » ne touche jamais la semaine en cours ni
 * le passé (scores et ELO) — c'est la RPC `unsubscribe_programming` qui borne.
 */
function UnsubscribeLink({
  subscriptions, onChanged,
}: {
  subscriptions: Subscription[]; onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [removeFuture, setRemoveFuture] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = subscriptions.filter((s) => s.cancel_requested_at);
  if (pending.length === subscriptions.length) {
    const end = pending[0]?.current_period_end;
    return (
      <p className="text-[10px] text-amber-400 text-center">
        Résiliation demandée{end ? ` — effective le ${new Date(end).toLocaleDateString('fr-FR')}` : ' — effective à la fin de la période'}
      </p>
    );
  }

  async function confirm() {
    setSaving(true);
    setError(null);
    for (const s of subscriptions) {
      const res = await fetch('/api/cancel-programming-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_id: s.id, remove_future: removeFuture }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaving(false);
        setError(json.error ?? 'Désabonnement impossible');
        return;
      }
    }
    setSaving(false);
    setOpen(false);
    onChanged();
  }

  const paid = subscriptions.some((s) => s.stripe_subscription_id);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="w-full text-[11px] text-gray-500 hover:text-red-400 underline underline-offset-2 text-center">
        Se désabonner
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => !saving && setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-[#111] border border-white/10 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-white mb-2">Se désabonner de cette programmation ?</h3>
            <p className="text-sm text-gray-400 mb-4">
              {paid
                ? 'L\u2019abonnement Stripe sera résilié à la fin de la période en cours ; jusque-là les semaines continuent de se poser.'
                : 'Plus aucune semaine ne se posera dans ton Whiteboard. Tu pourras te réabonner plus tard, ta couleur sera conservée.'}
            </p>
            <label className="flex items-start gap-2 text-sm text-gray-200 cursor-pointer mb-2">
              <input type="checkbox" checked={removeFuture} onChange={(e) => setRemoveFuture(e.target.checked)} className="mt-0.5" />
              <span>Retirer aussi les séances déjà posées dans mon Whiteboard à partir de la semaine prochaine</span>
            </label>
            <p className="text-[11px] text-gray-500 mb-5">
              Les semaines passées et la semaine en cours ne sont jamais supprimées : les scores et l&apos;ELO enregistrés sont conservés.
            </p>
            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" disabled={saving} onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-300 hover:text-white">Annuler</button>
              <button type="button" disabled={saving} onClick={confirm}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-bold hover:bg-red-400 disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />} Se désabonner
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white/5 text-gray-300 border border-white/10">{children}</span>;
}

/* ────────────────── Subscribe modal (multi-box opt-out) ────────────────── */
function SubscribeModal({
  programming, myBoxes, subs, onClose, onDone,
}: {
  programming: Programming; myBoxes: Box[]; subs: Subscription[];
  onClose: () => void; onDone: () => void;
}) {
  const supabase = createClient();
  const alreadyIds = new Set(subs.filter((s) => s.programming_id === programming.id && isLiveSub(s)).map((s) => s.subscriber_box_id));
  // Opt-out default: all boxes selected (except those already subscribed).
  const [selected, setSelected] = useState<Set<string>>(
    new Set(myBoxes.filter((b) => !alreadyIds.has(b.id)).map((b) => b.id)),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function confirm() {
    setError(null);
    const targets = [...selected].filter((id) => !alreadyIds.has(id));
    if (targets.length === 0) { onClose(); return; }
    setSaving(true);
    // Offre payante : checkout Stripe Connect, une box à la fois (le paiement
    // redirige le navigateur, on ne peut pas enchaîner plusieurs box).
    if (programming.billing !== 'free') {
      if (targets.length !== 1) {
        setError('Les offres payantes s\u2019activent une box à la fois. Sélectionne une seule box.');
        setSaving(false);
        return;
      }
      try {
        const res = await fetch('/api/create-programming-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ programming_id: programming.id, subscriber_box_id: targets[0] }),
        });
        const json = await res.json();
        if (!res.ok || !json.url) {
          setError(json.error ?? 'Impossible de démarrer le paiement.');
          setSaving(false);
          return;
        }
        window.location.href = json.url;
      } catch (e) {
        setError((e as Error).message);
        setSaving(false);
      }
      return;
    }
    // Le gratuit passe par la RPC : elle relit `price_cents = 0 AND billing =
    // 'free'` dans l'offre. Un `insert` direct de `status='active'` est refusé
    // par le serveur — c'est ce qui servait la marchandise payante sans payer.
    for (const boxId of targets) {
      const { error: err } = await supabase.rpc('subscribe_free_programming', {
        p_programming_id: programming.id,
        p_subscriber_box_id: boxId,
      });
      if (err) { setSaving(false); setError(err.message); return; }
    }
    setSaving(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-[#111] border border-white/10 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-black text-white">S&apos;abonner</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>
        <p className="text-sm text-gray-400 mb-4">{programming.title}</p>
        {programming.billing !== 'free' && (
          <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-3">
            Offre payante ({(programming.price_cents / 100).toFixed(0)}€{programming.billing === 'monthly' ? '/mois' : ''}) — paiement sécurisé Stripe, une box à la fois.
          </p>
        )}
        <p className="text-xs text-gray-500 mb-2">Diffuser à mes boxs (décochez celles à exclure) :</p>
        <div className="space-y-1.5 mb-4 max-h-60 overflow-y-auto">
          {myBoxes.map((b) => {
            const already = alreadyIds.has(b.id);
            const on = selected.has(b.id);
            return (
              <button key={b.id} disabled={already} onClick={() => toggle(b.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                  already ? 'border-white/5 bg-white/[0.02] opacity-50 cursor-not-allowed'
                    : on ? 'border-white/30 bg-white/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/5'}`}>
                <div className={`w-5 h-5 rounded border flex items-center justify-center ${on || already ? 'bg-white border-white' : 'border-white/30'}`}>
                  {(on || already) && <Check size={12} color="#000" strokeWidth={3} />}
                </div>
                <span className="text-sm font-semibold text-white flex-1">{b.name}</span>
                {already && <span className="text-[10px] text-emerald-400 font-bold">déjà abonnée</span>}
              </button>
            );
          })}
        </div>
        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
        <button onClick={confirm} disabled={saving}
          className="w-full py-2.5 rounded-lg bg-white text-black text-sm font-bold hover:bg-gray-200 disabled:opacity-60 flex items-center justify-center gap-2">
          {saving && <Loader2 size={15} className="animate-spin" />}
          Confirmer l&apos;abonnement
        </button>
        <p className="text-[11px] text-gray-500 mt-3 text-center">
          Rien ne se pose tout seul tant que l&apos;application automatique n&apos;est pas cochée. Cochée, la semaine 1 arrive dans le Whiteboard le dimanche suivant à 18h ; sinon tu la poses quand tu veux depuis le Whiteboard (« Programmation »), en choisissant qui la voit.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────── Mes offres ─────────────────────────── */
function MyOffers({ offers, activeBoxId, onChanged }: {
  offers: Programming[]; activeBoxId: string | null; onChanged: () => void;
}) {
  const supabase = createClient();
  const [editing, setEditing] = useState<Programming | 'new' | null>(null);
  const [publishError, setPublishError] = useState<{ id: string; message: string } | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);

  // La publication passe par `publish_programming` : le serveur refuse une
  // offre sans description, objectif, public visé, ou avec une semaine vide.
  // Son message est affiché tel quel — c'est lui qui dit ce qui manque.
  async function togglePublish(o: Programming) {
    setPublishing(o.id);
    setPublishError(null);
    const { error } = await supabase.rpc('publish_programming', { p_id: o.id, p_publish: !o.is_published });
    setPublishing(null);
    if (error) { setPublishError({ id: o.id, message: error.message }); return; }
    onChanged();
  }
  async function remove(o: Programming) {
    if (!confirm(`Supprimer « ${o.title} » ? Les boxs abonnées ne recevront plus de nouvelles semaines.`)) return;
    await supabase.from('box_programming').delete().eq('id', o.id);
    onChanged();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <p className="text-sm text-gray-400">Vos programmations publiées pour d&apos;autres boxs.</p>
        {/* Sans box active, la création échouerait à l'enregistrement : le bouton
            le dit avant, il ne le découvre pas après un formulaire rempli. */}
        <button onClick={() => setEditing('new')} disabled={!activeBoxId}
          title={activeBoxId ? undefined : 'Aucune box active : recharge la page ou reconnecte-toi'}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white text-black text-sm font-bold hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed">
          <Plus size={15} /> Nouvelle programmation
        </button>
      </div>

      {offers.length === 0 ? (
        <div className="text-center py-16 text-gray-500 text-sm">
          <Package size={32} className="mx-auto mb-3 opacity-40" />
          Vous n&apos;avez pas encore publié de programmation.
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map((o) => (
            <div key={o.id} className="rounded-2xl bg-white/[0.03] border border-white/10 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-white">{o.title}</h3>
                    {o.is_published
                      ? <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 flex items-center gap-1"><Globe size={10} /> Publiée</span>
                      : <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-white/10 text-gray-400 flex items-center gap-1"><Lock size={10} /> Brouillon</span>}
                  </div>
                  <p className="text-xs text-gray-500">
                    {o.discipline ? disciplineLabel(o.discipline) : ''} · {LEVEL_LABEL[o.level ?? 'all']} · {o.weeks_count} sem · {o.billing === 'free' ? 'Gratuit' : `${(o.price_cents / 100).toFixed(0)}€${o.billing === 'monthly' ? '/mois' : ''}`}
                  </p>
                  {publishError?.id === o.id && (
                    <div className="mt-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                      <p className="font-semibold">Publication refusée : {publishError.message}</p>
                      <p className="text-amber-300/70 mt-1">Remplis les semaines vides depuis le Whiteboard (« Copier vers une offre » ou la case « Mes offres Marketplace » du formulaire WOD), ou ici via le crayon.</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => togglePublish(o)} disabled={publishing === o.id} title={o.is_published ? 'Dépublier' : 'Publier'}
                    className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-gray-300 hover:text-white disabled:opacity-50">
                    {publishing === o.id ? <Loader2 size={12} className="animate-spin" /> : o.is_published ? 'Dépublier' : 'Publier'}
                  </button>
                  <button onClick={() => setEditing(o)} className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white"><Pencil size={14} /></button>
                  <button onClick={() => remove(o)} className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-red-400"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <OfferEditor
          offer={editing === 'new' ? null : editing}
          publisherBoxId={activeBoxId}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged(); }}
        />
      )}
    </div>
  );
}

/* ────────────────── Offer editor (offer + weekly WODs) ────────────────── */
function OfferEditor({ offer, publisherBoxId, onClose, onSaved }: {
  offer: Programming | null; publisherBoxId: string | null;
  onClose: () => void; onSaved: () => void;
}) {
  const supabase = createClient();
  const [form, setForm] = useState(offer ? {
    title: offer.title, description: offer.description ?? '', discipline: offer.discipline ?? 'crossfit',
    level: offer.level ?? 'all', days_per_week: String(offer.days_per_week ?? 5),
    weeks_count: String(offer.weeks_count), billing: offer.billing, price: offer.price_cents ? String(offer.price_cents / 100) : '',
    goal: offer.goal ?? '', target_audience: offer.target_audience ?? '', equipment: offer.equipment ?? '',
  } : { ...EMPTY_OFFER });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offerId, setOfferId] = useState<string | null>(offer?.id ?? null);
  const [wods, setWods] = useState<ProgWod[]>([]);
  const [week, setWeek] = useState(1);
  const [wodsLoaded, setWodsLoaded] = useState(false);
  const [wodModal, setWodModal] = useState(false);
  const [editWod, setEditWod] = useState<ProgWod | null>(null);
  const [wodForm, setWodForm] = useState<WodFormState>(EMPTY_WOD_FORM);
  const [movements, setMovements] = useState<string[]>([]);
  const [wodSaving, setWodSaving] = useState(false);
  const [wodError, setWodError] = useState<string | null>(null);
  const [importModal, setImportModal] = useState(false);
  const [importDone, setImportDone] = useState<number | null>(null);

  const loadWods = useCallback(async (id: string) => {
    const { data } = await supabase.from('box_programming_wods').select('*').eq('programming_id', id).order('sort_order');
    setWods((data ?? []) as ProgWod[]);
    setWodsLoaded(true);
  }, [supabase]);

  useEffect(() => { if (offerId) loadWods(offerId); else setWodsLoaded(true); }, [offerId, loadWods]);

  async function saveOffer() {
    if (!form.title.trim()) { setError('Titre requis'); return; }
    if (!publisherBoxId) { setError('Aucune box active'); return; }
    setError(null); setSaving(true);
    const payload = {
      publisher_box_id: publisherBoxId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      discipline: form.discipline,
      level: form.level,
      days_per_week: form.days_per_week ? Number(form.days_per_week) : null,
      weeks_count: Number(form.weeks_count) || 1,
      billing: form.billing,
      price_cents: form.billing === 'free' ? 0 : Math.round(Number(form.price || 0) * 100),
      goal: form.goal.trim() || null,
      target_audience: form.target_audience.trim() || null,
      equipment: form.equipment.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (offerId) {
      const { error: err } = await supabase.from('box_programming').update(payload).eq('id', offerId);
      setSaving(false);
      if (err) { setError(err.message); return; }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error: err } = await supabase.from('box_programming')
        .insert({ ...payload, created_by: user?.id ?? null }).select('id').single();
      setSaving(false);
      if (err) { setError(err.message); return; }
      setOfferId((data as { id: string }).id);
    }
  }

  // Éditeur de WOD partagé avec le Whiteboard, en contexte « programmation » :
  // semaine × jour au lieu d'une date, et aucun accès à décider ici — la box
  // abonnée choisira ses groupes en appliquant la semaine sur son calendrier.
  function openCreateWod(dow: number) {
    setEditWod(null);
    setWodForm({ ...EMPTY_WOD_FORM, week, dayOfWeek: dow });
    setMovements([]);
    setWodError(null);
    setWodModal(true);
  }

  function openEditWod(w: ProgWod) {
    setEditWod(w);
    setWodForm({
      ...EMPTY_WOD_FORM,
      title: w.title,
      description: w.description ?? '',
      wod_type: w.wod_type ?? '',
      block: w.block_name ?? '',
      timeCap: formatCap(w.time_cap_seconds),
      rounds: w.rounds ? String(w.rounds) : '',
      notes: w.notes ?? '',
      videoUrl: w.video_url ?? '',
      leaderboard: w.leaderboard_enabled ?? true,
      emomInterval: w.emom_interval_minutes ? String(w.emom_interval_minutes) : '1',
      tabataWork: w.tabata_work_seconds ? String(w.tabata_work_seconds) : '20',
      tabataRest: w.tabata_rest_seconds != null ? String(w.tabata_rest_seconds) : '10',
      week: w.week_number,
      dayOfWeek: w.day_of_week,
    });
    setMovements(movementLines(w.description));
    setWodError(null);
    setWodModal(true);
  }

  async function saveWod() {
    if (!offerId || !wodForm.title.trim()) return;
    setWodSaving(true);
    setWodError(null);
    const payload = {
      ...sharedWodColumns(wodForm, movements),
      week_number: wodForm.week,
      day_of_week: wodForm.dayOfWeek,
    };
    if (editWod) {
      const { error: err } = await supabase.from('box_programming_wods').update(payload).eq('id', editWod.id);
      setWodSaving(false);
      if (err) { setWodError(err.message); return; }
      setWods((w) => w.map((x) => (x.id === editWod.id ? { ...x, ...payload } : x)));
    } else {
      const { data, error: err } = await supabase.from('box_programming_wods')
        .insert({ ...payload, programming_id: offerId, sort_order: wods.length })
        .select('*').single();
      setWodSaving(false);
      if (err || !data) { setWodError(err?.message ?? 'Erreur'); return; }
      setWods((w) => [...w, data as ProgWod]);
    }
    setWeek(wodForm.week);
    setWodModal(false);
  }

  async function delWod(id: string) {
    setWods((w) => w.filter((x) => x.id !== id));
    await supabase.from('box_programming_wods').delete().eq('id', id);
  }

  const weeksCount = Number(form.weeks_count) || 1;
  const weekWods = wods.filter((w) => w.week_number === week).sort((a, b) => a.day_of_week - b.day_of_week);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#111] border border-white/10 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-white">{offerId ? 'Modifier la programmation' : 'Nouvelle programmation'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>

        <div className="space-y-3 mb-4">
          <Field label="Titre">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={INPUT_CLS} placeholder="Ex. Programmation Compétiteur — Bloc Force" />
          </Field>
          <Field label="Description">
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2} className={INPUT_CLS} placeholder="Ce que contient cette prog, comment elle est construite…" />
          </Field>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Objectif">
              <input value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })}
                className={INPUT_CLS} placeholder="Ex. Force + capacité aérobie" />
            </Field>
            <Field label="Public visé">
              <input value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
                className={INPUT_CLS} placeholder="Ex. Intermédiaires, 1 an de pratique" />
            </Field>
            <Field label="Matériel">
              <input value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value })}
                className={INPUT_CLS} placeholder="Ex. Barre, rameur, box" />
            </Field>
          </div>
          <p className="text-[11px] text-gray-500">Description, objectif et public visé sont exigés à la publication, ainsi qu&apos;au moins un WOD par semaine annoncée.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Discipline">
              <select value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })} className={INPUT_CLS}>
                {DISCIPLINES.map((d) => <option key={d} value={d}>{disciplineLabel(d)}</option>)}
              </select>
            </Field>
            <Field label="Niveau">
              <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className={INPUT_CLS}>
                {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
              </select>
            </Field>
            <Field label="Jours / semaine">
              <input type="number" min={1} max={7} value={form.days_per_week}
                onChange={(e) => setForm({ ...form, days_per_week: e.target.value })} className={INPUT_CLS} />
            </Field>
            <Field label="Nombre de semaines">
              <input type="number" min={1} max={52} value={form.weeks_count}
                onChange={(e) => setForm({ ...form, weeks_count: e.target.value })} className={INPUT_CLS} />
            </Field>
            <Field label="Facturation">
              <select value={form.billing} onChange={(e) => setForm({ ...form, billing: e.target.value as typeof form.billing })} className={INPUT_CLS}>
                <option value="free">Gratuit</option>
                <option value="one_time">Paiement unique</option>
                <option value="monthly">Mensuel</option>
              </select>
            </Field>
            {form.billing !== 'free' && (
              <Field label="Prix (€)">
                <input type="number" min={0} step="0.01" value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })} className={INPUT_CLS} />
              </Field>
            )}
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button onClick={saveOffer} disabled={saving}
            className="w-full py-2.5 rounded-lg bg-white text-black text-sm font-bold hover:bg-gray-200 disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 size={15} className="animate-spin" />}
            {offerId ? 'Enregistrer' : 'Créer et ajouter des WOD'}
          </button>
        </div>

        {offerId && wodsLoaded && (
          <div className="border-t border-white/10 pt-4">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-sm font-bold text-white mr-1">Semaine :</span>
              {Array.from({ length: weeksCount }, (_, i) => i + 1).map((w) => {
                const n = wods.filter((x) => x.week_number === w).length;
                return (
                  <button key={w} onClick={() => setWeek(w)} title={n ? `${n} WOD` : 'Semaine vide'}
                    className={`relative w-8 h-8 rounded-lg text-sm font-bold ${week === w ? 'bg-white text-black' : n ? 'bg-white/5 text-gray-400 border border-white/10' : 'bg-amber-500/5 text-amber-400 border border-amber-500/20'}`}>
                    {w}
                    {n > 0 && <span className="absolute -top-1 -right-1 text-[9px] leading-none px-1 py-0.5 rounded-full bg-white/20 text-white">{n}</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-500 mb-3">Tu peux aussi remplir cette offre depuis le Whiteboard : « Copier vers une offre » pour une semaine entière, ou la case « Mes offres Marketplace » dans le formulaire d&apos;un WOD (la copie suit ensuite tes modifications).</p>
            <div className="space-y-2 mb-3">
              {weekWods.length === 0 && <p className="text-xs text-gray-500">Aucun WOD pour la semaine {week}. Ajoutez-en un jour ci-dessous.</p>}
              {weekWods.map((w) => (
                <button key={w.id} onClick={() => openEditWod(w)}
                  className="w-full text-left rounded-xl bg-white/[0.03] border border-white/10 p-3 hover:border-white/25 transition-colors">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-black uppercase px-2 py-0.5 rounded bg-white/10 text-white">{DAY_LABELS[w.day_of_week - 1]}</span>
                    {w.block_name && (
                      <span className="text-[10px] font-black tracking-wider px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: `${BLOCK_COLOR[w.block_name]}20`, color: BLOCK_COLOR[w.block_name] }}>
                        {BLOCK_LABEL[w.block_name]}
                      </span>
                    )}
                    {w.wod_type && (
                      <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: `${TYPE_COLOR[w.wod_type]}20`, color: TYPE_COLOR[w.wod_type] }}>
                        {w.wod_type}
                      </span>
                    )}
                    <span className="flex-1 text-sm font-semibold text-white truncate">{w.title}</span>
                    {w.video_url && <Video size={12} className="text-red-400 shrink-0" />}
                    <Pencil size={13} className="text-gray-500 shrink-0" />
                    <span role="button" tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); delWod(w.id); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); delWod(w.id); } }}
                      className="text-gray-500 hover:text-red-400 shrink-0"><Trash2 size={13} /></span>
                  </div>
                  {w.description && (
                    <p className="text-xs text-gray-400 whitespace-pre-line line-clamp-4">{w.description}</p>
                  )}
                  <p className="text-[11px] text-gray-600 mt-1">
                    {[
                      w.time_cap_seconds ? `Cap ${formatCap(w.time_cap_seconds)}` : null,
                      w.rounds ? `${w.rounds} rounds` : null,
                      w.notes ? 'notes' : null,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
              <span className="text-xs text-gray-500 mr-1">Ajouter :</span>
              {DAY_LABELS.map((d, i) => (
                <button key={d} onClick={() => openCreateWod(i + 1)}
                  className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-gray-300 hover:text-white">{d}</button>
              ))}
            </div>
            <button onClick={() => { setImportDone(null); setImportModal(true); }}
              className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-gray-300 hover:text-white flex items-center gap-1.5">
              <Upload size={12} /> Importer (CSV, JSON, PDF)
            </button>
            {importDone !== null && (
              <p className="text-xs text-emerald-400 mt-2">{importDone} WOD importé{importDone > 1 ? 's' : ''}.</p>
            )}
          </div>
        )}
      </div>

      {/* Le fond du modal d'offre ferme au clic : on isole l'éditeur de WOD. */}
      {wodModal && (
        <div onClick={(e) => e.stopPropagation()}>
        <WodEditor
          mode="programming"
          heading={editWod ? 'Modifier le WOD' : 'Nouveau WOD de programmation'}
          submitLabel={editWod ? 'Enregistrer' : 'Ajouter le WOD'}
          form={wodForm}
          setForm={setWodForm}
          movements={movements}
          setMovements={setMovements}
          saving={wodSaving}
          error={wodError}
          onClose={() => setWodModal(false)}
          onSubmit={saveWod}
          weeksCount={weeksCount}
        />
        </div>
      )}

      {importModal && offerId && publisherBoxId && (
        <div onClick={(e) => e.stopPropagation()}>
          <ProgWodImportModal
            programmingId={offerId}
            boxId={publisherBoxId}
            weeksCount={weeksCount}
            sortOffset={wods.length}
            onClose={() => setImportModal(false)}
            onImported={(count) => {
              setImportModal(false);
              setImportDone(count);
              void loadWods(offerId);
            }}
          />
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-400 mb-1 block">{label}</span>
      {children}
    </label>
  );
}
