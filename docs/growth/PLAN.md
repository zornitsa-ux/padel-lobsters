# Growth: plan

**Single source of truth for status.** The why and the findings are in
[`CASE-STUDY.md`](./CASE-STUDY.md).

**Goal.** More new players at their first event. Make every event link
shareable, readable without signing in, and one tap from registering.

**Focus: Phase 1 (shareable event page).** Phase 2 waits until Phase 1 has
shipped and the funnel has been measured.

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

## Resume here (paused 5 Nov 2026)

**Where things stand**

- **G1 is live** (#151, merged 4 Nov). Guests can browse upcoming events and
  open an event page; "Join" goes through signup back to the event.
- **G5b (traffic funnel) is deferred** by the owner. Don't build it unless
  asked.
- **G2 (link previews) is paused, blocked on Vercel access.** Its code is in
  draft PR #152 (branch `g2-link-previews`).

**What happened with G2**

1. #152 built previews as two **Vercel edge functions** (`api/event-preview`,
   `api/event-image`) plus crawler-only rewrites in `vercel.json`. CI passes,
   but **every Vercel deployment of the branch failed**. Nobody on the team
   can read the build log yet, so the cause is unknown. Moving the tests to
   `api/_tests` (Vercel deploys every other file in `api/` as a function)
   did not fix it.
2. The owner doesn't use Vercel edge functions and prefers a design without
   them. **Chosen direction: static previews generated at build time** (below).
3. That design depends on one unverified Vercel behaviour, so a **probe
   deployment** was pushed to test it. It deployed, but preview deployments
   are behind **Vercel Deployment Protection**, so it can't be checked from
   outside. The owner is getting access to the Vercel project.

**Blocker:** access to the Vercel project (owner), to run the probe checks
below. With access, the failed #152 build logs can also be read
(`npx vercel inspect <deployment> --logs`), but the static design no longer
needs that answer.

### Next step 1: run the probe

- Branch `probe-vercel-static-routing` (commit `55ce30a`, never merge) adds
  `public/events/route-probe/index.html` (marker `PROBE-INDEX-7f3a`) and
  `public/events/route-probe/info/index.html` (marker `PROBE-INFO-9c1e`).
- Preview host: `padel-lobsters-git-probe-vercel-st-cb4fd3-zornitsa-uxs-projects.vercel.app`.
  If it has changed, the "Vercel Preview Comments" check on commit `55ce30a`
  links to it.
- Get past protection with either a **Protection Bypass for Automation** token
  (Vercel → padel-lobsters → Settings → Deployment Protection), sent as the
  `x-vercel-protection-bypass` header, or a browser signed in to Vercel. Keep
  the token out of chat and commits: run the check yourself with `!` in Claude
  Code.

```sh
T=<bypass token>; H=https://padel-lobsters-git-probe-vercel-st-cb4fd3-zornitsa-uxs-projects.vercel.app
for p in /events/route-probe /events/route-probe/ /events/route-probe/info /events/route-probe/schedule /events/00000000-0000-4000-b000-000000000101; do
  b=$(curl -s -H "x-vercel-protection-bypass: $T" -w '\n%{http_code}' "$H$p")
  echo "$(echo "$b" | tail -1)  $(echo "$b" | grep -oE 'PROBE-(INDEX-7f3a|INFO-9c1e)|<div id="root"' | head -1)  $p"
done
curl -s -A "WhatsApp/2.23.20.0 A" -H "x-vercel-protection-bypass: $T" "$H/events/route-probe" | grep -oE 'PROBE-INDEX-7f3a|<div id="root"'
```

| Path                                             | Pass                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------ |
| `/events/route-probe` and `/events/route-probe/` | `200  PROBE-INDEX-7f3a` (folder `index.html` served before the app rewrite)    |
| `/events/route-probe/info`                       | `200  PROBE-INFO-9c1e` (nested folders work, so `/events/:id/info` is covered) |
| `/events/route-probe/schedule`                   | `200  <div id="root"` (no file, so the app)                                    |
| a real event id                                  | `200  <div id="root"` (unchanged)                                              |
| as WhatsApp                                      | `PROBE-INDEX-7f3a` (crawlers get the same file)                                |

After the probe: delete the branch (`git push origin --delete
probe-vercel-static-routing`).

### Next step 2: rework #152 to static previews (if the probe passes)

- **Remove:** `api/event-preview.ts`, `api/event-image.tsx`, `api/_lib/env.ts`,
  the two crawler rewrites in `vercel.json` (restore the plain catch-all) and
  the `@vercel/og` dependency.
- **Keep and move** to a build script (e.g. `scripts/event-previews/`):
  `eventPreview.ts` (text, escaping, closed events, image version),
  `EventImage.tsx` (the share card), `logo.ts`, and their tests.
  `brandColors.js` stays; Tailwind already uses it.
- **Add a post-build step** (`npm run build` → `vite build && node
scripts/event-previews/build.mjs`). It reads events from Supabase with the
  anon key (event facts only), then writes:
  - `dist/events/<id>/index.html` and `dist/events/<id>/info/index.html`: a
    copy of `dist/index.html` with that event's tags;
  - `dist/previews/<id>-<version>.png`: rendered with `satori` and
    `@resvg/resvg-js` (or `resvg-wasm`), using `@vercel/og`'s Geist Regular
    font (vendor the `.ttf` once `@vercel/og` is removed).
    A local render with that toolchain already works (4 Nov).
- **People and crawlers get the same page**, so there's no user-agent rule and
  no `?app=1` redirect.
- **Fail soft:** if Supabase is unreachable at build time, skip the previews
  and keep the build green.
- **Open decision (owner): how often to rebuild.** New or edited events show
  the generic preview until the next deploy. Options: a scheduled GitHub
  Action calling a Vercel deploy hook (e.g. every 2 hours; recommended), a
  database trigger on event changes (needs a migration), or normal deploys
  only.

**If the probe fails** (folder `index.html` isn't served first), try
`events/<id>.html` with `"cleanUrls": true` in a second probe before
considering any function.

---

## Phase 1: shareable events (the leak)

| #   | Task                        | What ships                                                                                                                                                                                                                                                                                                                                                                             | Status      |
| --- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| G1  | Public event page           | Guests see the upcoming events list (`/events`, upcoming only) and `/events/:id/info`: a read-only card (name, date, time, location, format, price, spots left) plus a "Join to play" CTA, or "Join to get on the waitlist" when full. Other tabs stay protected. See G1 notes.                                                                                                        | Done (#151) |
| G2  | Link previews               | Per-event `og:title`/`og:description`/`og:image` for `/events/:id*`, with a generated image (date, format, venue). No live spot count, because previews are cached. Check it in the WhatsApp and Instagram link preview. See **Resume here** and G2 notes.                                                                                                                             | Blocked     |
| G3  | Signup returns to the event | CTA → signup carrying the event as the return path (`returnPath.ts`). After verifying, land on the event with the register action focused (or the waitlist action, if it's full).                                                                                                                                                                                                      | Not started |
| G4  | Share button                | Extend the existing `ShareWhatsAppButton` (`src/components/ui`): `navigator.share` with the pre-written message and URL, falling back to WhatsApp and copy link. Shown on the event page for members and admins. The admin version has a longer "announcement" text for WhatsApp, plus "Download image", which serves the G2 preview image for an Instagram story with a link sticker. | Not started |
| G5  | Attribution                 | Shared URLs carry `?src=` (`wa`, `ig`, `share`) and `?ref=` (the sharing member's opaque referral code, never a player ID). Stored on signup (`players.signup_source`, `referred_by`) and on the registration. Admin view: signups and first events by source.                                                                                                                         | Not started |
| G5b | Traffic funnel              | Cookieless analytics (Vercel Web Analytics, or Plausible/Umami if custom events need a paid tier): public page views plus `event_page_view`, `share_tap`, `signup_start`, `signup_complete`, `event_register`, each tagged with `src`.                                                                                                                                                 | Deferred    |

**Order:** G1 → G2 → G3 → G5 → G4. G2 needs G1, because a preview that opens
to a sign-in wall wastes the tap. G5 ships before G4, so shares are counted
from day one. G5b (traffic funnel) is deferred by the owner (4 Nov).

**Done when:** a logged-out phone opens a WhatsApp-shared event link and sees
a rich preview, then the event details. It can sign up and be registered
without hunting for the event again, and the admin can see the signup's
source.

### G1 notes

- **Data access.** Guest pages read only event facts (an explicit column
  list, never `*`, no payment link or courts) and spots taken from the
  existing `public_tournament_registration_counts`. They never read
  registrations or player data, so they keep working when anon database
  access is tightened. That tightening is a separate project (owner decision,
  4 Nov), not part of G1. See #150.
- **Join.** "Join to play" goes to `/events/:id/join?signup=1`, a protected
  route. The gate opens in signup mode, and once signed in the route forwards
  to the event's info page. "Sign in" uses the same route without `signup`.
- **Routing.** `isPublicPath` matches fixed prefixes only. Adding `/events`
  as a prefix would make every sub-tab public (schedule, results, Oscars). G1
  adds exact matches for `/events`, `/events/:id` and `/events/:id/info`,
  with tests for the protected tabs.
- **Events list for guests.** Upcoming events only: no past events or
  results. Gives Instagram a bio link that never goes stale.
- **No level on the public card** for now. Events have no level field, and
  the owner chose to leave it off.
- **Full events.** The card shows "Full" and "Join to get on the waitlist".
  Signup continues to the event's waitlist (G3).

### G2 notes

- **Crawlers only.** `vercel.json` sends link-preview crawlers (WhatsApp,
  `facebookexternalhit` for Facebook and Instagram, iMessage, Telegram,
  Discord and others) on `/events/:id` and `/events/:id/info` to
  `api/event-preview`. People, including Instagram and Facebook in-app
  browsers, get the app as before. Search crawlers (Googlebot, Applebot) are
  left out so they index the app. A person matched by mistake is sent on to
  the link they opened, query included, with `?app=1`, which the rule skips.
- **Tags and image.** The function reads event facts only (name, date, time,
  venue, format) and returns `og:*` tags. `api/event-image` renders the
  1200×630 card. Its URL carries a version from those facts, so it's cached
  hard and an edited event gets a new image; any other version redirects to
  the current one. No spot count (cached). Started, finished or past events
  say sign-ups are closed. The logo is inlined, so a render fetches nothing.
- **Fallback.** `index.html` carries site-wide tags, used for every other
  link, and by the function when the event is unknown, or Supabase fails or
  takes over 2.5s.
- **Font.** The card uses the regular weight `@vercel/og` ships with, so no
  font file is bundled.
- **Check after deploy.** The functions read `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY` at runtime from the Vercel project env. Paste an
  event link into WhatsApp, or `curl -A WhatsApp/2 <event url>`.

### G5b: traffic funnel (deferred)

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

## Phase 2: activation and referral (later)

| #   | Task                | What ships                                                                                                                                                                                       | Status      |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| G6  | First-event card    | A Home card for accounts that haven't played yet: the next open event, level fit, and "Register".                                                                                                | Not started |
| G8  | Bring a friend      | Generalise the team-events partner invite: register yourself plus a friend's email for any event, and the admin invites them.                                                                    | Not started |
| G9  | Re-sell freed spots | On a cancellation with no waitlist, prompt the admin (or player) to share "1 spot open". Waitlist promotion builds on the existing waitlist status (decisions in `docs/registration-capacity/`). | Not started |

## Phase 3: capacity (only once growth needs it)

First-timer spots per event, more events or courts, and intro sessions. These
are the owner's calls, made from fill speed and waitlist data (CASE-STUDY §3).

---

## Decisions (owner, 4 Nov 2026)

1. **Events list:** guests see upcoming events at `/events`, as well as
   single event pages.
2. **Level:** not shown on the public page for now.
3. **Instagram:** reuse the G2 preview image as a "Download image" action
   (G4). No separate story design.
4. **Full events:** offer "Join to get on the waitlist".
5. **New-event email (G7):** dropped.

## Log

- 4 Nov 2026: case study and plan drafted from production aggregates and a
  code read. Figures kept out of the repo. Added G5b (traffic funnel).
- 4 Nov 2026: review fixes: ship order, G1 data access and routing notes,
  level guidance, cached previews drop spot count.
- 4 Nov 2026: owner dropped G7 (new-event email). Focus is Phase 1, the
  shareable event page.
- 4 Nov 2026: owner answered the open questions (see Decisions).
- 4 Nov 2026: G1 built (guest events list, guest event page, join via the
  sign-in gate). Anon database access split out as its own project. Case
  study corrected: a WhatsApp share button already exists.
- 4 Nov 2026: G1 merged (#151). G5b deferred by the owner. G2 built (crawler
  previews and share image).
- 4 Nov 2026: G2 review fixes. Every Vercel deploy of #152 failed; logs not
  readable.
- 5 Nov 2026: owner prefers no Vercel edge functions. Direction: static
  previews at build time. Probe pushed but blocked by preview protection.
  Paused until the owner has Vercel access (see Resume here).
