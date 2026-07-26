-- ============================================================
-- Contrats d'abonnement de salle — engagement, gel, résiliation sur justificatif
-- Base partagée : Battlewod (app) + TheHub (web back-office).
-- Idempotent (ré-exécutable sans casse).
-- ============================================================

-- ── 0. Helper strict box-staff (owner primaire OU owner/coach actif). ──
-- Volontairement plus strict que is_box_admin (qui reconnaît globalement
-- profiles.role = 'box_owner') pour ne jamais laisser un owner agir sur
-- une box qui n'est pas la sienne.
CREATE OR REPLACE FUNCTION public.is_box_staff(p_box_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.boxes
      WHERE id = p_box_id AND owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.box_members
      WHERE box_id = p_box_id
        AND member_id = auth.uid()
        AND role IN ('owner', 'coach')
        AND COALESCE(status, 'active') = 'active'
    );
$$;
GRANT EXECUTE ON FUNCTION public.is_box_staff(uuid) TO authenticated, service_role;

-- ── 1. Engagement + mentions contractuelles sur les formules ──
ALTER TABLE public.membership_plans
  ADD COLUMN IF NOT EXISTS commitment_months int NOT NULL DEFAULT 0,  -- 0 = sans engagement
  ADD COLUMN IF NOT EXISTS terms             text;                    -- conditions / mentions libres

DO $$ BEGIN
  ALTER TABLE public.membership_plans
    ADD CONSTRAINT membership_plans_commitment_months_nonneg
    CHECK (commitment_months >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.membership_plans.commitment_months IS
  'Durée d''engagement minimale en mois (0 = sans engagement).';
COMMENT ON COLUMN public.membership_plans.terms IS
  'Conditions / mentions contractuelles affichées à la souscription.';

-- ── 2. Suivi de l'engagement + gel au niveau du membre ──
ALTER TABLE public.box_members
  ADD COLUMN IF NOT EXISTS commitment_end_date timestamptz,           -- fin d'engagement (figée à la souscription)
  ADD COLUMN IF NOT EXISTS subscription_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pause_started_at    timestamptz,
  ADD COLUMN IF NOT EXISTS pause_resumes_at    timestamptz;           -- NULL = pause indéfinie

-- ── 3. Demandes de résiliation anticipée (motif légitime + justificatif) ──
CREATE TABLE IF NOT EXISTS public.membership_cancellation_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id        uuid NOT NULL REFERENCES public.boxes(id) ON DELETE CASCADE,
  member_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason_type   text NOT NULL DEFAULT 'other'
                  CHECK (reason_type IN ('moving', 'medical', 'other')),
  message       text,
  document_path text,                                                 -- objet Storage privé (justificatif)
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note   text,
  reviewed_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cancel_req_box    ON public.membership_cancellation_requests(box_id);
CREATE INDEX IF NOT EXISTS idx_cancel_req_member ON public.membership_cancellation_requests(member_id);
-- Une seule demande en attente par membre/box à la fois.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_cancel_req_pending
  ON public.membership_cancellation_requests(box_id, member_id)
  WHERE status = 'pending';

ALTER TABLE public.membership_cancellation_requests ENABLE ROW LEVEL SECURITY;

-- Lecture : l'auteur (membre) OU le staff de la box.
DROP POLICY IF EXISTS cancel_req_read ON public.membership_cancellation_requests;
CREATE POLICY cancel_req_read ON public.membership_cancellation_requests
  FOR SELECT TO authenticated
  USING (member_id = auth.uid() OR public.is_box_staff(box_id));

-- Création : uniquement par le membre lui-même, pour une box dont il est membre.
DROP POLICY IF EXISTS cancel_req_insert ON public.membership_cancellation_requests;
CREATE POLICY cancel_req_insert ON public.membership_cancellation_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id = auth.uid()
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.box_members bm
      WHERE bm.box_id = membership_cancellation_requests.box_id
        AND bm.member_id = auth.uid()
    )
  );

-- Mise à jour (approbation / refus) : staff de la box uniquement.
DROP POLICY IF EXISTS cancel_req_update ON public.membership_cancellation_requests;
CREATE POLICY cancel_req_update ON public.membership_cancellation_requests
  FOR UPDATE TO authenticated
  USING (public.is_box_staff(box_id))
  WITH CHECK (public.is_box_staff(box_id));

NOTIFY pgrst, 'reload schema';
