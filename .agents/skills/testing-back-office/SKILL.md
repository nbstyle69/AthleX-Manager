---
name: testing-back-office
description: Test TheHub owner back-office (dashboard) flows end-to-end in the browser — login, settings (logo/cover/CGV PDF), /programs (membership plans), /members, /subscribers, and the public /box/[slug] subscribe modal + athlete /compte. Use when verifying back-office UI, membership/plan, or box-settings changes.
---

# Testing TheHub back-office

## Environment
- App runs locally on `http://localhost:3000` (Next.js App Router). Root `/` redirects to `/landing` (307) for anon.
- Same `.env.local` points at the **real prod Supabase** (`lkwdlqlbrbxaiydkoxfp`). Seeded fixtures hit prod data — always prefix disposable rows with `zz_` and delete them after.

## Devin secrets needed
None extra — `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` are already in `.env.local`.

## Login in the browser (owner or athlete)
Use the built-in diagnostic page `/test-login` (`app/test-login/page.tsx`): set email + password, click **Tester**. It signs in client-side and POSTs tokens to `/api/auth/set-session` so the server sees the `sb-access-token` cookie. Owners land on `/` (dashboard); athletes get "Box non configurée" → go to `/compte`.

## Seeding a disposable owner + box + subscribed athlete
Create auth users via `supabase.auth.admin.createUser({email, password, email_confirm:true})`, then rows. Gotchas learned:
- `boxes.invite_code` is **NOT NULL** — set it.
- `box_members.role` CHECK allows only `'member' | 'coach' | 'owner'` (NOT `'athlete'`).
- Give the athlete an active sub: `box_members` row with `plan_id`, `subscription_status='active'`, `subscription_current_period_end` in the future.
- `boxes` needs `is_active=true` (and `is_listed=true`) to appear publicly.

## Unlocking the back-office paywall (IMPORTANT)
`app/(dashboard)/layout.tsx` locks the whole back-office with a `PaywallOverlay` when the trial is over and there's no paying sub. A freshly seeded box has no `box_subscriptions` row → the overlay blocks every settings click. Insert one:
```sql
INSERT INTO public.box_subscriptions (box_id, status, plan_tier, current_period_end, is_early_adopter)
VALUES ('<box_id>','active','complete', now()+interval '365 days', true);
```
Then reload — header shows "Plan Complet actif" and settings become clickable.

## Pitfall: new public `boxes` columns need an anon column-grant
`boxes` uses **column-level SELECT grants** for `anon`/`authenticated`, not a table-wide grant. A new column added by `ALTER TABLE boxes ADD COLUMN ...` is **not** auto-granted to `anon`, so the public `/box/[slug]` page (reads with the anon key) 404s with `permission denied for table boxes`. Any migration adding a column the public page reads must also:
```sql
GRANT SELECT (<new_col>) ON public.boxes TO anon, authenticated;
```
To detect: `select` the column with the anon key — a `42501 permission denied` means the grant is missing. (This exact bug hit the CGV PDF feature, PR #211.)

## CGV PDF feature (PR #211) test path
- Owner: `/settings` → "Conditions générales (PDF)" section → "Uploader un PDF" (accept `application/pdf`, max 10 Mo). Uploads to `box-logos/{box_id}/terms.pdf` (public bucket) and writes `boxes.terms_pdf_url`. Shows "Voir le PDF actuel" / "Changer" / "Supprimer".
- Public: `/box/[slug]` → "S'abonner" → modal recap → "Voir les conditions générales (PDF)" (only in the subscription branch, not one-shot offers).
- Athlete: `/compte` → Abonnement block → "Conditions générales de ma box (PDF)".
- Adversarial: link must be **absent** before upload and **absent** after "Supprimer" (removal nulls the DB ref but leaves the Storage file — known limitation).

## Promo codes feature (PR #212) test path
- Owner: `/programs` → section **"Codes promo"** → "Créer un code" (code A-Z0-9, %/€, durée once/N mois/forever, max, expiration). Codes are mirrored to a **Stripe coupon + promotion code on the box's connected account**; DB row stores `stripe_coupon_id` + `stripe_promotion_code_id`. Toggle/Delete via `/api/promo-codes/[id]`.
- Checkout proof (the key test): public `/box/[slug]` → "S'abonner" → email → **real Stripe Checkout**. `allow_promotion_codes:true` shows an **"Add promotion code"** link. Enter a **percentage** code and confirm the total drops (e.g. −20%). The subscription first invoice is **prorated** (billing_cycle_anchor = 1st of next month), so the "today" total is small, not the full plan price.
- ⚠️ **Fixed-amount (€) codes fail at checkout when Stripe Adaptive Pricing is on.** If the Checkout shows a currency toggle (USD/EUR), `amount_off` coupons are rejected with "This code is invalid" (Stripe can't convert a fixed amount across currencies). Only **percentage** codes work in multi-currency checkouts. Test the discount-applies assertion with a **percent** code; treat fixed-€ at multi-currency checkout as a Stripe limitation, not a code bug.
- ⚠️ **Stripe test-mode `coupons.del` may fail with "No such coupon"** even for a live coupon that was just redeemed (read/list/update/redeem still work). The app's DELETE wraps `coupons.del(...).catch(()=>{})`, so it silently leaves orphaned coupons in this case. To verify deletion, rely on UI card removed + DB row gone; note coupon removal may be unconfirmable in test mode. In cleanup, deactivate leftover promotion codes (`promotionCodes.update(id,{active:false})`) since `del` may be unavailable.
- Reactivating a deactivated percent code (`RENTREE25`) is handy to prove the discount path without hitting the fixed-€ limitation.

## Funnel C3 — Prospects (`/prospects`) + prospect `/suivi` (PR #220) test path
- Seed: disposable owner+box, a **non-subscriber** member (`box_members` active, NO active sub), a **past** `class_schedules` + `class_reservations` with `attended=true`, and a `membership_plans` row (for the offer). Then run `select public.detect_trial_followups();` (service role) → creates one `session_followups` row `pending`.
- Owner `/prospects`: **Pipeline** tab shows the prospect card in **« Essai réalisé »**. **Créneaux RDV** tab → fill date/time/capacity → « Ajouter le créneau ».
  - ⚠️ **Known UI refresh gap**: after adding a slot the "Créneaux à venir" list does NOT auto-refresh — **reload the page** to see it. The row IS in `box_appointment_slots` immediately (verify with the service role). Not a data bug.
- Prospect (login the member via `/test-login`, then go to `/suivi`): feedback step (★ + comment) → "Envoyer mon avis" (`pending→responded`) → slot list appears → "Réserver" (`responded→meeting_booked`, shows "Ton RDV est réservé").
- Back on owner `/prospects`: prospect moved to « RDV pris », shows the stars+comment; slot shows `1/1 réservé`.
- ⚠️ **VM clock caveat**: the box clock may be **far ahead of the env note's date** (e.g. env said June but VM was 2026-07-30). The slot list filters `starts_at >= now()-24h`, so always date test slots in the future relative to `date -u` on the box, not the stated date — otherwise slots silently vanish from the list (looks like a bug but isn't).
- RLS note: `book_appointment_slot` / `submit_followup_feedback` are `SECURITY DEFINER`; the member only sees/acts on their own `session_followups` (member_id=auth.uid()); owner/coach via `manages_box_funnel(box_id)`.

## Cleanup
Delete `membership_promo_codes`, `box_members`, `membership_plans`, `box_subscriptions`, the `box-logos/{id}/terms.pdf` object, the `boxes` row, `profiles`, then `auth.admin.deleteUser` for every `zz_*` user. For promo tests, also try to delete the Stripe coupons; if `del` fails (test-mode quirk), deactivate the promotion codes instead.
