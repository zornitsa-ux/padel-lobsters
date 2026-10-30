# Design system: plan

**Goal.** Make the right UI the easy path and the wrong one fail. Feature code
composes components from `src/components/ui`. Components own the colour,
size and state decisions, built on tokens. Guardrails catch drift before
review.

Read with [`TOKENS.md`](./TOKENS.md) (token reference and owner decisions).
Background: the 2026-10-24 UI review of the team-events PRs (#56–#67), which
found about 870 raw palette classes, 15 hand-built alert boxes and about 50
button size overrides.

**Why drift happened.** Not for lack of components. `Badge` and `AlertBox`
existed, but `Badge` had no success or neutral tone and `AlertBox` no small
size, so features built their own. The rule this plan follows: **when a
component doesn't fit, fix the component, not the call site.**

---

## Layers

1. **Tokens** (`tailwind.config.js`). Status colours, neutrals, type, brand
   and shadows. Feature code should rarely need the status shade suffixes
   directly: components choose them.
2. **Components** (`src/components/ui`). The primary interface. Each one
   covers its real variants, so nobody needs a copy.
3. **Guardrails.**
   - The CLAUDE.md "UI and Design System" section, which every agent reads.
   - `npm run design:check` in CI: a per-file ratchet on raw palette classes
     (`scripts/raw-colours-baseline.json`). Counts may only go down.
   - Layout belongs to layout components and parents (owner, 2026-10-26):
     `Button` and `TextButton` take no `className`, so no margins or widths
     at call sites.
   - No hand-built buttons (owner, 2026-10-26): every `<button>` lives in
     `src/components/ui`. `npm run design:check` fails on any `<button>`
     outside it (`scripts/check-raw-buttons.mjs`; absolute since P2f, no
     baseline).
   - Later: remove raw palettes from the Tailwind theme, plus a lint rule for
     unknown classes (step 7).
4. **Discoverability.** A dev-only `/design` gallery of every component and
   variant, and a "need X → use Y" table (below).

## Need X → use Y

| Need                                 | Use                                                  | Status |
| ------------------------------------ | ---------------------------------------------------- | ------ |
| Error / warning / success / info box | `AlertBox variant=… (size="sm")`                     | exists |
| Notice with a title, link or buttons | `AlertBox title` · `action` · `actions`              | exists |
| Field-level error text               | `FormError` (`useFieldError` ties it to the field)   | exists |
| Status pill                          | `Badge tone=…` (one size; `icon`, `title`)           | exists |
| Payment state (event or team)        | `PaymentStatusBadge` (`paymentStatus.ts`)            | exists |
| Button (action or navigation)        | `Button variant=… size=…` (`to` / `href` for links)  | exists |
| Arrow onward, chevron opening a menu | `Button trailingIcon`                                | exists |
| Button on a dark or gradient surface | `Button variant="on-dark"`                           | exists |
| Button filling what a row leaves     | `Button grow` (beside a count, IconButton or link)   | exists |
| Full-width button                    | `Button fullWidth`                                   | exists |
| Buttons sharing a row (Cancel, Save) | `ActionRow` (alternative first, confirm last)        | exists |
| Utility action under content         | `Button variant="neutral" size="sm"`                 | exists |
| Destructive action, not the CTA      | `TextButton tone="destructive"`                      | exists |
| Toggle, filter or info chip          | `Chip` (a row of them: `ChipGroup`)                  | exists |
| Pick one from a list (player)        | `OptionRow selected` (`actions` beside, outside tap) | exists |
| Row that jumps to a task             | `OptionRow` (`trailing` chevron)                     | exists |
| Pick one tile from a grid            | `OptionTile selected` (`muted` when done)            | exists |
| Switch between photos                | `ImageTile`                                          | exists |
| Admin acts for another player        | `useConfirmOnBehalf` before the write                | exists |
| Whole card is one link               | `CardLink` (`flush` for a full-bleed band)           | exists |
| Card link: title, subtitle, chevron  | `LinkCard` (built on `CardLink`)                     | exists |
| Sheet or dialog                      | `Modal` (`description` for a line under the title)   | exists |
| Task with more room than a sheet     | `FullScreenDialog`                                   | exists |
| Short list of choices from the side  | `Drawer`                                             | exists |
| Menu of actions                      | `Menu` + `MenuItem` (`tone="danger"`, `current`)     | exists |
| Suggestions under a search field     | `MenuList keepFocus` + `MenuItem`                    | exists |
| Underlined / inline text action      | `TextButton tone=… size=…` (`to` / `href` for links) | exists |
| Name link in a tight row             | `TextButton truncate` (`hitArea` for a 40px target)  | exists |
| Icon-only button                     | `IconButton` (always with `aria-label`)              | exists |
| Bare icon (close, back, reorder)     | `IconButton variant="ghost"`                         | exists |
| Bare icon delete / remove in a row   | `IconButton variant="ghost-destructive"`             | exists |
| Icon button on a dark surface        | `IconButton variant="on-dark"`                       | exists |
| Avatar photo upload                  | `AvatarPicker`                                       | exists |
| Empty page or tab                    | `EmptyState`                                         | exists |
| Empty list inside a card or modal    | `EmptyState variant="inline"`                        | exists |
| Signed-out viewer                    | `SignInPrompt` (`variant="inline"` in a card)        | exists |
| Admin-only page                      | `AdminRouteGuard redirectTo` (never a sign-in ask)   | exists |
| Player or team row, ranked row       | `PlayerRow` + `RankMarker`                           | P6     |
| Page section with a heading          | `Section` (on the background, not a card)            | exists |
| List of like items                   | `ListCard` + `LinkRow` (one card, divided rows)      | exists |
| List row with its own controls       | `ListRow` (`PlayerRow`, buttons, anything under it)  | exists |
| List row that is one checkbox        | `CheckRow`                                           | exists |
| Inset panel / well inside a card     | `Well` (a list inside a card: divided rows)          | exists |
| Search field                         | `SearchInput`                                        | P6     |
| Collapsible card (+ summary)         | `CollapsibleCard` (`summary` stays visible)          | exists |
| Collapsible row with reorder/delete  | `CollapsibleCard leading actions`                    | exists |
| Inline show / hide detail            | `Disclosure`                                         | exists |
| Two-to-four way choice               | `SegmentedControl` (`detail` for a second line)      | exists |
| Pick one of many (rounds, filters)   | `SegmentedControl layout="scroll"` / `"wrap"`        | exists |
| Page tabs (route or in-page)         | `PageHeader tabs` (`to` or `onClick`)                | exists |
| Loading                              | `Spinner` (`size="inline"` in a card) / `Skeleton`   | exists |
| Eyebrow / overline                   | `.eyebrow` / `.eyebrow-accent`                       | P6e    |

### Buttons and chips (owner, 2026-10-25)

- **Sizes:** `md` (40px) is the default; `sm` (32px) for dense rows; `lg`
  (52px) for a lead CTA. Button sizes its own icon, so call sites pass
  `icon={<Plus />}` with no `size`.
- **Destructive:** `Button variant="danger"` is only the confirming action of
  a destructive flow (the confirm dialog's button). A destructive action that
  isn't the screen's CTA, such as "Delete season" or "Remove player", is
  `TextButton tone="destructive"`.

- **Button:** an action that starts something or takes you somewhere.
- **Chip:** shows a filter or a piece of info. It has default (inactive),
  active and disabled states, and is often a toggle.
- **Chip or SegmentedControl** (P2f): picking one value from a set is
  `SegmentedControl`. `fill` (equal-width segments) is for two to four
  choices; `wrap` and `scroll` render `Chip`s for longer sets (rounds,
  filters, sizes). A standalone toggle, a multi-select or a link is a `Chip`
  in a `ChipGroup`. Chips are one size (32px, the height of `Button sm`) and
  selected is always teal.

### Icon buttons

- `IconButton` sizes its own icon (`sm` 14px, `md` 16px), so call sites pass
  `<X />` with no `size`. It never shrinks.
- **Filled** (`neutral`, `accent`, `success`, `destructive`): a tinted
  square, for a standalone action such as a menu, share or cancel.
- **Ghost** (`ghost`, `ghost-destructive`): a muted icon with a hover fill.
  Close, back, refresh and reorder are `ghost`; delete and remove in a list
  row are `ghost-destructive`.
- **On dark** (`on-dark`): a translucent white square for the app header and
  the merch lightbox.
- `aria-label` is also the tooltip unless `title` overrides it. `to` renders
  a router Link, `href` an anchor; a disabled one renders as a disabled
  button so it can't navigate.
- `md` (40px, the same height as `Button md`) for close and back in modal,
  panel and card headers; `sm` (32px) inside rows.
- Reorder uses `ArrowUp` / `ArrowDown`, not chevrons, so it can't be read as
  an expand toggle.

## Steps

Each step is one branch off `main` and one PR. Each PR updates this file and
the gallery, and runs `npm run design:baseline` when counts drop.

| #   | Step                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Status                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| P1  | **Tokens and migration.** Status/neutral/type/brand/shadow tokens; ui primitives and every status use moved onto them; CLAUDE.md rules; `design:check` ratchet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Done (#69)                |
| P2  | **`Button` and `TextButton`.** A `Button variant size` component replacing `.btn-*` plus overrides (about 50 `text-sm`/`py-2` overrides, 9 redundant `disabled:opacity-50`), and `TextButton` for the 10 hand-built text links. Bare icon buttons → `IconButton`. Sizes: `md` (default, `py-2 px-4 text-sm`, 40px), `lg` (today's `.btn-*`, `py-3 px-5`, 52px) and `sm` (`py-1.5 px-3 text-xs`, 32px). Unsized buttons move from 52px to 40px. The four `text-xs` buttons (PIN card "Got it" and "Set a password", swap "Apply", run-of-show actions) are `sm`.                                                                                    | Done (#70)                |
| P2b | **Ghost `IconButton`.** About 15 bare icon buttons (close X, remove, delete, move up/down, refresh, back) are a muted icon with a hover colour. Add a `ghost` variant with a proper tap target, then migrate them.                                                                                                                                                                                                                                                                                                                                                                                                                                 | Done (#72)                |
| P2c | **`ActionChip` → `Button size="sm"`.** Share and Add to calendar are actions, so they are buttons, not chips (see "Buttons and chips"). Pick the variant (likely `neutral`), migrate the two chip call sites and delete `ActionChip`.                                                                                                                                                                                                                                                                                                                                                                                                              | Done (#73)                |
| P2d | **Layout props instead of `className`.** Bring the repeated layout classes into the components. Button: `fullWidth` for `w-full` (39 uses); an `ActionRow` component for paired buttons, replacing `flex-1` (28) and fixing their order and gap; `EmptyState` spaces its own action, replacing `mt-2` (14); Button never shrinks, replacing `flex-shrink-0` (1). Then review the remaining `className` uses on `TextButton` (5) and `IconButton` (3). Once a component has no `className` callers left, consider removing the prop.                                                                                                                | Done (#74)                |
| P2e | **Zero hand-built buttons: actions.** 176 raw `<button>`s in 80 files outside `src/components/ui` (2026-10-26 inventory). Move the ~100 actions and text actions onto `Button` and `TextButton` (CTAs, accept/decline and save/cancel pairs, Sign out, Confirm, "Add question", "Reset to defaults"), and expand/collapse headers onto `CollapsibleSection` / `CollapsibleCard`. Add a lint rule banning `<button>` outside `src/components/ui`, as a per-file ratchet so the count can only go down. Depends on P2d's `fullWidth` and `ActionRow`.                                                                                                | Done (#75, #76)           |
| P2f | **Zero hand-built buttons: chips, options, menus.** New components for what's left: `Chip` (toggle, filter, selection: filter pills, sizes, rounds, divisions, lefty, gender and position), an option row / tile (player pickers, Oscars vote tiles and category grid, lightbox thumbnails) and `Menu` + `MenuItem` (event admin menu, payment method picker, status override, team search). Two-to-four way choices go to `SegmentedControl`. Card-shaped links: `CardLink` (owner, 2026-10-26). The ratchet reaches zero and the rule becomes absolute. Four PRs: chips and choices, option rows and tiles, menus, then card links and the rest. | Done (#77, #80, #81, #86) |
| P3  | **`AlertBox` size, role and dismiss; `FormError` in ui.** About 29 files build a tinted box by hand (`-light` surface with a `-border` border; triage first, as some are highlighted rows or cards rather than alerts) and about 23 lines spell a field error by hand (`text-xs text-lob-coral` / `-danger`). `AlertBox` gains `size="sm"`, a `role` (alert for errors, status otherwise) and a dismiss that is an `IconButton ghost sm` instead of the bare 14px X. `FormError` moves from `features/auth` to `components/ui`. Two PRs: alerts, then field errors.                                                                                | Done (#108, #109)         |
| P4  | **`Badge` tones** (`success`, `neutral`, `warning`, `outline`) and **payment status single source** (`paymentStatus.ts`, `PaymentStatusBadge` on `Badge`; the blue "transferred" pill and merch "delivered" get a token). About 13 hand-built status pills move onto `Badge`. Rename team-state "Confirmed".                                                                                                                                                                                                                                                                                                                                       | Done (#110)               |
| P5  | **Empty and signed-out states.** `EmptyState variant="inline"`, `SignInPrompt`; loading states: a loading card keeps its title or header, so the viewer sees what is loading, and shows `Spinner` / `Skeleton` in the body instead of `return null`.                                                                                                                                                                                                                                                                                                                                                                                               | Done (#112)               |
| P6  | **Cards for objects, lists and sections.** Owner calls 2026-10-30 (Log). A card is one thing you act on; page sections sit on the background under a heading; a list of like items is one card with divided rows; no card inside a card. Pieces: `Section`, `ListCard`, `Well` (the planned `.panel`), `Tag`, `.eyebrow`, `RankMarker` + `PlayerRow highlighted`, `RosterHeading`, `SearchInput` (#81), a heading element inside the `CollapsibleCard` header button (review of #76). Five PRs: P6a to P6e under "Next".                                                                                                                           |                           |
| P7  | **Lock-down.** Tokens for decorative colours (medal gold, avatar palette, gender marks) and for `text-[9px]` (14 uses, the bottom nav labels among them). Then switch `theme.extend.colors` to a restricted `theme.colors` so raw palette classes stop generating, and add a lint rule for unknown classes (e.g. `eslint-plugin-tailwindcss`, check ESLint 9 support). Retire the colour ratchet once the theme is locked; keep the `<button>` check.                                                                                                                                                                                              |                           |

The gallery exists: `/design` in dev (`src/features/design/DesignGallery.tsx`;
open to guests in dev only, left out of the production build). Each step adds
its components to it.

**In parallel (not design system, same principle).** The review's logic
helpers: `formatTeamName` / `fullName`, `isTeamEvent` at the 7 `entryMode`
sites, `registeredEntries`, and the King of the Court helpers (`isKingCourt`,
`placingText`, `ordinal`, `medalFor`, `useViewerKingOfCourt`).

## Next

Order of work after P2f (owner, 2026-10-28). Overlays move onto Radix
primitives (see the Log) before P3:

1. ~~**Menu choices with real input (issue #88).**~~ Fixed; see the Log.
2. ~~**Dialog focus (#84) on Radix Dialog.** `Modal` and `ConfirmDialog`
   keep their props and wrap `@radix-ui/react-dialog`.~~ Done; see the Log.
3. ~~**`Menu` onto Radix DropdownMenu.** `MenuList` for search suggestions
   stays ours until a combobox (P6 `SearchInput`).~~ Done; see the Log.
4. ~~**SwapPanel, CompareView and the Oscars drawer onto Dialog.** Each rolls
   its own Escape, scroll lock and focus today.~~ Done; see the Log.
5. ~~**E2E safety net** (owner, 2026-10-29; below). Before any more UI moves.~~
   Done in #97 and #105.
6. ~~**P3 part 1: alerts.** `AlertBox` size, role and dismiss, then the
   hand-built tinted boxes.~~ Done in #108; see the Log.
7. ~~**P3 part 2: field errors.** `FormError` in ui and the hand-built error
   lines.~~ Done in #109; see the Log.
8. ~~**P4: `Badge` tones and payment status.**~~ Done in #110; see the Log.
9. ~~**P5: empty, signed-out and loading states.**~~ Done in #112; see the Log.
10. ~~**Review the `lob-amber` text and icons.**~~ Done in #113; see the Log.
11. ~~**Card-pattern conversation** with the owner.~~ Done; see the Log.
12. ~~**P6a: `Section` and `ListCard`.** Each piece lands with its first users,
    so P6a builds the two the pilot needs: `Section` (heading and optional
    action on the background; replaces `SectionHeader` and the planned
    `CardHeader` as P6b and P6d move their users) and `ListCard` + `LinkRow`
    (one card, hairline dividers; `LinkRow` is `LinkCard`'s content as a
    row). Pilot: the Community players list.~~ Done in #114.
13. ~~**P6b: lists onto `ListCard`.** Inventory and owner calls in the Log
    (2026-10-30). Three PRs:~~
    - ~~**P6b-1: player and team rows.** Builds `ListRow` and `CheckRow`.
      Registered, Waitlist and Cancelled players, team rows, Payments,
      pending approvals, raffle eligibility.~~ Done in #116.
    - ~~**P6b-2: league.** `SectionHeader` users onto `Section`, then delete
      it; draft and manage team lists; fixtures and results as `ListCard`
      rows; standings headings.~~ Done in #118.
    - ~~**P6b-3: link lists and orders.** Seasons, Admin tools (tools and
      Needs attention), shop orders.~~ Done in #119.
14. **P6c: no card inside a card.** Inventory and owner calls in the Log
    (2026-10-30). Three PRs:
    - **P6c-1: `Well`.** Flat `lob-well` inset, no shadow (the planned
      `.panel`). The hand-built `lob-well` insets and the Playtomic panel
      move onto it. In progress.
    - **P6c-2: cards inside cards.** Run of show, Lobster Way admin, Oscars
      results, the past event's match boxes, security events; lists with a
      well or box per row (Admin tips, Oscars categories, raffle winners,
      group formation teams).
    - **P6c-3: tinted boxes inside cards.** Alerts onto `AlertBox`, the rest
      onto `Well` or plain text.
15. **P6d: sections, not cards.** Account, settings and admin tools: each
    section is a `Section` on the background, not a card.
16. **P6e: labels and the rest.** Builds `Tag` (names a thing: Court 2, Round
    3, a shirt size; `Badge` stays for states) and moves the identity labels
    onto it (about ten); `.eyebrow` and the hand-built eyebrows (about 39
    variants); `RankMarker` + `PlayerRow highlighted`, `RosterHeading`,
    `SearchInput` (#81), the `CollapsibleCard` heading element.
17. **P7: lock-down.**

### E2E safety net

Every step so far has moved UI the whole app depends on, and the unit tests
didn't catch #88 (every admin menu dead), because they don't use real input.
Before P3, an end-to-end suite has to show that the player and admin views
work and that the database behind them does.

**At the start (2026-10-29).** Two specs in `e2e/` (13 tests): `email-sign-in.spec.ts` (sign-in,
signup, password, magic link, transfer deep link, PIN interstitial, upgrade
card) and `tournament-flow.spec.ts` (one admin + player run-of-show). They run
only nightly (`e2e-nightly.yml`), and that run has failed every night since
2026-10-22, the day after PIN T₀ (#50, #51). The same two upgrade-card tests
fail each time: the card on Home never shows its "Signing in is getting
easier" or "Add your email" text. Nothing else covers events, registration,
payments, league, community, merch or any admin page. The SQL checks in
`supabase/tests/` run only when someone remembers to run them.

**Scope.** Two PRs: #97 (everything but the admin views), then the admin
views off `main` once #97 merges.

1. **Green first.** Find out why the upgrade card doesn't show (a test that
   no longer matches the T₀ behaviour, or a real bug), and fix the test or
   the app. The nightly is green before anything is added. Done (#97); see
   the Log.
2. **Seed** (owner, 2026-10-29: "do what is best practice"). A synthetic
   `seed.sql` replaces the July copy of production, which named real players
   in a public repo and had no league, team event, shop or Oscars. Done
   (#97).
3. **Fixtures.** Shared helpers in `e2e/fixtures/`: the seed's IDs, a saved
   session per role, a second browser for another account, throwaway events
   and players, and cleanup that leaves nothing behind. Every page fails its
   test on an uncaught or console error. Done (#97).
4. **Player views and flows.** Every page signed out and as a player, from
   seeded data; and what a player writes, read back from the database:
   register, pay by Tikkie, transfer a spot and accept it, sign up a pair and
   accept the invite, order from the shop, edit the profile. Done (#97).
   Cancelling a registration and entering scores (league and event) are
   admin-only, so they move to step 5.
5. **Admin views.** Admin, event Manage (create an event, add a player and a
   team for someone else through the on-behalf confirm, Mark Paid through the
   menu, cancel a registration, enter a score), league Manage (enter a score),
   shop items, Lobster Way admin. A player can't reach any of them (the
   player spec checks the gates). Done (PR 2); see the Log.
6. **Database.** `npm run db:test` runs `supabase/tests/` in the e2e job, and
   the specs read back each write through the database. Done (#97).
7. **Real input.** Menus, dialogs and confirms are driven with Playwright's
   real clicks and key presses, never `dispatchEvent` or a scripted
   `.click()` (the lesson from #88).
8. **Docs.** CONTRIBUTING.md: the seed, `db:test`, and how to run and extend
   the suite. Done (#97).

Not in scope: visual snapshots, and coverage of every edge case the unit
tests already hold. The aim is that a broken page or a broken write fails
the suite, not exhaustive behaviour.

**When it runs** (owner, 2026-10-29). On every PR that touches `src/`,
`supabase/`, `e2e/` or the dependencies, as well as nightly (`e2e.yml`), as a
trial: measure what it adds to a PR before choosing between the full suite and
a smoke subset. The nightly job took about 4–5 minutes, most of it starting
Supabase.

Feature bugs found along the way are GitHub issues, outside this plan:
#82 (Lobster Way open question after a reorder), #83 (Admin "unpaid
registrations" row opens merch), #89 (the confirm dialog drops the
on-behalf message's line breaks), #95 (the Oscars view switch drops focus),
#98 (the Oscars results fetch fires with an empty ID), #99 (shop orders
failed in production; fixed in #101), #100 (a double-tapped Order shows a
failure), #102 (table grants differ between production and local), #103 (form
labels not tied to their inputs) and #104 (the payment sheet after an admin
adds someone doesn't name them; fixed in #106). Each is a small PR whenever
it suits.

## Later

- **Colour pairings** (owner, 2026-10-26). Document which foregrounds and
  fills may sit on which surfaces, so a component can't pick a pair that
  doesn't read. Prompted by #72's review: the `ghost` hover fill (`lob-line`)
  is nearly invisible on `lob-well` rows.

- **Radix out of first paint** (review of #90). Radix Dialog adds about 13
  KB gzip to first paint, because `ConfirmProvider` and
  `PinSignInInterstitial` (both in the entry chunk) use `Modal`. After the
  PIN cutover (5 November) removes the interstitial, lazy-load the confirm
  sheet and re-measure with a `localdev` build.

## Open owner calls

- None.

## Log

- **2026-10-24.** Plan written. Owner calls: `danger` is its own red (not
  `lob-coral`); `warning` replaces `lob-amber` for status; card shadows from
  `lob-dark`; P1 does the full app-wide migration. 753 token uses after P1;
  129 raw palette classes left (decorative and categorical), held by the
  ratchet.
- **2026-10-24.** Owner calls: `text-[11px]` folds into `text-xs` (done in
  P1); `AlertBox` `info` moves to `lob-info` (sky) so it differs from the
  brand teal (done in P1); loading cards keep their title (P5); revisit the
  card-heavy layout later.
- **2026-10-25.** P2 built on `design-button` (#70). `Button` (`primary`,
  `secondary`, `neutral`, `danger` × `sm`, `md`, `lg`) replaces every
  `.btn-*` use (95 sites), and the `.btn-*` classes are gone from
  `index.css`. `neutral` is new: the grey "quiet alternative" button
  hand-built in the sign-in form and PIN upgrade card. All variants carry a
  2px border so mixed pairs match height. `TextButton` replaces 20 hand-built
  text links, which are now always underlined (some were hover-only, so
  invisible on touch). Icon buttons split out to P2b. The dotted-underline
  "explain" links in matchmaking stay as they are.
- **2026-10-25.** Owner review of #70. Consistency over preserving earlier
  sizes: the old designs carried no real intent, and odd spots get fixed
  later. `md` (40px) is the default, so every button that was 52px or
  `py-2.5` is now 40px; the four former `text-xs` buttons are `sm` (32px).
  `danger` deepens to red-700 so it reads apart from coral, and is kept for
  the confirm dialog: "Delete season" and "Remove player" become destructive
  `TextButton`s. Buttons vs chips defined (above), so `ActionChip` becomes a
  `Button` (P2c). Disabled buttons drop their hover styles, and a disabled
  `TextButton` is muted instead of half-opacity.
- **2026-10-26.** Owner: red-700 `danger` still sat too close to coral, so
  it moves to a deep crimson (`#9B1C31`, hover `#7A1526`). This shifts every
  `-solid`, `-strong` and danger text use app-wide, which is intended.
  `TextButton`: `to` is in-app router navigation, `href` is a same-tab
  anchor, and `external` opens a new tab.
- **2026-10-26.** Owner: repeated layout classes on ui components should be
  brought into the design system as props or layout components (P2d).
  CLAUDE.md asks for `className` to stay layout-only and sparing.
- **2026-10-26.** P2b built on `design-icon-button`. `IconButton` gains
  `ghost` and `ghost-destructive`, sizes its own icon like `Button`, never
  shrinks, and has a disabled state with no hover. 21 bare icon buttons move
  onto it (close, back, refresh, reorder, delete, remove), up from the 15
  estimated; the merch "cancel order" icon becomes a filled `destructive`
  `IconButton`. Delete-tip buttons in Admin were hover-only (invisible on
  touch) and now always show. Lobster Way reorder goes from a stacked pair
  to side by side, and both it and King of the Court reorder use arrows. The
  matchmaking "reset to preset" icon becomes a `TextButton` "Reset", since a
  32px box would make the slider row jump when "overridden" appears. Icon-only
  buttons left hand-built (password eye, rating stepper, avatar camera,
  image-remove badge, lightbox close) all now carry an `aria-label`.
- **2026-10-26.** Owner review of #72: `IconButton md` grows from 36px to
  40px so it matches `Button md` beside it. `Button lg` (52px) stays with no
  call sites, so a future lead CTA has a size ready rather than someone
  inventing one.
- **2026-10-26.** Owner: no hand-built icon buttons. The ones #72 had left
  move onto `IconButton`: password eye (`ghost sm`), rating stepper
  (`neutral md`), image-remove badge (`destructive sm`), lightbox close and
  the header help and Instagram links (new `on-dark` variant; `IconButton`
  gains `to`). The avatar camera, copied in three forms, is now one
  `AvatarPicker` with an `accent sm` camera button. `aria-label` doubles as
  the tooltip, and a disabled `href` / `to` no longer navigates. The dismiss
  X in alert boxes stays for P3, and the header's WhatsApp text link for the
  hand-built buttons audit.
- **2026-10-26.** P2c built on `design-action-chip`. `ActionChip` is gone.
  `Button` gains `to`, `href` and `external` (the `TextButton` API; a
  disabled link renders as a disabled button), so the calendar action stays
  an anchor for iOS Safari. Its hover and press styles move from `enabled:`
  to a `not-disabled:` variant (Tailwind v4's name, added in
  `tailwind.config.js`), since `:enabled` never matches a link. Share and Add
  to calendar `chip` → `compact`, a `neutral sm` Button. The payment sheet's
  "Add to Google Calendar" becomes a full-width `secondary` Button, and
  Share's unused `full` variant is removed. The admin PII controls also used
  the chip: "Show contact details" is a `neutral sm` Button; "Show email"
  (inline in a row subtitle), "Hide" (in the "Admin only" header) and "Try
  again" (in a warning box) are `TextButton`s.
- **2026-10-26.** Review of #73. The `to` / `href` / `external` handling,
  copied in `Button`, `TextButton` and `IconButton`, moves into one
  `renderAction` (`components/ui/action.tsx`). All three now share the API
  (`IconButton` callers drop `target` / `rel` for `external`), and a disabled
  link renders as a button without anchor-only attributes. Owner: no
  third-party brand colours on buttons, fewer special cases. The three Tikkie
  pay links (payment sheet, /me pay prompt, admin Payments) become primary
  `Button`s, the "I've sent the payment" pair becomes `secondary`, and the
  `tikkie` token is gone. The same goes for WhatsApp: the admin Payments
  "Remind" button is a `neutral sm` Button and the `whatsapp` token is gone.
  The root `DESIGN_SYSTEM.md` button section still described `.btn-*` and
  `ActionChip`; it now points at the components.
- **2026-10-26.** Owner: no hand-built buttons, and stop listing them as
  follow-ups; take the count to zero. The "Later" audit becomes P2e (actions
  onto `Button` / `TextButton`, plus a lint ratchet on `<button>` outside
  `components/ui`) and P2f (`Chip`, option row / tile, `Menu`), after P2d.
  The inventory found 176 raw `<button>`s in 80 files, not the ~50 files
  estimated.
- **2026-10-26.** P2d built on `design-layout-props`. `Button fullWidth`
  replaces `w-full` (42 sites). `ActionRow` (`flex gap-2`, children at equal
  width) replaces the 15 `flex-1` rows, including `ConfirmDialog`, so every
  pair has the same 8px gap (three league forms had 12px) and puts the
  alternative first. A button beside a text action (Edit / Remove, Save /
  Reset to defaults) is an `ActionRow` too, not a `fullWidth` button in a
  row. "Button never shrinks" is dropped: a flex item already can't shrink
  below its longest word, and `shrink-0` made long labels overflow narrow
  rows instead of wrapping (review of #74). `EmptyState` spaces
  its action, replacing 12 `mt-2`s. Owner: a component never adds its own
  spacing; the layout component or parent places it. So the remaining
  margins move to their parents too (TransferAccept's cards, ManageTeams'
  "Assign Groups" via `space-y-3`, the "(invite)" link via a space), and
  `className` is removed from `Button`, `TextButton`, `ShareWhatsAppButton`
  and `AddToCalendarButton`. `IconButton` keeps it for its four
  absolutely positioned overlays (password eye, image remove, lightbox and
  description close). The compact `EmptyState` in LinkPlayerModal
  (`py-6`) waits for P5's `variant="inline"`.
- **2026-10-26.** P2e part 1 on `design-buttons-actions-1`. `design:check`
  gains a `<button>` ratchet (`scripts/check-raw-buttons.mjs`); both checks
  share `scripts/lib/ratchet.mjs`. 71 actions move onto `Button`,
  `TextButton` and `ActionRow` in auth, settings, shared components,
  community, events and home (175 → 104). The mapping: filled CTA →
  `Button`; outlined → `secondary`; grey or tinted small action → `neutral
sm`; text-only action and back links → `TextButton`; Sign out and Cancel
  offer → `TextButton tone="destructive"`. Brand-coloured CTAs (success
  green "Accept", warning orange "Go to sign in", teal "Back to home") become
  primary. Accept / decline pairs, "Resend WhatsApp" + "Cancel offer" and
  the next-event links are `ActionRow`s. Left for P2f: filter and round
  tabs, menus, option rows, chips, title links, the swap-mode toggle and the
  on-dark banner button. Left for P3: the error-banner and notice dismiss
  X. Left for part 2: expand/collapse headers (ProfileSection, Cancelled)
  onto `CollapsibleCard`, which needs an always-visible summary slot, and
  "Next unscored match →", which needs a trailing icon.
- **2026-10-26.** Review of #75. `ActionRow` holds `Button`s only: a
  `Button` with a text action beside it is a `justify-between` row, so the
  text action keeps its natural width. The transfer pairs, copied in four
  places, become `TransferResponseActions` (Decline `neutral`, then Accept)
  and `OutgoingTransferActions` (Resend WhatsApp, then a destructive
  "Cancel offer") in `features/events/TransferActions.tsx`. The admin
  transfer panel follows the same pattern. A lead CTA beside smaller links
  (next-event Registrations) fills what they leave rather than taking an
  equal share. The email "Change" button is `md`, the height of the field
  beside it.
- **2026-10-26.** P2e part 2 on `design-buttons-actions-2` (104 → 70). League,
  Lobster Way admin, merch, Lobster Games, past events and raffle actions
  move onto `Button` / `TextButton` / `ActionRow`. The Lobster Games start
  and end CTAs and the raffle eligibility Save are `lg`, the first real use
  of the lead-CTA size. The merch "Cancel Order" modal action is `danger`,
  as it confirms a destructive flow, and the matchmaking "Discard scores &
  save" pair puts Cancel first. `CollapsibleCard` gains `summary`
  (content that stays visible while collapsed), and the My Lobster Profile
  card and Cancelled list move onto it. New `Disclosure` (chevron + label,
  `aria-expanded`) replaces the three identical inline toggles in
  matchmaking (Advanced, Details, match breakdown). Left for P2f: everything
  that is a chip, tab, menu, option row or tile, the card-shaped links, the
  raffle's decorative controls and the Lobster Way admin row headers, plus
  the dotted "explain" links in matchmaking, which stay as they are.
- **2026-10-26.** Owner calls for P2f's card-shaped links: event titles in
  `NextEventCard` and `UpcomingEventCard` become plain headings, since each
  card's Registrations button already goes there; `LeagueDashboardCard`
  becomes a real link through a new `CardLink` primitive that `LinkCard`
  is rebuilt on; `ChampionBanner` team names are underlined `TextButton`s.
- **2026-10-26.** P2f part 1 on `design-chips` (70 → 46). New `Chip`
  (toggle, filter or link pill, 32px, `selected` sets `aria-pressed`,
  optional `count`) and `ChipGroup` (`wrap` or `scroll`). `SegmentedControl`
  loses `size`, `shape` and `className`: `fill` stays the equal-width
  segment row and `wrap` / `scroll` now render `Chip`s, so round strips,
  manage sections and the war-cry prompts all share the chip look. Options
  gain `detail` (second line, e.g. TeamForm's "3 teams · suggested" and the
  rating review levels), `count`, per-option `disabled` and boolean values.
  Gender, playing hand and preferred side, copied in signup, settings and
  the admin player form, are one `ProfileChoiceFields`. Playing hand is now
  a Right / Left choice instead of a "Tap if left-handed" toggle, and
  preferred side is teal like every other choice (it was blue). `PageHeader`
  tabs take `onClick` as well as `to`, so the division pills and the Lobster
  Way jump links are header tabs and `tabStrip` is gone. The matchmaking
  `segmentedButtonClass` helper is gone (presets, lefty rule, compare
  rounds). Payments filter pills lose their per-status active colours, and
  the merch size picker no longer turns its borders red when no size is
  picked: the "Please select a size" line already says so.
- **2026-10-28.** Owner: admins keep full control to act for other players,
  but the UI must make who they picked unmistakable. An admin registering the
  women's KotC team picked the wrong captain; the server allows it by design
  (`register_team_for_tournament` only requires admin when the captain isn't
  the caller). Rule added to CLAUDE.md. `useConfirmOnBehalf` wraps
  `useConfirm` and `AdminAddTeamCard` uses it. Follow-ups, each checked
  against the rule: the individual-event admin add, admin partner swap,
  admin payment marking.
- **2026-10-28.** The other admin-on-behalf flows follow the rule (#78
  follow-up): individual-event add, admin partner change, admin transfer of
  a spot (both the offer and the immediate path) and payment marking (Mark
  Paid, Undo, status override). `useConfirmOnBehalf` takes an optional
  `footer` so payments check the payment rather than "the right person".
  Already confirming before this: cancel registration, cancel team,
  force-accept and cancel transfer. Not confirmed, as they pick nobody:
  promoting a waitlisted player or team. Payment marking adds one tap per
  payment; revisit if admins find it slow in bulk.
- **2026-10-28.** P2f part 2 on `design-option-rows` (46 → 31). New `OptionRow`
  (title, subtitle, `leading`, `trailing`, and `actions` that sit beside the
  row outside its tap target; `selected` tints it `lob-teal-light` with a
  teal border and a check, and sets `aria-pressed`) and `OptionTile` (grid
  tile, same selected look; with no handler it is a read-only tile), plus
  `ImageTile` for the merch lightbox thumbnails (teal border on the current
  photo, named "Photo 2 of 3"). `AddPlayerCard` now reuses the team
  `PlayerPicker` (moved up to `registration/`), so the admin add gets the accent-folding name search and
  avatars, and `getAvailablePlayers` loses its `search`. `LinkPlayerModal`
  candidates and the Admin "Needs attention" rows are `OptionRow`s; the Oscars
  vote tiles and category grid are `OptionTile`s. A voted category is a
  `muted` tile (grey well). Row titles wrap rather than truncate, so a
  "Needs attention" line is never cut off. `CollapsibleCard` gains `leading`
  and `actions` slots outside the toggle, and loses `headerClassName` and
  `chevronClassName` (its header always has `gap-3`). The Oscars stat rows
  (the progress bar stays inside the toggle) and results, and the Lobster Way admin category
  and question rows, move onto it. A shared `plural` (`src/lib/plural.ts`)
  replaces the run-of-show copy. Review of this PR: Lobster Way questions are
  keyed by index while each keeps its own open state, so reordering leaves a
  different question open (older bug, #82).
- **2026-10-28.** P2f part 3 on `design-menus` (31 → 24). New `Menu` (the
  trigger is a render prop that spreads `aria-haspopup`, `aria-expanded` and
  `onClick` onto a `Button` or `IconButton`; the panel is a `role="menu"` named
  by `label`, shown as a heading with `showLabel`), `MenuItem` (icon, `hint`
  line, `tone="danger"`, and `current`, which disables the item and marks it
  "· current") and `MenuSeparator`. A menu closes on Escape and after a choice
  (focus returns to the trigger), on a tap outside (the transparent backdrop
  the old menus used) and on Tab. It focuses the first item on open, and the
  arrow keys, Home and End move between enabled items. `MenuList` is the panel
  on its own, for suggestions under a search field: `keepFocus` keeps the
  input focused when an item is tapped (replacing `onMouseDown` +
  `preventDefault`). Migrated: the event admin menu, the Payments method
  picker and status override, and the TeamForm player search. The search also
  gains Escape, ArrowDown into the list, and closing when focus leaves the
  field (it stayed open when tabbing on to the second picker); its "Create
  placeholder" item has a `Plus` icon under a separator. All menus share one
  look (`rounded-xl`, 40px `font-semibold` items), so the payment menus move
  from `font-medium` and the admin menu from `rounded-2xl`. The Oscars admin
  drawer's choices are `OptionRow selected` (its check replaces "· current"),
  its backdrop is a plain overlay, and Escape closes it.
- **2026-10-28.** Review of #81. Escape is handled inside the menu and stops
  there, so a menu in a panel that also closes on Escape (SwapPanel,
  CompareView, the Oscars drawer) no longer closes both. The menu closes and
  refocuses its trigger before the item acts, and finds the trigger from the
  click rather than a DOM query. `MenuList` places `MenuSeparator`'s margin,
  since a ui component carries no spacing. The TeamForm search returns focus
  to the input after Escape or a choice from the keyboard, focuses the first
  item on the first ArrowDown even while closed, and reports `aria-expanded`
  only while a list shows. The Oscars drawer moves focus to its close button
  on open and back to "Menu" on close. Older bug, #84:
  `ConfirmDialog` doesn't move focus into itself, so after a keyboard choice
  that opens a confirm, Enter on the focused control behind it fires again.
  The search suggestions use `role="menu"`; a full combobox / listbox pattern
  would suit them better if a `SearchInput` (P6) takes them on.
- **2026-10-28.** P2f part 4 on `design-card-links` (24 → 0). The `<button>`
  rule is now absolute: `check-raw-buttons.mjs` fails on any `<button>`
  outside `src/components/ui`, and `raw-buttons-baseline.json` is gone
  (`design:baseline` only updates the colour baseline). New `CardLink`: a
  whole card that is one link or action, `layout="row"` for the centred
  row, `flush` for a card with a full-bleed band. `LinkCard` is rebuilt on
  it and `LeagueDashboardCard` is a real link now (its `shadow-md` becomes
  the card shadow). `Button` gains `trailingIcon` ("Next unscored match →";
  the payment menu's "Mark Paid ▾" is now a `ChevronDown`) and an `on-dark`
  variant (the completed-event banner, the raffle's "Manage eligibility").
  Owner calls applied: the event titles in `NextEventCard` and
  `UpcomingEventCard` are plain headings, and the `ChampionBanner` team names
  are `TextButton`s. For the same reason as the titles (Registrations sits
  just below), "Not signed up yet — tap to join" is now a status pill with
  no action. The admin pending-transfer callout is a warning `AlertBox` with a
  "Review" `TextButton`; the court "Book" pill and the matchmaking "Fix",
  "Show all swaps" and swappable player names are `TextButton`s (solid
  underline; the dotted style is gone, and the names keep their 40px rows).
  The ScoreEntry conflict pill is a warning notice with a "use" `TextButton`.
  The event error banner and `TeamNotices` are `AlertBox`es with `onDismiss`
  (P3 gives that X a proper tap target). Merch: "Order" is a primary `Button`,
  and after ordering an "Ordered!" line replaces it; "Mark Paid" / "Mark
  Delivered" are `neutral sm` Buttons. Raffle: the draw is a `lg` primary
  `Button`, the prize count a `SegmentedControl` on a white inset (a teal
  selection doesn't show on the teal hero), and the prize editor a
  `TextButton`. Five one-digit choices use `fill`, against the "two to four"
  guide, because they fit as equal segments. 107 raw colour classes remain
  (was 114).
- **2026-10-28.** Review of #86. `TextButton` gains `truncate` (one line with
  an ellipsis, shrinks in a flex row), `hitArea` (padding with a matching
  negative margin, so a lone small action gets a 40px tap target without
  moving the layout) and `size="lg"`. The swappable player names truncate
  again and keep their 40px target, so long names no longer push the gender
  marks out of the row; the matchmaking "Fix" links and the score-conflict
  "use" get `hitArea`; the champion name is `lg` and truncates. `Button`
  gains `grow` (`flex-1`), replacing the five `<div className="flex-1">`
  wrappers around a `fullWidth` Button (next-event Registrations, Oscars "Add
  category", merch Order, Mark Paid / Mark Delivered). A finished merch order
  step shows a green "✓ Paid" / "✓ Delivered" line instead of a greyed-out
  disabled button. `CardLink flush` is `card p-0 overflow-hidden` rather than
  a copy of `.card`, and a disabled `CardLink` dims and doesn't animate. The
  next-event "You're registered!" and "Not signed up yet" pills are `Badge`s.
- **2026-10-28.** Docs refresh after P2f. The root `DESIGN_SYSTEM.md` still
  showed hand-built tabs, empty states, section toggles and spinners, raw
  10px sizes and a "status colours may stay raw" exception. It is now a short
  conventions page that points here, to TOKENS.md and to `/design`, and states
  the CI rules. TOKENS.md gains the brand and text tokens (from the old root
  table) and an up-to-date "still raw" list: the blue "selected" toggles are
  gone, and the blue Playtomic-level panel, copied three times, is listed.
  Steps P3, P4, P6 and P7 are re-counted from the code. `ProfileFields`
  preferred side leaves P6, since P2f part 1 already made it a
  `SegmentedControl`. New "Next" section with the proposed order.
- **2026-10-28.** Owner: dialog focus (#84) first, then P3 as two PRs (alerts,
  then field errors), each started after the previous one merges.
- **2026-10-28.** Browser testing the dialog focus PR (#90) found #88: no
  `Menu` choice made with a real tap or key did anything, so every admin menu
  (event admin menu, "Mark Paid", the status override) was dead. `MenuList`
  closed the menu in the click capture phase. A real tap runs microtasks
  between the capture and bubble listeners, so React unmounted the item
  before its `onClick` ran. `fireEvent` and a scripted `.click()` don't, which
  is why the tests passed. Fixed on `menu-select-fix`: the menu closes in
  the bubble phase, after the item acts, and refocuses its trigger unless the
  item moved focus somewhere itself (a field it revealed). A dialog the item
  opens still returns focus to the trigger, since the dialog reads focus when
  it renders, after the click. The new test flushes React at the target to
  stand in for a real tap, and fails if closing moves back to the capture
  phase. Keyboard selection has no separate test: Enter on a menu item fires
  the same click. Browser checks of menus and dialogs use real taps and key
  presses, not scripted clicks. Radix DropdownMenu (step 3 of "Next")
  replaces this code.
- **2026-10-28.** Owner: overlays use an established library rather than our
  own focus code, since #88, a TeamForm Escape regression and an unhandled
  focus case all came from hand-rolled overlay code in one day. Radix
  primitives (`@radix-ui/react-dialog`, `react-dropdown-menu`), installed from
  npm and wrapped in `src/components/ui` so feature code keeps today's API.
  Not shadcn/ui, which copies styled components into the repo. Considered:
  Base UI (same founding team, has a combobox, 1.0 in December 2025), React
  Aria (heavier API), native `<dialog>` (Chrome ignores a cancelled Escape
  without a fresh user activation, so a non-dismissible form could close).
  Measure the first-paint bundle when Dialog lands, since `ConfirmProvider`
  is mounted at the root.
- **2026-10-28.** Dialog focus (#84) on `dialog-focus`, on Radix Dialog.
  It replaces the hand-rolled version first opened in #90 (focus guards and
  our own Tab wrap), which never merged. `Modal` keeps its props and wraps
  `@radix-ui/react-dialog`. Radix traps Tab, hides the page behind from
  assistive tech, locks scroll, and handles a dialog opened from inside
  another: Escape and outside taps reach only the top one, and the outer
  sheet's trap pauses. The sheet renders in a portal on `<body>`. What stays
  ours (`components/ui/dialogFocus.ts`):
  - **First focus:** the child marked `data-autofocus`, otherwise the sheet
    itself, not the first field, which would pop the keyboard on a phone.
    React's `autoFocus` still works (the link-player and transfer searches),
    except in a dialog opened from inside another, where the outer trap pulls
    focus back first. So `ConfirmDialog` uses `data-autofocus`.
  - **Return focus:** to whatever had focus when the sheet opened, unless
    focus has moved elsewhere since. Radix only returns it to a
    `Dialog.Trigger`, and our dialogs open from code.
  - **Escape:** Radix hears it on the document before anything inside. An
    open popup in the sheet (a `role="menu"`, or a field with `aria-haspopup`
    and `aria-expanded="true"`, like the TeamForm search) closes first.
    Otherwise Escape stops at the sheet, so SwapPanel, CompareView or the
    Oscars drawer behind stays open, and it closes the sheet only when
    `dismissible`. Escape during IME composition is left alone. The TeamForm
    search stops the Escape that closes its list.

  `ConfirmDialog` is an `alertdialog`, named by its message when it has no
  title (27 of 29 confirms) and described by it otherwise. It focuses
  Confirm, so Enter confirms, but Cancel in a destructive flow, so a stray
  Enter can't delete. A confirm that follows another while the dialog stays
  open moves focus to its own default button. A backdrop tap on a
  non-dismissible sheet keeps focus in it. Radix adds about 13 KB gzip to
  first paint (196.7 → 209.8 KB, measured with a `localdev` build), since
  `ConfirmProvider` and `PinSignInInterstitial` (both in the entry chunk) use
  `Modal`. Browser testing also found #89
  (on-behalf confirm messages lose their line breaks).

- **2026-10-28.** Review of the Radix dialog PR. A tap on a toast (its
  dismiss X) no longer closes the sheet, and the toast viewport is always a
  live region (`data-toast-viewport`), so Radix's `aria-hidden` on the page
  skips it and toasts are still announced while a sheet is open. Escape during
  IME composition stops at the sheet too. A menu trigger no longer counts as
  an open popup for Escape, only a menu or a search field with its list
  showing. `Modal` gains `labelId` (a heading inside names the sheet; the
  payment sheet uses it) and `focusKey` (moves focus as on open again, so
  `ConfirmDialog` drops its own focus effect). The opener is read in a layout
  effect rather than during render: the portal mounts the sheet in the next
  render, so the opener still has focus then. Clicks inside the sheet stop at
  it, since React events bubble from a portal to whatever renders `Modal`.
  Escape now closes every dismissible sheet, as a backdrop tap already did.
- **2026-10-28.** Owner: sheets stay dismissible by default, Escape included,
  so the long forms that are dismissible today (`EventFormModal`, Add / Edit
  Team, score entry, Invite Player) keep closing on Escape and a backdrop tap.
  CI caught an unhandled error from the drag-to-dismiss tests: Radix's scroll
  lock (`react-remove-scroll`) reads `changedTouches`, which the test touch
  events left out. The tests now fill it in, as a browser does.
- **2026-10-28.** Checkpoint after #90 and #91. DESIGN_SYSTEM.md gains an
  "Overlays" section (`Modal`, `useConfirm`, `data-autofocus`, `dismissible`,
  `labelId`, real-input browser checks). "Later" gains the first-paint
  follow-up for Radix. Next is step 3, `Menu` onto Radix DropdownMenu.
- **2026-10-28.** Step 3 on `menu-radix`: `Menu`, `MenuItem` and
  `MenuSeparator` keep their API and wrap `@radix-ui/react-dropdown-menu`,
  so the event admin menu, "Mark Paid" and the status override are
  unchanged at the call site. What changes and what stays ours:
  - **Trigger.** Radix needs the trigger's DOM node, and `Button` /
    `IconButton` don't forward refs, so `Menu` reads it through a
    `display: contents` wrapper (the trigger render returns one element).
    A mouse opens the menu on press, as Radix does; touch and pen open it on
    the click, since a finger landing on a trigger may be starting a scroll
    (review). Enter, Space and ArrowDown open it too. From the keyboard the
    first item takes focus; from a tap, the menu itself does.
  - **Choosing.** The item's action runs after the menu has closed and focus
    is back on the trigger. So the on-behalf confirm from "Mark Paid" gets
    focus and returns it to "Mark Paid", and an item that focuses a field
    keeps it there. The action runs a tick after the tap, outside the click,
    so an item that needs the click itself (a file picker, `navigator.share`)
    would need another way. Radix moves arrow-key focus in a timeout, so keys sent
    within a millisecond (a script, not a person) act on the previous item.
  - **Keys.** Arrows wrap (`loop`), Home and End jump, and typing a letter
    jumps to the matching item (new). Tab no longer closes the menu: Radix
    keeps focus in an open menu, and Escape or a choice closes it.
  - **Escape.** A menu is a Radix layer above the sheet, so in a `Modal` it
    takes Escape first without `escapeIsForPopup`, which now only covers
    `MenuList` and the TeamForm search field. `Menu` stops the key, so
    SwapPanel, CompareView and the Oscars drawer (`window` listeners) stay
    open.
  - **Outside taps.** The page behind is inert while a menu is open; a tap
    outside only closes the menu.
  - **`MenuList`** is the TeamForm search list only: it loses `align`,
    `showLabel`, `keepFocus` (now always on), `autoFocus`, `onItemSelected`,
    `onEscape` and `onTab`, which only `Menu` used. `menuFocus.ts` stays
    whole, since `MenuList` and TeamForm use all of it. `MenuItem` is a Radix
    item inside a `Menu` (which provides it through `menuShell.ts`) and a
    plain button inside a `MenuList`. `MenuItem`, `MenuList` and `Menu` are
    separate files, so the TeamForm search doesn't load Radix (review).

  First paint is unchanged: 210.5 → 210.6 KB gzip (`localdev` build, the
  files index.html loads; main measured 210.5 KB with the same script, the
  #90 entry's 209.8 used a different sum). The lazy `Menu` chunk grows from
  1.6 to 19.2 KB gzip (Radix Menu, Popper, floating-ui), plus a 0.8 KB
  `MenuItem` chunk. Every event page loaded `EventAdminMenu`, so its menu
  now lazy-loads for admins only (`EventAdminTools`; the same trigger shows
  disabled while it loads). Manage → Payments loads the chunk, as an admin
  page; league manage doesn't. Review of this PR: no lazy chunk in the app
  recovers from a failed load (a stale deploy blanks the screen); older
  than this PR, #93.

- **2026-10-28.** Step 4 on `panels-dialog`. Owner: a shared Radix base that
  `Modal` and new shape components build on, rather than a placement prop on
  `Modal`. `DialogShell` (`components/ui/DialogShell.tsx`) holds what `Modal`
  did (first focus, return focus, Escape, outside taps, toasts as inside,
  `labelId`, `focusKey`) and the header, body and footer, with one class map
  per shape:
  - **`Modal`**: the bottom sheet, unchanged apart from the shell. It keeps
    drag-to-dismiss and the handle.
  - **`FullScreenDialog`**: CompareView. A white screen that scrolls as a
    whole, with header, body and footer in a `max-w-2xl` column.
  - **`Drawer`**: the Oscars admin menu, from the right (`w-72 max-w-[85%]`).
    A backdrop tap closes it.
  - All three take `description` (a line under the title, which also describes
    the dialog). `FullScreenDialog` and `Drawer` close with an X in the header
    (`IconButton ghost`, "Close"); the sheet has its handle instead.

  SwapPanel becomes a plain `Modal`, so it is a bottom sheet on desktop too
  rather than a centred card, and loses its X (Cancel, Escape, a backdrop tap
  and a drag still close it). Each panel's status line moves inside the
  dialog, where Radix's `aria-hidden` doesn't reach it. Visual shifts, all
  onto the shared shape: headers use the sheet's title style and `px-5`
  padding, the drawer's backdrop darkens to the sheet's `black/60` and its
  header loses `pt-12`, and the drawer opens with focus on itself rather than
  on its X. `useEscapeToClose` and `useBodyScrollLock` are deleted, since
  nothing else used them. With no `window` Escape listeners left, `Menu` and
  the shell stop calling `stopPropagation` on Escape: Radix gives the key only
  to the top layer. `escapeIsForPopup` stays whole, for `MenuList` and the
  TeamForm search, which aren't Radix layers. First paint: 210.6 → 210.9 KB
  gzip (`localdev` build).

  Review of this PR. The matchmaking error alert and status line sit on the
  page, which is now hidden from assistive tech behind the dialog, so
  CompareView and SwapPanel show the error inside (an `AlertBox`), and
  CompareView announces the container's status, so "Regenerate alternative"
  is announced again. Opening Compare clears an older error. SwapPanel isn't
  dismissible while a swap query runs, as its Cancel already wasn't, since the
  query would reopen it. The shapes' differences live in one `SHAPES` record.
  Browser testing (real clicks and keys) on /design, SwapPanel and CompareView
  in the schedule, and the Oscars drawer passed every check: focus in and
  back, Tab kept inside, Escape and backdrop taps, a sheet, menu or confirm
  inside closing alone, the status lines announcing, the page behind not
  scrolling. Choosing a view in the Oscars drawer drops focus to the page,
  since the view switch remounts the "Menu" trigger; that was so before, and
  is #95. One failure showed only when a scripted page evaluation (the browser tool's
  JavaScript step) ran between closing a menu inside a dialog and the next
  tap: Radix then kept the menu's layer, and a confirm opened next lost Escape
  to the dialog behind. It happens with `Menu`'s old `stopPropagation` too, and
  never with real input alone.

- **2026-10-29.** #96 merged. Owner: an end-to-end safety net comes next,
  before P3, so the player and admin views and the database are known to work
  before more UI moves. The nightly e2e run has failed since 2026-10-22 (two
  upgrade-card tests in `email-sign-in.spec.ts`), and the suite covers only
  sign-in and one run-of-show. Scope in "E2E safety net".
- **2026-10-29.** Owner: run the e2e suite on every PR as a trial and measure
  the time it adds. `e2e-nightly.yml` is now `e2e.yml`, on pull requests that
  touch app code, the database, the specs or the dependencies, as well as
  nightly. Newer pushes to a PR cancel its running job. The two failing tests
  had never passed in CI: they were added in #51 the day before. Their sign-in
  helper clicked "Sign in" and went straight to Home. On a slow runner that
  navigation landed before the session was stored, so Home showed signed out
  with no card. The helper now waits for the sign-in form to close. Locally
  they passed, as the warm dev server signs in faster.
- **2026-10-29.** E2E PR 1 on `e2e-suite` (#97): 13 tests → 40, plus the
  database tests. What changed:
  - **Seed.** Synthetic, about 30 made-up players with fixed IDs: an upcoming
    and a finished individual event (results and Oscars shared), a team event,
    a King of the Court, a league in its group stage, shop items. Sign-in
    accounts are `admin@` and `player@lobsters.test`; the sign-in specs get
    their own accounts, since they change auth state.
  - **Fixtures.** One `signIn` (it was copied in two specs, one copy with the
    race above), a saved session per role (`auth.setup.ts`), `openAs` for a
    second account, `createEvent` / `createPlayer`, and cleanup through a
    direct Postgres connection (the `postgres` package). The service role
    can't touch `event_teams` or the status log.
  - **Leaks fixed.** `deleteTournament` had failed silently since
    registrations became RESTRICT, so each run left its event behind, and the
    signup tests never deleted their players. The suite now passes twice in a
    row with nothing left over.
  - **Specs.** `player-views` (every page signed out and as a player, the
    admin gates) and `player-flows` (six writes, each read back).
  - **Database.** `npm run db:test` (`scripts/db-tests.sh`) runs the nine
    `supabase/tests` scripts in the e2e job, before the specs.

  Found by the suite, older than this PR: shop orders have failed in
  production since 18 May (#99; `authenticated` lost the sequence grant in
  the security phase C migration; no orders since). Its test is marked
  `test.fail` until the fix. And the Oscars results fetch first fires with an
  empty ID (#98); the console check allows it until it's fixed.

- **2026-10-29.** Owner: fix #99 before PR 2. Admins couldn't add shop items
  either: `merch_items_id_seq` lost the same grant (production checked
  read-only, no item created since April). Migration
  `20261029120000_merch_sequence_grants.sql` gives `authenticated` USAGE on
  both sequences, and the shop order test is no longer `test.fail`. New
  `supabase/tests/sequence_grants.sql` fails if `anon` or `authenticated`
  can insert into a table but can't use a sequence behind it. Review found
  an older race on a double-tapped Order, live again with this fix (#100).
- **2026-10-29.** E2E PR 2 on `e2e-admin-views`: 40 tests → 54. What changed:
  - **Specs.** `admin-views` (Admin, event Manage's four sections, league
    Manage, shop Manage, Lobster Way admin) and `admin-flows` (nine writes,
    each read back): create an event through the form; add a player and a
    team for someone else, where the confirm must name who was picked; Mark
    Paid through the menu; cancel a registration; generate a schedule, save
    it and enter a score; enter the seeded league match's score; add a shop
    item (no `test.fail`: #99 merged first); edit and save the Lobster Way.
    The league match and the Lobster Way are seeded rows, restored after.
    Spec files run in parallel, so those two tests are tagged `@seed-write`
    and run in their own Playwright project after the rest (review).
  - **Fixtures.** `locators.ts`: `rowWith` (one player's or match's row) and
    `fieldAfterLabel`.
  - **Leak fixed.** `deleteEvent` and `deletePlayer` cleared the status log
    before deleting registrations, and each delete logs a row, so every run
    since #97 left about 36 rows behind. Now the log goes last; two full runs
    leave every table as seeded. `deletePlayer` also removes a teammate's
    registration on the player's team, which blocked the team's delete.
  - **Shared.** `registrationOf` moved to `fixtures/db.ts`; scores are
    committed with a real Tab instead of a scripted blur.

  Found by the suite, older than this PR: 66 form labels aren't tied to their
  inputs (#103, fits P3 part 2), and after an admin adds another player, the
  payment sheet says "You're in!" and never names them (#104). Also #102:
  production's default privileges give `anon` and `authenticated` all table
  grants on new tables; local gives none (RLS still gates).

- **2026-10-30.** P3 part 1 on `design-alerts` (#108). `AlertBox` gains:
  - `size="sm"` for a notice inside a card, row or form; `md` stays the
    default for page and section notices. The box sizes its icon.
  - A `role`: `alert` for errors, `status` for the rest. `Toast`,
    `CompareView`, `SwapPanel` and `TeamNotices` drop the wrapper role they
    put around the box. The admin "haven't paid yet" notice is a pending
    state, so it moves from `error` to `warning` and isn't announced as an
    alert on every Home visit (review).
  - `title` (bold first line in the `-strong` shade), `action` (one trailing
    `TextButton`: View, Review, Try again) and `actions` (buttons under the
    text: accept / decline, Pay via Tikkie, Sign up again).
  - A dismiss that is an `IconButton ghost sm`. Negative margins pull its 32px
    target back to one line of text, so the box doesn't grow.
  - No `className`. The margins at its call sites (`TeamForm`,
    `InvitePlayerModal`, `ScoreEntryForm`) move to the parent's `space-y`, and
    two page errors' one-off `text-xs` become the standard `md`.

  Triage of the hand-built tinted boxes: 29 files move onto `AlertBox`,
  including six borderless form errors (settings, finish account, starting
  courts, schedule quality, a cancelled order). Staying as they are:
  highlighted rows and cards (waitlisted `TeamCard`, `AdminTransferPanel`
  rows, security events, review-breakdown buckets and band, profile stat
  rows, rating signal cards), the admin identity card in `AccountSection`,
  `AuthGate` (P5 `SignInPrompt`), `TipOfTheDay`, the admin sign-in-invite
  panel, and status pills (P4). Field errors (`ProfileFields` level, the
  signup name) are part 2. Notices that were `card`s (transfer offers, the
  waitlist, an ended team) lose the card shadow. The waitlist notice, copied
  in `MyTournament` and `JoinEventCard`, is now `WaitlistNotice`. The Oscars
  "voting closed" banner was raw yellow and is now `warning` (ratchet 107 →
  103). Two warnings that had `role="alert"` (the court warning in the event
  form, the signup name-match banner) are now `status`.

- **2026-10-30.** P3 part 2 on `design-system-p3-field-errors` (#109).
  `FormError` moves from `features/auth` to `components/ui` and the gallery.
  - The boundary: `FormError` is what's wrong with the input, shown while
    editing (one field, or a check across the inputs above it). A failed save
    or load is `AlertBox variant="error"`.
  - `FormError` gains `action` (an inline `TextButton size="inherit"`, for
    "Search members"), an optional `message`, and `polite` for a check made
    while the user types or picks (new-partner level, KotC repeat, matchmaking
    fit): `status` instead of an interrupting `alert`. No margins; the
    parent's `space-y` places it.
  - `useFieldError` ties a field to its error: `aria-invalid` and
    `aria-describedby` on the input while there is a message. Every
    single-field error moved here uses it; the KotC repeat and matchmaking
    fit checks span several inputs and stay untied. `SegmentedControl` and
    `ChipGroup` take `describedBy` for the same. The league score and team
    player errors now clear when that field is edited, so a fixed field isn't
    left marked invalid (review).
  - It doesn't tie labels to inputs; #103 stays its own PR. Field plus error
    is now a repeated `space-y-1` wrapper, so the #103 fix should bring in a
    `Field` layout (label `htmlFor`, the input, `FormError` with
    `useFieldError` built in) and replace it.

  Triage of the hand-built error lines:
  - Onto `FormError`: the profile level and the signup name (both were tinted
    boxes; the name error moves into `ProfileNameFields`), the league score
    and team-player errors (were coral), the new-partner email and level
    errors (moved out of their `<label>`s, so they're no longer read as part
    of the field's name), the KotC "team picked more than once", the
    matchmaking "can't fit" detail, and the shop's size prompt (the label
    stays "Select size:"; the error goes under the chips).
  - Onto `AlertBox variant="error"`: failed sign-ups (`JoinEventCard`,
    `MyTournament`, `TeamJoinCard`, `PartnerChoiceForm`), a failed court
    booking, sign-out-everywhere, the sign-in modal's "needs an admin
    account" (`AuthGate`, review), and the shop, sign-in readiness and
    payment-reminder load errors.
  - Staying: auth forms keep `FormError` for their single-field errors (not
    tied to the field yet; fits #103). Swap rule breaks, an order's admin
    comment and the pending-match accents are content, not errors. The
    raffle draw error sits on the dark header, which `AlertBox` has no
    variant for. The "Register at least 4 players" hint is a warning, not an
    error.

  E2E: the shop order first taps Order with no size and checks the size group
  is invalid and described by the error.

- **2026-10-30.** P4 on `design-system-p4-badge-tones` (#110). `Badge` drops its
  per-meaning variants (`paid`, `unpaid`, `gold`, `league-*`, …) for eight
  tones (owner): `success`, `warning`, `danger`, `info`, `neutral`, `brand`,
  `outline`, `accent`. A meaning picks a tone; the table is in TOKENS.md.
  - One size (`text-xs`, `px-2 py-0.5`); the old `py-1`, `px-3` and `text-2xs`
    pills take it. The badge sizes its icon, shrinks and truncates its label in a
    tight row rather than overflowing (review), takes a
    `title` for a tooltip and carries no margins.
  - Owner calls: coral is not a tone, so unpaid is `danger` (as its Payments
    row already was) and league knockout is `brand` (phases read draft amber,
    group outline, knockout teal, completed grey). No token for the old blue:
    transferred is `neutral`, merch delivered `success`. Intermediate level
    moves from raw yellow to `accent`. `lob-coral-light` lost its last use and
    is gone.
  - **Payment status single source.** `paymentStatus.ts` holds the label, tone
    and hint of each state, plus `toPaymentStatus` (unknown reads as unpaid),
    `isSettled` and `owesPayment`. Before, the labels lived in five places with
    two vocabularies ("✓ Confirmed · Tikkie", "💬 Paid (self-declared)", "⚠
    Unpaid" on the admin row; "Confirmed ✓", "Paid", "Unpaid" elsewhere) and
    `paid || transferred` was spelled out in seven files. `PaymentStatusBadge`
    is now a `Badge` (with `detail` for the method) and replaces the admin row
    pill and the "✓ Confirmed" pills in `MyTournament` and `JoinEventCard`. The
    Payments filter tabs, tiles and status menu read their labels from it. Merch
    keeps its own order states in `statusConfig.ts`, now as tones.
  - Found on the way: `'transferred'` is the _receiving_ player's status (the
    spot came by transfer), so the menu hint now says so rather than "Gave up
    their spot". A team partner's `'covered'` row read as "Unpaid", and the Home
    "haven't paid yet" alert and the admin unpaid count counted every covered
    partner as owing. `owesPayment` leaves covered rows out.
  - **Team state renamed** (owner). "Confirmed" (the partner accepted, D-015)
    sat next to the payment "Confirmed" on the admin team row. It now names the
    partner: "{partner} accepted", against the existing "Waiting for {partner} to
    accept";
    the viewer's team card says "{partner} accepted ✓" or "You accepted ✓".
  - Triage. Onto `Badge`: every payment pill, merch order status and the order
    timeline steps (future steps `neutral`), the team "Paid by / Covered by"
    pill, event status, "Admin books all courts", run-of-show "Done" and
    "Optional", the KotC "Shown to players", "Optional" and "unrated", "Needs
    review", the court gender chip, feasibility chips, the quality band, the
    raffle "On cooldown" / "Won", Won / Lost / Tied, the Players "N pending"
    count, the lefty "L" and "You" markers, the security-event fail and PII
    counts and per-event "fail", "On waitlist" in the transfer picker, and the
    Home streak. The experience-level map, copied in three league files, is now
    `experienceTone`. Staying: identity labels (see "Later"), steppers (league
    phases), pills holding an action (court booking, rematch "Fix"), gender and
    category marks (P7), the review-breakdown bucket counts, the "Up next"
    marker on the coral-ringed card, image overlays and evidence lines. Raw
    palette classes 103 → 88.
  - Review: the viewer's own registered card says "Confirmed" for a spot that
    came by transfer (the admin list keeps "Transferred"). The admin row pill
    reads "Paid · self-declared", so a phone shows what still needs confirming;
    the status hints stay in the admin menu, not as tooltips on player screens.
    A row's border and avatar follow its status tone. A partner's "Covered by"
    pill is green only once the captain has paid, `neutral` before. The last
    four hand-written unpaid checks use `isUnpaid`. League phase pills share
    `leagueStatusPills`, so the three label maps no longer repeat the tones.
  - Owner: `accent` text moves to a new `lob-amber-strong` (`#8C5A0E`, 5.3:1
    on the tint, was 2.0:1 with `lob-amber`), so league "Draft" and the
    intermediate level pass WCAG AA.

- **2026-10-30.** P5 on `design-system-p5-states` (#112). Empty, signed-out and
  loading states.
  - `EmptyState` gains `variant="inline"` for an empty list inside a card,
    modal or headed section: no card, `py-4`, a 20px icon and a muted
    regular-weight title, so it doesn't compete with the card's own heading
    (owner). `card` stays for an empty page or tab body. The component sizes
    its icon (36px card, 20px inline), so call sites pass `<Calendar />` with
    no `size` (they had 22, 28, 32 and 36). `className` is gone; its one
    caller, LinkPlayerModal's `py-6`, is now inline.
  - `SignInPrompt` replaces the 4 sign-in prompts (team-events UI review):
    `SignInBanner` (card and `compact`), sign-in `EmptyState`s that pointed at
    Settings or `/account` (or had no action), and a plain "Sign in to see the
    final standings." line. It is an `EmptyState` with a `LogIn` icon and a
    Sign in button that opens `SignInModal` in place (owner), so there is no
    `onNavigate` plumbing and the content renders once the session lands.
    Neutral, not tinted: needing to sign in isn't a warning (owner).
  - **No admin sign-in prompts** (owner): an exposed action that asks for an
    admin sign-in is a bug. `/admin` and `/admin/lobster-way` now sit behind
    `AdminRouteGuard`, which sends a non-admin to Home and to the public
    Lobster way page, as the event and league manage routes already did.
    `AdminLeagueRouteGuard` is built on it. `SignInBanner` is deleted.
  - `Spinner` takes `size` instead of `className`: `page` (32px, `py-16`; the
    route fallback's `py-24` folds in) and `inline` (20px, `py-4`) for the
    body of a loading card, under its title.

  Triage:
  - Onto `SignInPrompt`: MyTournament, team invites, the KotC starting courts
    and final standings (inline), and the Shop's order notice (inline).
  - Onto `EmptyState variant="inline"`: LinkPlayerModal (both), the league
    division's teams, KotC admin teams and final standings, the past-event "No
    match data", a schedule round, the registered players and teams lists,
    the review breakdown, the transfer pickers (player search, admin pending
    list), `PlayerPicker`, security events and `CountryPicker`. "No seasons
    yet." and `LeagueNotFound` (was hand-built with a 🦞) are the card variant.
  - Loading cards that keep their title: KotC starting courts (the not-shown,
    signed-out and loading states now sit under the "Starting courts" heading)
    and the KotC standings, which were blank while loading. Sign-in readiness,
    security events, the shop and the Lobster way editor swap their "Loading…"
    text for `Spinner`. PlayerDetailPage and Group Stage keep their header
    while loading; Group Stage with no league showed a blank page and is now
    `LeagueNotFound`. Team invites and finish-account were `null` and are now
    a page spinner.
  - Empty states that showed before the data landed: the Events list ("No
    upcoming events"), the Players roster ("No players yet") and a transfer
    link ("We couldn't find this transfer") now show `Spinner` until their
    query resolves. Payments' "Loading teams…" was an `EmptyState` with an
    alert icon; it is a spinner, and the failure is `AlertBox variant="error"`.
  - Staying: placeholders inside a row ("No votes", "No teams assigned", "No
    description yet", "No email on file"), the YourStatsCard footnote under
    zeroed tiles, the Oscars game screens (their 🤷 panels belong to that
    screen's look), the Home skeletons (already right), and the league pages
    whose title is the league name, which can't show a header before it loads.
    Busy buttons ("Saving…", a spinning `Loader2` icon in six places) are a
    `Button busy` prop for later. `SignInModal` and the full-screen
    `VerificationGate` are the sign-in forms, not prompts.

  - Review: `SignInModal` renders through a portal, so a parent's `space-y`
    margin no longer pushes its backdrop down. A first load that fails shows an
    error rather than the empty state (`loadFailed`). Team invites wait for
    the account-setup check that can redirect them. The sign-in modal still
    doesn't trap focus or close on Escape (#111).

  E2E: a player opening `/admin` lands on Home, and `/admin/lobster-way` on the
  public Lobster way page.

- **2026-10-30.** Step 10 of Next on `design-system-amber-review` (#113).
  `lob-amber` uses triaged; it is now decorative only (icons, borders,
  dividers), never text or status.
  - Onto `lob-warning`: the `GroupFormationTool` warning line; the PII load
    failures in `LinkPlayerModal` (two) and `PendingApprovalsList`, matching
    the `PlayerProfile` contact-details failure, already a `warning`
    `AlertBox`; AdminTools "Needs attention" (icon and left border, `-solid`);
    the `PinUpgradeCard` no-email card's left border, as it warns that
    sign-in will stop working (the real-email card stays teal).
  - Onto `lob-amber-strong`: the `RatingReview` "now" level figure. Its dot
    stays amber.
  - Staying: the `ChampionBanner` trophy and borders, the `MyRounds` sit-out
    coffee and highlight border, and the `GroupStandingsTable` cutoff divider.

- **2026-10-30.** Card-pattern conversation (step 11 of Next). Most screens
  stacked white shadowed cards: 143 `.card` uses, one per row in lists (26 on
  Community), and four shadowed cards inside cards (Events, Home). Owner
  calls:
  - Cards for objects only. A card is one thing you act on (an event, a match,
    a team). Page sections and settings sit on the background under a
    section heading.
  - A list of like items is one card with divided rows, not a card per row.
  - No card inside a card. Inside a card, use a flat well or a divider.
  - Identity labels (Court N, Round N, a shirt size, the event format) get a
    small `Tag` component; `Badge` stays for states.

  P6 is rescoped around these (P6a to P6e under "Next"); the "Identity labels"
  and "heavy card pattern" items leave "Later".

- **2026-10-30.** P6a on `design-system-p6a-card-pieces` (#114). `Section` and
  `ListCard` + `LinkRow`, each with tests and a gallery entry (the gallery's
  own card helper is renamed `GallerySection`). `LinkCard` exports its
  content (`LinkCardContent`) so `LinkRow` shares it. `Well` moves to P6c and
  `Tag` and `.eyebrow` to P6e, so each piece lands with its first users.
  - Pilot: the Community players list is one `ListCard` of `LinkRow`s (26
    cards become one), under a `Section` heading "Players (n)" (was a
    hand-built `text-lg` h2) that holds the admin's pending approvals, the
    search and the list.
  - The viewer's own row is `LinkRow highlighted` (the `lob-teal-light`
    selected-row tint) instead of a ring. Its "You" badge is `outline`: the
    `brand` badge's fill is the same tint and disappeared on the row.
  - Review: a `LinkRow` has an inset focus ring, as `ListCard` clips an
    outline; the list takes its name from the `Section` heading rather than a
    label of its own; `LinkCard` and `LinkRow` share `LinkOrAction` and
    `linkOrActionProps` from `action.tsx`.

- **2026-10-30.** P6b inventory (step 13 of Next). Lists with a card per row:
  Registered, Waitlist and Cancelled players and team rows (event page),
  Payments, pending approvals, raffle eligibility, shop orders, league teams
  (draft and manage), league fixtures and results (five screens), Seasons and
  Admin tools (a `LinkCard` per row). `SectionHeader` has seven users, all in
  league; four sit inside a card. Left alone: objects (shop products, team
  invites, events, Schedule court matches), pickers in modals (already flat
  `OptionRow`s in a sheet), `PendingMatchCard` (already one card with divided
  rows), and the cards holding lists that belong to P6c and P6d (Oscars,
  `MyTournament`, birthdays, security events, Lobster Way admin). Owner calls:
  - League matches in a list (fixtures, results, match history) become
    `ListCard` rows. A match keeps its own card where it stands alone, and
    Schedule court matches, where scores are entered, stay cards.
  - The coloured left borders on Payments, Waitlist and pending approval
    rows go. Status shows in the `Badge` and avatar tone, and each list sits
    under its own heading.
  - Three PRs (P6b-1 to P6b-3 under "Next").

- **2026-10-30.** P6b-1 on `design-system-p6b-player-rows`. `ListCard` gains
  two rows beside `LinkRow`: `ListRow` (a padded row holding its own
  controls, e.g. a `PlayerRow` with buttons and a transfer button under it)
  and `CheckRow` (the whole row is one checkbox, `role="checkbox"`, with an
  inset focus ring; a disabled row hides the box and says why in its
  content). Both are in the gallery.
  - Event page: Registered, Waitlist and team lists are a `Section` (was a
    hand-built `h3`) with a `ListCard` for the admin's rows. Players still see
    name chips. Cancelled was a `CollapsibleCard` of cards; it is a `Section`
    with a Show / Hide `TextButton` and a `ListCard`. The registered row's
    transfer control moves into its own component.
  - Payments and pending approvals: one `ListCard` each, no left border.
    Payments keeps the status-toned avatar.
  - Raffle eligibility: a `ListCard` of `CheckRow`s instead of bordered
    `PlayerRow` buttons inside a card. Eligible players keep their own avatar
    colour; an excluded one is `lob-line-strong` (was raw amber and gray;
    white on amber failed contrast and `lob-amber` is decorative only).
  - Review: an empty `ListCard` renders nothing, so a list whose rows all
    drop out shows no empty card. Payments tints its avatars from
    `BADGE_TONE_CLASSES` (`badgeTones.ts`, Badge's own map) rather than a
    copy. `ListRow` has no `highlighted` until a list needs it.

- **2026-10-30.** P6b-2 on `design-system-p6b-league`. `SectionHeader` is gone:
  its seven users are `Section`s, and the headings that sat inside a card
  (standings, bracket, draft teams) are on the background with the card under
  them.
  - Standings: the Group A / B tables were copied on three screens; they are
    one `GroupStandings` (a `Section` over one card). The knockout copy had no
    card and now has one.
  - Teams: the draft list is a `ListCard` of `LinkRow onClick`, the viewer's
    team `highlighted` (was a hand-built tinted row with a left border).
    Manage is a `ListCard` of `ListRow`s instead of a card per team, with Add
    Team as the `Section` action. `GroupFormationTool`'s two copied group
    columns are one `GroupColumn`.
  - Matches: `LeagueMatchCard` is replaced by `LeagueMatchRow` (league
    feature, in the gallery), one `ListCard` per list on all five screens.
    Teams stack with their games per set in columns; the winner's line is
    bold, the loser's muted; a detail line gives the stage label, date and
    place; an unplayed match shows `Pending`, a bye one team and `Bye`.
    Owner calls on the mockup:
    - Team names are `TextButton`s, which opens the team by keyboard too
      (they were `div onClick`s).
    - An action (Enter Score) takes the `Pending` badge's place.
    - The league page's Matches splits into Fixtures and Results sections
      instead of one list with a hand-built "Completed" label.
  - Review: the set columns are hidden from screen readers, which hear one
    line instead ("Won by …, 6-4, 3-6, 8-10"); the match date parses as a
    local date (it showed a day early west of UTC); a bye gets no Enter Score
    or Edit on Manage (it opened the score form for a match with no
    opponent).

- **2026-10-30.** P6b-3 on `design-system-p6b-links`, the last P6b PR.
  - Seasons: Current, Upcoming and Past are `Section`s (were hand-built
    uppercase `h2`s), each a `ListCard` of `LinkRow`s instead of a `LinkCard`
    per season.
  - Admin tools: the tools are one `ListCard` of `LinkRow`s under a "Tools"
    `Section`. Needs attention was a card with a warning left border holding
    `OptionRow`s; it is a `Section` with a `ListCard` of `LinkRow`s, each led
    by a warning-toned `LinkCardIcon` naming what it is about (payments,
    signups, orders).
  - Shop orders: the player's orders (Shop tab and Account) and the admin's
    open orders are one `ListCard` of `ListRow`s each, not a card per order.
    The admin's cancelled orders were a native `<details>` of cards; they are
    a `Section` with a Show / Hide `TextButton`, as on the event page. The
    rows move into their own components (`OrderRow`, `StatusTimeline`,
    `CancelledOrders`). The size and custom-name pills stay for `Tag` (P6e);
    the Account "My Orders" heading stays for P6d.
  - Review: the cancelled orders sit outside the open-orders branch, so an
    admin still sees them when every order is cancelled (they were hidden
    behind "No orders yet"); the custom-name pill shows the normalised name.
    Found: the unpaid-registrations row opens shop orders, not the event's
    payments (#120).

- **2026-10-30.** P6c inventory (step 14 of Next), from the code and a DOM
  sweep of every route in the local seed as admin (anything with a card
  ancestor that is itself a card, shadowed, or a padded rounded fill or
  border). No `.card` or shadowed box sits inside a card on Home or the
  Events list any more; the "four" counted in the card-pattern Log were
  partly removed by P6b. What is left:
  - **Cards inside cards.** Run of show: each step is an `li.card` inside
    the run-of-show card. Lobster Way admin: a `CollapsibleCard` per
    category holds a bordered `lob-well/60` box per item, which holds white
    bordered boxes (three levels). Oscars results: a white bordered box per
    category, copied in `PastEventResults` (inside the past event's
    `CollapsibleCard`) and the event Results "Lobster Games" tab (a card per
    category under a summary card). Security events: a tinted, bordered box
    per event inside the `CollapsibleCard`.
  - **Hand-built `lob-well` insets → `Well`.** TeamPage Group Stage Record;
    Schedule's round note and Sitting out; `TeamJoinCard` and
    `TeamInvitesPage` (the partner line); `EventFormModal` courts; the
    `PlayerForm` loading line; `TransferPendingModal`.
  - **A well or bordered box per row (lists, so divided rows).**
    `GroupFormationTool`'s `TeamCard`; the past event's match boxes
    (`PastEventResults`, copied in `ScoresMatchesTab`, where they sit on the
    background); Admin tips; Oscars `CategoryEditor` rows; raffle winners.
    Not wells: the read-only email
    and name fields on Account (an input look), the `UpcomingEventCard` and
    Schedule pills (P6e `Tag`), the shop image placeholder.
  - **Tinted boxes inside cards (triage).** Alerts that stay or become
    `AlertBox`: Account "Admin mode active", the pending-transfer rows in
    `AdminTransferPanel` (warning), the `PlayerProfile` warning. Not alerts:
    the cream boxes (Account claim, `EmailChangeField` hint, `OtpCodeStep`,
    the Account Playtomic level readout), `GroupFormationTool`'s teal
    "Bracket recommendation", the Payments teal summary, `ResultsView`'s
    yellow winner boxes, the `PlayerProfile` stat chips, `StartingCourtsList`
    highlight. `PendingMatchCard` (coral, one card with divided rows) and
    Lobster Way's cream story `details` are cards in their own right, left
    alone.
  - **Playtomic panel.** The blue `bg-blue-50` box, copied in
    `ProfileFields`, `ProfileSection` and `PlayerForm`, groups one field
    under an eyebrow. Blue is neither status nor brand (owner, #73: no
    third-party brand colours), so it becomes a `Well`, and the three copies
    become one field.
  - **Cards holding lists, sorted.** P6c: Oscars results, security events,
    Lobster Way admin (cards inside cards, above). P6d: `MyTournament` (an
    object card per state, and `MyRounds` a card per round), the Home
    birthdays card (raw pink, coloured left border), the Oscars shell's
    hand-built white cards.
  - **Proposed split.**
    - **P6c-1: `Well`.** Builds it and moves the `lob-well` insets and the
      Playtomic panel (one shared field) onto it.
    - **P6c-2: cards inside cards.** Run of show, Lobster Way admin, Oscars
      results and the past event's match boxes (one component each for the
      two copies), security events, and the lists of boxed rows above:
      rows divided, not boxed.
    - **P6c-3: tinted boxes.** The triage above: alerts onto `AlertBox`,
      the rest onto `Well` or plain text.

  Owner calls: three PRs as proposed; the Playtomic panel is a `Well` and one
  shared field.

- **2026-10-30.** P6c-1 on `design-system-p6c-well`. `Well` (flat `lob-well`
  inset, no border or shadow, `px-4 py-3`, children spaced `space-y-2` like
  `ListRow`) with a test and a gallery entry.
  - Onto it: TeamPage's Group Stage Record, Schedule's round note and
    Sitting out, the partner line on `TeamJoinCard` and `TeamInvitesPage`,
    `EventFormModal`'s courts, `TransferPendingModal`'s pre-filled message
    (it lost its border). The `PlayerForm` loading line was a well holding
    text; it is `Spinner size="inline"`, as P5 set for loading.
  - Playtomic panel: the three blue copies are one `PlaytomicLevelField`
    (players feature) in a `Well`, with each caller's own last sentence of
    help. The blue eyebrow repeated the field's label and is gone. It is a
    text field with a decimal keypad everywhere (was `type="number"` on
    Account and admin Edit Player, which can't take "3,5"), so signup,
    Account and admin Edit Player share one check, `isLevelInRange`
    (`parseLevel.ts`): Account takes 0.5 to 7, the others 0 to 7. Admin Edit
    Player shows a refused level under the field, as the sheet covers the
    page's error box.
  - Found: Edit Player's other save errors still show behind the sheet
    (#121); Account's Playtomic update prompt is a hand-built overlay, not a
    dialog (#122).
