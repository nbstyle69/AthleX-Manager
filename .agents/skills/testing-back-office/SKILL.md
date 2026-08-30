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
Use the real login page `/login/box` (owners/coachs) or `/login/athlete`. It signs in client-side and POSTs the tokens to `/api/auth/set-session`, so the server sees the `sb-access-token` cookie. Owners land on `/` (dashboard); athletes get "Box non configurée" → go to `/compte`. Add `?next=/some/path` to come back to a specific page after login (used by `/pricing` and `/pricing/manage` when opened from the mobile app without a web session). The old `/test-login` diagnostic page and `/api/session` were removed in Lot 7A.

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

## Box access model — what résiliation actually gates (verified via RLS)
Prove athlete access at the **RLS boundary** with the athlete's real JWT (anon client + `signInWithPassword`), not via UI (the athlete app is React Native, no simulator). Run the app's exact `.select()/.insert()` calls and count rows per state.
- **The only membership gate is `box_members.status='active'`** (via `get_user_box_ids()`/`is_box_member`). It gates `class_schedules`, `class_reservations` (SELECT), and the reservation read-back. `boxes` and `box_wods` are effectively **public to any logged-in user** (`boxes_select_all USING true`, `box_wods_read USING auth.uid() IS NOT NULL`) — so box/WOD row counts are NOT valid "has access" indicators. Tournaments (`tournament_wods`) are public read too.
- **"Résilier" = `cancel_at_period_end=true`** (`cancel-membership` / `cancellation-request/review`) → subscription stays active until period end → **no access change**.
- At real period end, webhook `customer.subscription.deleted` sets `subscription_status='cancelled'`, `plan_id=null` but **leaves `status='active'`** (`stripe-connect-webhook/route.ts:272-279`) → the athlete **still sees schedules and can still book**. So résiliation does NOT revoke box access. Only **banning** (`status='banned'`) does (schedules→0, reservation insert→RLS 42501, 0 row persisted).
- To reproduce states without real Stripe time-advance, apply the exact webhook `box_members` UPDATE with the service role; cite the webhook lines in the report. Reservation `insert().select().single()` mirrors `ReservationScreen.toggleBooking`; a banned member's insert fails on the RETURNING SELECT (status='active' gate).

## Tunnel « Essai » (acquisition de prospects sans compte) — test path in PRODUCTION
Verified end-to-end on `https://athlexapp.eu` (prod = the fastest way to prove freshly merged screens on real data; every write is real, so use a recognizable disposable identity and report the IDs instead of deleting).
- **Owner access when no password exists for the real owner**: create a disposable Supabase auth user (`supabase.auth.admin.createUser`) + a `box_members` row `role='owner', status='active'` on the target box, then log in through `/login/box`. Report the account for revocation — it is *access*, not evidence. The box already having an active `box_subscriptions` row means no paywall overlay.
- **Offer**: sidebar *Business → « Programmes athlètes »* (`/programs`) → « Créer une offre » → tile **Essai / « Gratuit · 1 séance découverte »**. Discriminating check: click **Abonnement** first (price field visible), then **Essai** — every price input must disappear and a yellow « Gratuite par construction » help block appears.
- **One-trial-per-box**: to actually exercise the trial constraint, retry with a **different name**. Same name hits `membership_plans_box_id_name_key` (« Une formule porte déjà ce nom ») and proves nothing. The trial index `membership_plans_une_offre_trial_par_box` is mapped in the UI to « Cette box a déjà une offre Essai. Modifie-la au lieu d'en créer une seconde. »
- **Public funnel** (incognito): `/box/<slug>` → dedicated « Séance d'essai » block + CTA « Réserver mon essai » → form (only *prénom* + *e-mail* are required; nom/téléphone optional) → « Voir les cours » / « See the classes » → slot dialog.
- **Slot dialog is day-first** (since PR #302, `app/box/[slug]/TrialBookingCta.tsx`): a « CHOISIS UN JOUR » / « PICK A DAY » chip row, then **only the active day's** cards. `FIRST_DAYS = 7` chips are shown; « Voir les dates suivantes » / « Show later dates » appears only when the server's 21-day answer contains **more than 7 open days**, and expands client-side with **no extra fetch** (`setAllDays(true)`), ending with « Toutes les dates ouvertes sont affichées. » / « All open dates are shown. ». Card head line is `HH:MM – HH:MM · <class name>` with seats at the right (« N places restantes » / « N seats left »); long date + coach on the sub-line.
  - **Predict the expected UI from the RPC before clicking** — it makes assertions exact: `psql "$SUPABASE_DB_URL" -c "with s as (select * from jsonb_to_recordset((select to_jsonb(r)->'slots' from list_public_trial_slots('<box_id>',21) r)) as x(scheduled_date text, start_time text, end_time text, title text, coach text, seats_left int)) select scheduled_date, count(*), string_agg(start_time||'/'||title||'/'||seats_left,' | ' order by start_time) from s group by 1 order by 1;"`. Pick **two days with different slot counts** (NBS2: weekdays 7 slots, Sunday 3) so "changing day changes the list" is discriminating, not just a re-highlight.
  - The **scroll container wraps the day row + the card list**; only the title/hint and the « Retour / Confirmer » footer (`shrink-0 border-t`) stay fixed. With 21 chips expanded the list already overflows at 1600x1156, so the sticky footer is provable without resizing; on a short list, shrink the window height instead of claiming it.
  - Nothing is written until « Confirmer ma réservation » is clicked — the calendar step is safe for **read-only prod verification**. Prove it afterwards with `select count(*) from box_prospects` / `class_reservations where is_trial` before & after.
- **Slot choice caveat**: the VM/prod clock may be far from the date in the prompt; `list_public_trial_slots` only returns `(scheduled_date + start_time) > now()`. Pick the slot from the live list, and prefer one on **today** so `/schedules → Présences` (which defaults to today) opens straight on it.
- **Measured effects, not screens** (read-only psql via `SUPABASE_DB_URL` in `.env.local`):
  `class_reservations` → exactly 1 row for the schedule, `is_trial=true`, `prospect_id` not null, `member_id IS NULL`, `status='confirmed'` (never `waiting`); `box_prospects.status` `essai_reserve` → `venu` after marking attendance.
- **Refusals**: same e-mail + same slot → « Tu as déjà réservé ce cours avec cette adresse e-mail. » (`deja_reserve`) / EN « You already booked this class with this email address. ». The public route rate-limits **3 bookings/h/IP** (in-memory, `lib/trialRateLimit.ts`) — a full FR+EN run consumes 2–3 tokens, so budget attempts or expect `trop_de_tentatives`.
- **`creneau_complet` is normally untestable in prod**: filling a real 15-seat class or creating a throwaway capacity-1 class means mass/unwanted production writes. Test the neighbouring guarantee instead (`status='confirmed'`, never `waiting`).
- **Attendance**: `/schedules` → tab « Présences » (default) → click the class row → « Inscrits (n/max) » → the trial line shows the prospect name + `ESSAI` badge + e-mail (not « ? »); the ✓ button writes `box_prospects.status`. Then `/prospects` → tab « Essais » → the card moves from « Essai réservé » to « Venu ».
- **i18n**: the FR/EN switch is in the public page header; the trial block and refusal strings are translated, but **paid-plan buttons stay French** — don't report that as a trial-funnel regression.

## Cleanup
Delete `membership_promo_codes`, `box_members`, `membership_plans`, `box_subscriptions`, the `box-logos/{id}/terms.pdf` object, the `boxes` row, `profiles`, then `auth.admin.deleteUser` for every `zz_*` user. For promo tests, also try to delete the Stripe coupons; if `del` fails (test-mode quirk), deactivate the promotion codes instead.
