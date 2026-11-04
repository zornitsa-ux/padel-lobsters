# Growth: plan

**Single source of truth for status.** The why and the findings are in
[`CASE-STUDY.md`](./CASE-STUDY.md).

**Goal.** More new players at their first event. Make every event link
shareable, readable without signing in, and one tap from registering.

**Constraints**

- **Migrations:** review → merge → `npx supabase db push` from `main`
  (CLAUDE.md). There are no MCP or dashboard writes to production.
- **Testing is local only** (local stack plus `npm run rehearsal:sync`).
- **No player names, emails or IDs** on public surfaces, in previews, or in
  commits.
- **No sign-in-facing release within 3 days of a tournament.** Events are on
  15 Nov and 29 Nov 2026.
- One task = one branch off `main`. Each PR updates this file's status table.

---

## Phase 1: shareable events (the leak)

| #   | Task                        | What ships                                                                                                                                                                                                                                                     | Status      |
| --- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| G1  | Public event page           | A `public_events` view for anon (explicit columns: name, date, time, location, format, gender mode, cap, price, spots taken). `/events/:id/info` becomes public for guests: a read-only event card plus a "Join to play" CTA. Other tabs stay protected.       | Not started |
| G2  | Link previews               | A Vercel function or middleware serves per-event `og:title`/`og:description`/`og:image` for `/events/:id*`, with a generated image (date, format, spots left). Check it in the WhatsApp and Instagram link preview.                                            | Not started |
| G3  | Signup returns to the event | CTA → signup carrying the event as the return path (`returnPath.ts`). After verifying, land on the event with the register action focused.                                                                                                                     | Not started |
| G4  | Share button                | A `ShareButton` in `src/components/ui`: `navigator.share` with a pre-written message and URL, falling back to copy link. Shown on the event page for members and admins. The admin version has a longer "announcement" text for WhatsApp.                      | Not started |
| G5  | Attribution                 | Shared URLs carry `?src=` (`wa`, `ig`, `share`) and `?ref=` (the sharing member's opaque referral code, never a player ID). Stored on signup (`players.signup_source`, `referred_by`) and on the registration. Admin view: signups and first events by source. | Not started |
| G5b | Traffic funnel              | Cookieless analytics (Vercel Web Analytics, or Plausible/Umami if custom events need a paid tier): public page views plus `event_page_view`, `share_tap`, `signup_start`, `signup_complete`, `event_register`, each tagged with `src`. Ships with G1.          | Not started |

**Order:** G1 + G5b → G3 → G2 → G4 → G5. G2 needs G1, because a preview that
opens to a sign-in wall wastes the tap. Ship G5 **with or before** G4, so
shares are counted from day one.

### G5b: traffic funnel

**Why.** G5 records sources only for people who convert. G5b counts the
anonymous steps before that (link opened → page viewed → signup started), so
a weak result can be traced to the preview, the page or the signup form.
Before G1 there is almost no anonymous traffic, so it ships with G1, not
earlier.

**Sources of truth.** The analytics tool covers the top of the funnel only.
Signups and registrations are counted from the database (G5).

**Acceptance criteria**

- **Cookieless, no consent banner.** No GA4 or other cookie-based tool.
- **Small script** (≈1 KB), loaded without blocking first paint. Check it
  against the bundle-size CI comment.
- **No traffic writes to Supabase.** A row per page view adds disk-IO the
  Micro instance can't spare.
- **Query strings are dropped** before anything is sent. Only `src` and
  `ref` are kept. Sign-in deep links carry `?email=`
  (`useSignInDeepLink.ts`) and the app only strips it after load.
- **`/auth/*` is never tracked** (it carries confirmation tokens).
- **No player IDs, names or emails** go to the vendor. `ref` goes only as an
  opaque code, never a player ID.
- **SPA route changes** are counted as page views.
- **Reviewed monthly** against the owner's private baseline. No live
  dashboards.

**Done when:** a logged-out phone opens a WhatsApp-shared event link and sees
a rich preview, then the event details. It can sign up and be registered
without hunting for the event again, and the admin can see the signup's
source.

## Phase 2: activation and referral

| #   | Task                | What ships                                                                                                                                        | Status      |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| G6  | First-event card    | A Home card for accounts that haven't played yet: the next open event, level fit, and "Register".                                                 | Not started |
| G7  | New-event email     | An opt-in email when an event opens, starting with never-played accounts. Reuses the edge-function email path.                                    | Not started |
| G8  | Bring a friend      | Generalise the team-events partner invite: register yourself plus a friend's email for any event, and the admin invites them.                     | Not started |
| G9  | Re-sell freed spots | On a cancellation with no waitlist, prompt the admin (or player) to share "1 spot open". Waitlist promotion if `registration-capacity` covers it. | Not started |

## Phase 3: capacity (only once growth needs it)

First-timer spots per event, more events or courts, and intro sessions. These
are the owner's calls, made from fill speed and waitlist data (CASE-STUDY §3).

---

## Open questions for the owner

1. **G1 scope:** should guests also see the upcoming events _list_ (`/events`),
   or only single event pages reached by link?
2. **Level and price on the public page:** show the Playtomic level band and
   the price per player? (Both help a stranger decide.)
3. **Instagram:** is a downloadable story image per event worth it, or does
   the link preview cover it?
4. **Email (G7):** OK to email accounts that have never played, as opt-out,
   or opt-in only?

## Log

- 4 Nov 2026: case study and plan drafted from production aggregates and a
  code read. Figures kept out of the repo. Added G5b (traffic funnel).
