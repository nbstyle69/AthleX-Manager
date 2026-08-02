-- Impayés (dunning) des abonnements de salle + moyen de paiement retenu.
-- Colonnes utilisées par app/api/stripe-connect-webhook, app/api/dunning,
-- components/UnpaidPanel et l'écran Réglages (délai de grâce par box).

alter table public.box_members
  add column if not exists payment_method_type text,
  add column if not exists past_due_since timestamptz,
  add column if not exists dunning_attempts integer not null default 0,
  add column if not exists last_payment_error text,
  add column if not exists dunning_reminders_sent integer not null default 0,
  add column if not exists dunning_last_reminder_at timestamptz;

create index if not exists box_members_past_due_since_idx
  on public.box_members (box_id, past_due_since)
  where past_due_since is not null;

alter table public.boxes
  add column if not exists dunning_grace_days integer not null default 7;

-- Liste des abonnements impayés d'une box, consommée par components/UnpaidPanel.
-- Même garde d'accès que get_box_billing : owner / owner-membre / super-admin.
create or replace function public.get_box_dunning(p_box_id uuid)
returns table (
  id uuid,
  username text,
  email text,
  plan_name text,
  amount_cents integer,
  payment_method_type text,
  past_due_since timestamptz,
  dunning_attempts integer,
  dunning_reminders_sent integer,
  dunning_last_reminder_at timestamptz,
  last_payment_error text,
  has_stripe_sub boolean,
  suspended boolean,
  grace_days integer
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select
    bm.id,
    p.username,
    p.email,
    mp.name,
    bm.amount_cents,
    bm.payment_method_type,
    bm.past_due_since,
    bm.dunning_attempts,
    bm.dunning_reminders_sent,
    bm.dunning_last_reminder_at,
    bm.last_payment_error,
    (bm.stripe_subscription_id is not null),
    -- Accès suspendu dès que l'impayé dépasse le délai de grâce de la box.
    (bm.past_due_since is not null
      and now() >= bm.past_due_since + make_interval(days => coalesce(b.dunning_grace_days, 7))),
    b.dunning_grace_days
  from public.box_members bm
  join public.boxes b on b.id = bm.box_id
  left join public.profiles p on p.id = bm.member_id
  left join public.membership_plans mp on mp.id = bm.plan_id
  where bm.box_id = p_box_id
    and bm.subscription_status = 'past_due'
    and (
      public.is_box_owner(p_box_id)
      or public.is_box_owner_member(p_box_id)
      or public.is_super_admin()
    )
  order by bm.past_due_since asc nulls last;
$$;

grant execute on function public.get_box_dunning(uuid) to authenticated;
