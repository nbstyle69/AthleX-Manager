---
name: testing-landing
description: Test the public landing page (/landing) of TheHub end-to-end — AthleX logo, ELO leaderboard (athletes/boxes), FR/EN i18n, two-tier pricing, store links, and athlete /signup. Use when verifying landing/marketing UI or the public signup flow.
---

# Testing TheHub landing (/landing)

Public marketing page + public athlete signup. Server-rendered leaderboard, client i18n.

## Where it runs
- **Vercel preview URLs for this repo are behind Vercel Deployment Protection** (a Vercel login wall). `curl` returns 200 because it follows the redirect to the login page — do NOT trust that as "reachable". In the browser you'll hit `vercel.com/login`.
- Workaround that works reliably: run the **PR build locally** and browse `http://localhost:3000/landing`.
  ```bash
  cd /home/ubuntu/TheHub
  npx next build           # if not already built
  ( set -a && . ./.env.local && set +a && PORT=3000 npx next start > /tmp/next_start.log 2>&1 & )
  ```
  This uses the shared Supabase project (`.env.local`), so the leaderboard shows real data and signup writes to the real backend.
- Flag to the user that the preview link is unreachable without a Vercel login (suggest disabling Deployment Protection or testing prod after merge).

## Key paths
- `app/landing/page.tsx` (server, `getLeaderboards()`), `lib/leaderboard.ts`
- `components/landing/{header,logo,leaderboard,pricing,app-showcase}.tsx`
- `lib/translations.ts` (FR/EN), `lib/store-links.ts`
- `app/(auth)/signup/page.tsx`, `app/api/auth/signup/route.ts`, `middleware.ts` (public allowlist)

## Assertions (use DOM via read_dom/computer for exact text)
1. **Logo**: header shows AthleX silver mark (`/athex-mark-*.png`) + wordmark, NOT the old flame square.
2. **Classement**: nav "Classement" → `#classement`. Athlètes tab = rows ranked by ELO desc, medals top 3. Box tab = boxes by avg ELO + member count, links to `/box/[slug]`. If data exists but rows are empty, `lib/leaderboard.ts` query/relation shape is broken.
3. **i18n**: EN toggle switches nav/hero/leaderboard/pricing; no raw keys (e.g. `pricing.title`). Toggle back to FR restores.
4. **Pricing**: exactly 2 cards — Coach 39€ (note 32€ annuel) + Box 79€ (62€ annuel · essai 14j) with "Populaire" badge.
5. **Stores**: App Store href = `apps.apple.com/app/id6762889282`, Google Play = `play.google.com/...?id=com.athlex.app`.
6. **Signup**: `/signup` loads without redirect to `/login`. Submit disposable account → success screen "Compte créé". Then **verify + clean up** via service client (see below).

## Signup backend verification + cleanup (critical)
Signup must produce an app-compatible profile. Verify with the service role key, then DELETE the disposable account (profile + auth user + badges) so no test data is left:
```js
// role=member, level=inter, elo=1000, total_matches/wins/losses=0, referral_code, id == auth user id
// cleanup: s.from('user_badges').delete().eq('user_id',id); s.from('profiles').delete().eq('id',id); s.auth.admin.deleteUser(id)
```
Use a unique email like `devin-landing-test+<epoch>@example.com`.

## Gotchas
- **Email confirmation**: the shared Supabase project may auto-confirm signups → success screen says "Ton compte est prêt" and `email_confirmed_at` is set immediately (no confirm-email screen). The code handles both; don't treat auto-confirm as a bug, but flag it if the user expected mandatory confirmation.
- `tsconfig.tsbuildinfo` shows as modified after a build — it's generated, don't commit it.
- Don't commit test-plan / test-report files into the repo worktree; keep them under `/home/ubuntu/`.

## Devin Secrets Needed
- None beyond repo `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` for verification/cleanup).
