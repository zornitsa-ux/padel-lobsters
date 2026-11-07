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

## Resume here (7 Nov 2026)

- **G1, G2, G4 and G4b are live** (#151, #152, #154, #155). G4b merged 7 Nov;
  gap 6 (Manage tab "Fill the spots") was dropped by the owner.
- **G3 (signup returns to the event) is in review.** See G3 notes. After it
  merges, the owner pastes `magic_link.html` and `confirmation.html` into the
  hosted dashboard's email templates. Merge by ~11 Nov (release freeze before
  the 15 Nov event), or after the 15th.
- **Next: G5** (attribution, needs a migration). Then G5b (traffic funnel):
  first look into Vercel Web Analytics and Speed Insights (see G5b).
- **G4 leftovers** (admin announcement text, "Download image") are still open.

---

## Phase 1: shareable events (the leak)

| #   | Task                        | What ships                                                                                                                                                                                                                                                                                                                                                              | Status      |
| --- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| G1  | Public event page           | Guests see the upcoming events list (`/events`, upcoming only) and `/events/:id/info`: a read-only card (name, date, time, location, format, price, spots left) plus a "Join to play" CTA, or "Join to get on the waitlist" when full. Other tabs stay protected. See G1 notes.                                                                                         | Done (#151) |
| G2  | Link previews               | Per-event `og:title`/`og:description`/`og:image` for `/events/:id*`, with a generated image (date, format, venue). No live spot count, because previews are cached. Check it in the WhatsApp and Instagram link preview. See G2 notes.                                                                                                                                  | Done (#152) |
| G3  | Signup returns to the event | CTA → signup carrying the event as the return path (`returnPath.ts`), also when the email link opens in another browser. Land on the event's Info tab with the sign-up action on screen (or the waitlist action, if it's full). See G3 notes.                                                                                                                           | In review   |
| G4  | Share button                | `ShareEventButton` opens an in-app `ShareSheet`: the message, then `navigator.share` (where available), copy message and copy link. See G4 notes. Shown on the event page for members and admins. The admin version has a longer "announcement" text for WhatsApp, plus "Download image", which serves the G2 preview image for an Instagram story with a link sticker. | Done (#154) |
| G4b | More places to share        | A full-width "Share with friends" variant, then share right after signing up (`JoinEventCard` registered state), after an admin creates an event, in the event header on every tab while sign-ups are open (`EventShell`), and on the You tab. Then the signed-out event page. The Manage tab ("Fill the spots") was dropped. See G4 notes.                             | Done (#155) |
| G5  | Attribution                 | Shared URLs carry `?src=` (`wa`, `ig`, `share`) and `?ref=` (the sharing member's opaque referral code, never a player ID). Stored on signup (`players.signup_source`, `referred_by`) and on the registration. Admin view: signups and first events by source.                                                                                                          | Not started |
| G5b | Traffic funnel              | Cookieless analytics (Vercel Web Analytics, or Plausible/Umami if custom events need a paid tier): public page views plus `event_page_view`, `share_tap`, `signup_start`, `signup_complete`, `event_register`, each tagged with `src`.                                                                                                                                  | Later       |

**Order:** G1 → G2 → G3 → G5 → G4. G2 needs G1, because a preview that opens
to a sign-in wall wastes the tap. G5 ships before G4, so shares are counted
from day one. On 7 Nov the owner took the G4 share sheet and G4b first. G5b
(traffic funnel) is back in scope for later.

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
  hard and an edited event gets a new image; any other URL for the event
  (wrong version, extra params) redirects to the current one, so only real
  events render, once per version. No spot count (cached). Started, finished
  or past events say sign-ups are closed, judged by Amsterdam's date. The
  logo is inlined, so a render fetches nothing.
- **Fallback.** `index.html` carries site-wide tags (from `siteMeta.js`),
  used for every other link, and by the function when the event is unknown,
  or Supabase fails or takes over 2.5s. After a Supabase failure the page
  isn't cached. The image function sends an unknown id to the static
  `logo-hd.png`, and answers a Supabase failure with an uncached 503, so a
  crawler retries rather than keeping a wrong image.
- **Not covered:** links to the other event tabs (schedule, results) get the
  site card. Those are for members, not sharing.
- **Font.** The card uses the regular weight `@vercel/og` ships with, so no
  font file is bundled.
- **Node.js runtime.** The functions export `{ fetch }` and run as plain Node
  ES modules, so relative imports carry a `.js` extension (a test enforces
  it). Vercel's file tracer maps `.js` to a `.ts` source but not to `.tsx`,
  so the share card lives in `api/event-image.tsx` itself.
- **`@vercel/og` is pinned to 0.11.1.** Every 1.0.x release crashes when
  loaded as an ES module in Node (`Dynamic require of "fs"` from its bundled
  `harfbuzzjs`). Retest before upgrading.
- **Check after deploy.** The functions read `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY` at runtime from the Vercel project env. Paste an
  event link into WhatsApp, or `curl -A WhatsApp/2 <event url>`.

### G3 notes

- **Checked end to end** (e2e `signup-to-event.spec.ts`, phone-sized): a new
  account by code, a new account by the email link opened in another browser,
  a full event (waitlist), an existing member signing in, and a team event.
  The code path and a same-browser link already returned to the event (G1).
- **Fixed: the email link in another browser.** The link said `next=/home`,
  and the return path lived only in the first browser's storage, so signing up
  in Instagram's in-app browser and tapping the link in Mail lost the event.
  `requestEmailCode` now sends the current page as `emailRedirectTo`, and the
  magic-link and signup templates add it to the link as `return_to`
  (`{{ .RedirectTo | urlquery }}`, so a page with several query params comes
  back whole). `AuthConfirm` keeps only its path (never `/` or `/auth/*`) and
  puts it first, since it belongs to the link being opened; then the saved
  path, then `next`. If GoTrue drops it (not on the redirect allow-list) it
  sends the site URL, which is ignored. The hosted allow-list is the
  production origin `/**` (pin-auth-removal DESIGN §2). Either deploy order is
  safe: app first sends no `return_to` to old templates; templates first get
  the old `/auth/confirm` URL, which is ignored.
- **Security (7 Nov).** Anyone can ask GoTrue to email a sign-in link to
  any address, with any allow-listed `redirect_to`, so `return_to` is chosen
  by whoever asked for the email. That's acceptable because:
  - it's reduced to an in-app path by `safeAppPath` (`src/lib/safePath.ts`):
    the browser's own URL parser resolves it against our origin and anything
    on another origin is rejected (`//host`, `/\host`, `javascript:`,
    `data:`, whitespace tricks; unit tests). No hand-rolled string checks. The
    same helper guards the saved path, `next`, and the team-invite "Not now"
    return;
  - no page writes on load: transfers, team invites and registration all
    need a tap (checked 7 Nov). Keep it that way: a route that acts on open
    would make this a one-click attack;
  - the value is URL-encoded in the email (`urlquery`), so it can't add or
    override link params.
    The return path (saved and emailed) drops the sign-in deep link's
    `?signin=1&email=`, so no address travels in a link. The hosted allow-list
    must stay the production origin `/**` only: no other hosts, no preview
    patterns.
- **Register on screen on landing, for everyone** (owner, 7 Nov). The owner
  called the old layout a design flaw, not something to work around with a
  scroll or highlight after signup. The Info tab now puts the sign-up card
  (and the transfer card) straight under the date card, above the
  description, for individual and team events alike. At 375×667 "Register for
  this event" and "Sign up as a team" are on screen without scrolling. Nothing
  registers without a tap, and team events still open the partner picker from
  "Sign up as a team".
- **Waitlist.** "Join to get on the waitlist" uses the same join route, and a
  full event's card shows "Join the waitlist", so it needed no change.
- **Not changed:** the password-reset link (recovery) still returns via the
  saved path or `/home`.

### G4 notes

- **Member share sheet first** (owner, 7 Nov): taken ahead of G3 and G5.
  "Share" opens an in-app sheet (`ShareSheet`) showing the message, with the
  phone's share sheet (`navigator.share`, where available), copy message and
  copy link. It replaces `ShareWhatsAppButton`, which went straight to a
  `wa.me` page.
- **No direct WhatsApp option** (owner, 7 Nov, in G4b). The `wa.me` row
  didn't carry the emoji across and was clunky. Picking WhatsApp from "Share
  via…" (the phone's share sheet) works better, so the row is gone. Where a
  browser has no share sheet (some desktops), people copy the message.
- **Message** (`eventShareMessage.ts`): name, date and time, venue, format,
  price per player, spots left (or "Full, join the waitlist") and the sign-up
  link. No player names, unlike Playtomic's list of who's in: the message is
  forwarded outside the group.
- **Only while sign-ups are open.** `ShareEventButton` renders nothing once
  the event has started, finished or passed (`isOpenToJoin`, the same rule as
  the guest page and the G2 previews), because the message says "Sign up".
- **Where it shows now (G4b):** the home next-event card (icon), the
  events-list card (icon), the event header on every tab (icon, with spots
  left), "Share with friends" (full width) under "You're registered" on the
  Info tab and on the You tab (individual and team events), and a "Your event
  is live" share sheet right after an admin creates an event (skipped for a
  back-dated event). Signed-out visitors get the same header icon on the
  guest event page. The Info tab's compact share moved to the header, so the
  `compact` variant is gone.
- **Gaps found (7 Nov), for G4b, by growth impact:**
  1. Right after signing up: the card just switches to "You're registered"
     (`JoinEventCard`). This is the best moment to ask someone to bring a
     friend.
  2. After an admin creates an event: the form closes with no prompt.
  3. The event header on every tab: during the event members land on the You
     tab, where share isn't visible.
  4. The You tab, for registered players.
  5. The signed-out event page (safe, since the message has no names).
  6. The Manage tab: "Fill the spots" next to the counts.
  7. A spot freed by a cancellation with no waitlist: belongs to G9.
     Items 1 to 5 built in G4b. 6 dropped (owner, 7 Nov).
- **Not shared:** past events, partner invites (a private invite), the
  signed-out events list (its cards are already links), and the waitlist
  notice (sharing a full event only grows the waitlist).
- **Still to do:** the admin announcement text and "Download image", and
  `?src=`/`?ref=` on the link once G5 lands.

### G5b: traffic funnel (later)

**Back in scope** (owner, 7 Nov), after G4b and G5. **First, look into
Vercel's own tools:** Web Analytics (page views, and whether custom events
like `share_tap` need a paid plan on Hobby) and Speed Insights (real-user load
times, alongside the existing perf CI). Check each against the acceptance
criteria below before choosing a vendor.

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
   . **Link previews (G2), 6 Nov:** Vercel functions on the Node.js runtime,
   not static pages built at deploy time.

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
- 6 Nov 2026: owner has Vercel access and chose functions again, on Node.js.
  Build log read (edge runtime rejected `@vercel/og`). Moved to Node, fixed
  import extensions, pinned `@vercel/og` 0.11.1. Static design and probe
  dropped.
- 7 Nov 2026: G4 member share sheet built (in-app options, cleaner message),
  ahead of G3 and G5 at the owner's request.
- 7 Nov 2026: share placement audit. Share hidden once sign-ups close. Added
  G4b (more places to share). G5b back in scope for later, starting with a
  look at Vercel Web Analytics and Speed Insights.
- 7 Nov 2026: G4b built: full-width "Share with friends", share after
  registering (Info and You tabs), in the event header, and after creating an
  event (`addTournament` now returns the saved event). Signed-out page and
  Manage tab left for the owner to decide.
- 7 Nov 2026: removed the share sheet's direct WhatsApp (`wa.me`) option at
  the owner's request: emoji came through broken, and WhatsApp via the
  phone's share sheet works better.
- 7 Nov 2026: share on the signed-out event page (header icon). Manage tab
  "Fill the spots" dropped by the owner.
- 7 Nov 2026: G4b merged (#155).
- 7 Nov 2026: G3 built. Owner: sign-up must be on screen on landing for
  everyone (moved above the description), and fix the email link in this PR
  (`return_to` from RedirectTo). E2e for the signup → event paths.
- 7 Nov 2026: G3 review fixes: the link's `return_to` beats an older saved
  path, is URL-encoded in the template, and is read as a path only.
- 7 Nov 2026: G3 security pass on the redirects: return paths drop
  `?signin`/`email`, more unsafe-URL tests, notes in G3.
- 7 Nov 2026: return paths validated with the WHATWG URL parser
  (`safeAppPath`) instead of string checks; the invite return uses it too. No
  npm package fit: `@braintree/sanitize-url` blocks XSS schemes, not
  off-site redirects.
