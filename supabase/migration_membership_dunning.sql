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
