-- ============================================================
-- Codes promo par box — réductions saisies au checkout Stripe.
-- Chaque code est miroité en coupon + promotion code sur le compte
-- Connect de la box ; Stripe valide code/expiration/quota nativement.
-- La table locale sert d'index back-office (le staff seul y a accès).
-- Idempotent (ré-exécutable sans casse).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.membership_promo_codes (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id                   uuid NOT NULL REFERENCES public.boxes(id) ON DELETE CASCADE,
  code                     text NOT NULL,                         -- ex. RENTREE25 (stocké en MAJUSCULES)
  discount_type            text NOT NULL DEFAULT 'percent'
                             CHECK (discount_type IN ('percent', 'amount')),
  percent_off              numeric,                               -- si percent : 1..100
  amount_off_cents         int,                                   -- si amount : > 0
  currency                 text NOT NULL DEFAULT 'eur',
  duration                 text NOT NULL DEFAULT 'once'           -- portée sur un abonnement
                             CHECK (duration IN ('once', 'repeating', 'forever')),
  duration_in_months       int,                                   -- si repeating : > 0
  max_redemptions          int,                                   -- NULL = illimité
  expires_at               timestamptz,                           -- NULL = pas d'expiration
  is_active                boolean NOT NULL DEFAULT true,
  stripe_coupon_id         text,
  stripe_promotion_code_id text,
  created_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT promo_percent_valid CHECK (
    discount_type <> 'percent'
    OR (percent_off IS NOT NULL AND percent_off > 0 AND percent_off <= 100)
  ),
  CONSTRAINT promo_amount_valid CHECK (
    discount_type <> 'amount'
    OR (amount_off_cents IS NOT NULL AND amount_off_cents > 0)
  ),
  CONSTRAINT promo_repeating_valid CHECK (
    duration <> 'repeating'
    OR (duration_in_months IS NOT NULL AND duration_in_months > 0)
  ),
  CONSTRAINT promo_max_redemptions_valid CHECK (
    max_redemptions IS NULL OR max_redemptions > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_promo_box ON public.membership_promo_codes(box_id);
-- Un même code ne peut exister qu'une fois par box (insensible à la casse).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_promo_code_per_box
  ON public.membership_promo_codes(box_id, upper(code));

ALTER TABLE public.membership_promo_codes ENABLE ROW LEVEL SECURITY;

-- Les codes ne doivent jamais être exposés publiquement : lecture/écriture
-- réservées au staff de la box (les mutations passent en plus par des routes
-- serveur en service_role qui parlent à Stripe).
DROP POLICY IF EXISTS promo_codes_staff_all ON public.membership_promo_codes;
CREATE POLICY promo_codes_staff_all ON public.membership_promo_codes
  FOR ALL TO authenticated
  USING (public.is_box_staff(box_id))
  WITH CHECK (public.is_box_staff(box_id));

NOTIFY pgrst, 'reload schema';
