import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, getServerUser } from '@/lib/supabase/server';
import { CreditCard, Ticket, Dumbbell, CalendarClock, Search } from 'lucide-react';
import AccountProfileForm from './AccountProfileForm';
import ManageSubscription from './ManageSubscription';
import { selectMembership, type MembershipBillingRow } from '@/lib/compte/membership';

export const dynamic = 'force-dynamic';

interface ProfileRow {
  id: string; username: string | null;
  full_name: string | null; bio: string | null; avatar_url: string | null;
}

interface PlanRef { name: string | null; color: string | null; price_cents: number | null }
interface BoxRef { id: string; name: string | null; slug: string | null; terms_pdf_url?: string | null }

interface CreditRow {
  id: string; credits_total: number; credits_used: number;
  expires_at: string; status: string;
  plan: { name: string | null; plan_type: string | null } | { name: string | null; plan_type: string | null }[] | null;
  box: BoxRef | BoxRef[] | null;
}

interface ProgramRow {
  id: string; status: string | null; purchased_at: string | null; amount_cents: number | null;
  program: { title: string | null } | { title: string | null }[] | null;
}

function one<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function fmtPrice(cents: number | null | undefined): string {
  if (!cents) return '—';
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: cents % 100 === 0 ? 0 : 2 });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const SUB_STATUS_LABEL: Record<string, string> = {
  active: 'Actif', trialing: 'Essai', past_due: 'Paiement en retard',
  canceled: 'Résilié', unpaid: 'Impayé', incomplete: 'Incomplet',
};

export default async function AccountPage() {
  const user = await getServerUser();
  if (!user) redirect('/login');

  const supabase = await createClient();

  // Lecture de SON profil par RPC : `full_name` n'est plus lisible en colonne
  // par `authenticated` (Lot 0-bis), et un droit de colonne révoqué fait
  // échouer toute la requête qui le mentionne. L'e-mail du compte connecté
  // vient de la session auth, qui le porte déjà.
  const { data: profileRows } = await supabase.rpc('get_my_profile');
  const profile = ((profileRows ?? []) as ProfileRow[])[0] ?? null;

  // Son propre abonnement : les colonnes nominatives (plan_id, subscription_*,
  // amount_cents) ne sont plus lisibles en direct (Lot 6). La RPC filtre sur
  // auth.uid() côté serveur — l'appelant ne choisit pas de qui il lit.
  const { data: billingRaw } = await supabase.rpc('get_my_membership_billing');
  const { membership: activeSub, stripeBacked, canManage } = selectMembership(
    (billingRaw ?? []) as MembershipBillingRow[],
  );

  // La formule et la box se lisent à la clé de l'adhérent : `member_see_plans`
  // sert aussi une formule désactivée, et les colonnes publiques de `boxes`
  // sont lisibles sans session.
  let subPlan: PlanRef | null = null;
  let subBox: BoxRef | null = null;
  if (activeSub) {
    const [planRes, boxRes] = await Promise.all([
      activeSub.plan_id
        ? supabase.from('membership_plans').select('name, color, price_cents').eq('id', activeSub.plan_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('boxes').select('id, name, slug, terms_pdf_url').eq('id', activeSub.box_id).maybeSingle(),
    ]);
    subPlan = (planRes.data ?? null) as PlanRef | null;
    subBox = (boxRes.data ?? null) as BoxRef | null;
  }

  const { data: creditRaw } = await supabase
    .from('member_class_credits')
    .select('id, credits_total, credits_used, expires_at, status, plan:membership_plans(name, plan_type), box:boxes(id, name, slug)')
    .eq('member_id', user.id)
    .order('created_at', { ascending: false });
  const credits = (creditRaw ?? []) as CreditRow[];

  const { data: programRaw } = await supabase
    .from('program_members')
    .select('id, status, purchased_at, amount_cents, program:programs(title)')
    .eq('user_id', user.id)
    .order('purchased_at', { ascending: false });
  const programs = (programRaw ?? []) as ProgramRow[];

  // Formules d'abonnement disponibles sur la box active (pour changer de formule)
  let boxPlans: { id: string; name: string; price_cents: number }[] = [];
  if (activeSub?.box_id) {
    const { data: plansRaw } = await supabase
      .from('membership_plans')
      .select('id, name, price_cents, plan_type, is_active')
      .eq('box_id', activeSub.box_id)
      .eq('is_active', true)
      .eq('plan_type', 'subscription')
      .gt('price_cents', 0)
      .order('price_cents', { ascending: true });
    boxPlans = ((plansRaw ?? []) as { id: string; name: string; price_cents: number }[]).map(p => ({ id: p.id, name: p.name, price_cents: p.price_cents }));
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Mon compte</h1>
        <p className="text-sm text-gray-400 mt-1">Gère tes informations, ton abonnement et tes crédits de séances.</p>
      </div>

      {/* Infos personnelles */}
      <section className="bg-[#111] border border-white/[0.06] rounded-2xl p-6">
        <h2 className="text-base font-black text-white mb-4">Informations personnelles</h2>
        <AccountProfileForm
          userId={user.id}
          email={user.email ?? ''}
          username={profile?.username ?? ''}
          fullName={profile?.full_name ?? ''}
          bio={profile?.bio ?? ''}
          avatarUrl={profile?.avatar_url ?? ''}
        />
      </section>

      {/* Abonnement */}
      <section className="bg-[#111] border border-white/[0.06] rounded-2xl p-6">
        <h2 className="text-base font-black text-white mb-4 flex items-center gap-2">
          <CreditCard size={18} className="text-emerald-400" /> Abonnement
        </h2>
        {activeSub ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-bold">{subPlan?.name ?? 'Formule'}</p>
                <p className="text-xs text-gray-500">{subBox?.name ?? 'Ma box'}</p>
              </div>
              <div className="text-right">
                <span className={`text-[11px] px-2 py-0.5 rounded-md font-bold ${
                  !stripeBacked ? (activeSub.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400')
                  : ['active', 'trialing'].includes(activeSub.subscription_status ?? '') ? 'bg-emerald-500/10 text-emerald-400'
                  : activeSub.subscription_status === 'past_due' ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-red-500/10 text-red-400'}`}>
                  {stripeBacked
                    ? (SUB_STATUS_LABEL[activeSub.subscription_status ?? ''] ?? activeSub.subscription_status)
                    : (activeSub.status === 'active' ? 'Adhésion active' : 'Adhésion inactive')}
                </span>
                <p className="text-sm font-black text-white mt-1">{fmtPrice(activeSub.amount_cents ?? subPlan?.price_cents)}<span className="text-[10px] text-gray-500"> /mois</span></p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <CalendarClock size={13} />{' '}
              {stripeBacked
                ? <>Prochaine échéance : {fmtDate(activeSub.subscription_current_period_end)}</>
                : <>Sans abonnement en ligne — formule attribuée ou payée à la box{activeSub.joined_at ? ` depuis le ${fmtDate(activeSub.joined_at)}` : ''}</>}
            </div>
            <ManageSubscription
              currentPlanId={activeSub.plan_id}
              plans={boxPlans}
              canManage={canManage}
              boxId={activeSub.box_id}
              commitmentEndDate={activeSub.commitment_end_date}
              paused={!!activeSub.subscription_paused}
              pauseResumesAt={activeSub.pause_resumes_at}
              termsPdfUrl={subBox?.terms_pdf_url ?? null}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Aucun abonnement actif. Trouve ta box pour t'abonner ou prendre une offre.</p>
            <Link
              href="/box"
              className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-[#0A0A0A] text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
            >
              <Search size={15} /> Trouver une box
            </Link>
          </div>
        )}
      </section>

      {/* Crédits : Drop-in & Carnet */}
      <section className="bg-[#111] border border-white/[0.06] rounded-2xl p-6">
        <h2 className="text-base font-black text-white mb-4 flex items-center gap-2">
          <Ticket size={18} className="text-blue-400" /> Drop-in & Carnets
        </h2>
        {credits.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun crédit de séance. Achète un Drop-in ou un carnet sur la page de ta box.</p>
        ) : (
          <div className="grid gap-3">
            {credits.map(c => {
              const plan = one(c.plan);
              const box = one(c.box);
              const remaining = Math.max(0, c.credits_total - c.credits_used);
              const expired = new Date(c.expires_at) < new Date();
              const usable = c.status === 'active' && remaining > 0 && !expired;
              return (
                <div key={c.id} className={`border rounded-xl p-4 ${usable ? 'border-white/[0.08]' : 'border-white/[0.04] opacity-60'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${plan?.plan_type === 'drop_in' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>
                        {plan?.plan_type === 'drop_in' ? 'Drop-in' : 'Carnet'}
                      </span>
                      <span className="text-white font-bold text-sm">{plan?.name ?? 'Crédits'}</span>
                    </div>
                    <span className="text-sm font-black text-white">{remaining}<span className="text-xs text-gray-500">/{c.credits_total}</span></span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{box?.name ?? 'Ma box'}</p>
                  <p className="text-xs mt-1">
                    {expired
                      ? <span className="text-red-400">Expiré le {fmtDate(c.expires_at)}</span>
                      : remaining === 0
                      ? <span className="text-amber-400">Épuisé</span>
                      : <span className="text-gray-500">Valable jusqu'au {fmtDate(c.expires_at)}</span>}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Programmes achetés */}
      <section className="bg-[#111] border border-white/[0.06] rounded-2xl p-6">
        <h2 className="text-base font-black text-white mb-4 flex items-center gap-2">
          <Dumbbell size={18} className="text-white" /> Mes programmes
        </h2>
        {programs.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun programme acheté.</p>
        ) : (
          <div className="grid gap-2">
            {programs.map(pr => {
              const prog = one(pr.program);
              return (
                <div key={pr.id} className="flex items-center justify-between border border-white/[0.06] rounded-xl px-4 py-3">
                  <span className="text-sm text-white font-semibold">{prog?.title ?? 'Programme'}</span>
                  <span className="text-xs text-gray-500">{fmtDate(pr.purchased_at)}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
