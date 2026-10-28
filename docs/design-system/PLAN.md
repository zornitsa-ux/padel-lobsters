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
     `src/components/ui`. `npm run design:check` also ratchets `<button>`s
     outside it (`scripts/raw-buttons-baseline.json`) from P2e; absolute once
     P2f reaches zero.
   - Later: remove raw palettes from the Tailwind theme, plus a lint rule for
     unknown classes (step 7).
4. **Discoverability.** A dev-only `/design` gallery of every component and
   variant, and a "need X → use Y" table (below).

## Need X → use Y

| Need                                 | Use                                                  | Status    |
| ------------------------------------ | ---------------------------------------------------- | --------- |
| Error / warning / success / info box | `AlertBox variant=… (size="sm")`                     | size: P3  |
| Field-level error text               | `FormError` (moving to `components/ui`)              | P3        |
| Status pill                          | `Badge tone=…`                                       | tones: P4 |
| Button (action or navigation)        | `Button variant=… size=…` (`to` / `href` for links)  | exists    |
| Full-width button                    | `Button fullWidth`                                   | exists    |
| Buttons sharing a row (Cancel, Save) | `ActionRow` (alternative first, confirm last)        | exists    |
| Utility action under content         | `Button variant="neutral" size="sm"`                 | exists    |
| Destructive action, not the CTA      | `TextButton tone="destructive"`                      | exists    |
| Toggle, filter or info chip          | `Chip` (a row of them: `ChipGroup`)                  | exists    |
| Pick one from a list (player)        | `OptionRow selected` (`actions` beside, outside tap) | exists    |
| Row that jumps to a task             | `OptionRow` (`trailing` chevron)                     | exists    |
| Pick one tile from a grid            | `OptionTile selected` (no handler: read-only tile)   | exists    |
| Switch between photos                | `ImageTile`                                          | exists    |
| Admin acts for another player        | `useConfirmOnBehalf` before the write                | exists    |
| Menu of actions                      | `Menu` + `MenuItem`                                  | P2f       |
| Underlined / inline text action      | `TextButton tone=… size=…` (`to` / `href` for links) | exists    |
| Icon-only button                     | `IconButton` (always with `aria-label`)              | exists    |
| Bare icon (close, back, reorder)     | `IconButton variant="ghost"`                         | exists    |
| Bare icon delete / remove in a row   | `IconButton variant="ghost-destructive"`             | exists    |
| Icon button on a dark surface        | `IconButton variant="on-dark"`                       | exists    |
| Avatar photo upload                  | `AvatarPicker`                                       | exists    |
| Empty list / nothing yet             | `EmptyState` (`variant="inline"` coming)             | P5        |
| Signed-out viewer                    | `SignInPrompt`                                       | P5        |
| Player or team row, ranked row       | `PlayerRow` + `RankMarker`                           | P6        |
| Card title + pill + description      | `CardHeader`                                         | P6        |
| Inset panel / well                   | `.panel` / `.panel-accent`                           | P6        |
| Search field                         | `SearchInput`                                        | P6        |
| Collapsible card (+ summary)         | `CollapsibleCard` (`summary` stays visible)          | exists    |
| Collapsible row with reorder/delete  | `CollapsibleCard leading actions`                    | exists    |
| Inline show / hide detail            | `Disclosure`                                         | exists    |
| Two-to-four way choice               | `SegmentedControl` (`detail` for a second line)      | exists    |
| Pick one of many (rounds, filters)   | `SegmentedControl layout="scroll"` / `"wrap"`        | exists    |
| Page tabs (route or in-page)         | `PageHeader tabs` (`to` or `onClick`)                | exists    |
| Loading                              | `Spinner` / `Skeleton`                               | exists    |
| Eyebrow / overline                   | `.eyebrow` / `.eyebrow-accent`                       | P6        |

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
| P2f | **Zero hand-built buttons: chips, options, menus.** New components for what's left: `Chip` (toggle, filter, selection: filter pills, sizes, rounds, divisions, lefty, gender and position), an option row / tile (player pickers, Oscars vote tiles and category grid, lightbox thumbnails) and `Menu` + `MenuItem` (event admin menu, payment method picker, status override, team search). Two-to-four way choices go to `SegmentedControl`. Card-shaped links: `CardLink` (owner, 2026-10-26). The ratchet reaches zero and the rule becomes absolute. Four PRs: chips and choices, option rows and tiles, menus, then card links and the rest. | Parts 1–2 done (#77, #xx) |
| P3  | **`AlertBox` size and role, `FormError` in ui.** Migrate the 15 hand-built alert boxes and 7 field-error spellings. The dismiss X in a tinted box (`AlertBox`, `TeamNotices`, the event error banner) is still a bare 14px icon: give it a proper tap target here.                                                                                                                                                                                                                                                                                                                                                                                 |                           |
| P4  | **`Badge` tones** (`success`, `neutral`, `warning`, `outline`) and **payment status single source** (`paymentStatus.ts`, `PaymentStatusBadge` on `Badge`; blue "transferred" gets a token). Rename team-state "Confirmed".                                                                                                                                                                                                                                                                                                                                                                                                                         |                           |
| P5  | **Empty and signed-out states.** `EmptyState variant="inline"`, `SignInPrompt`; loading states: a loading card keeps its title or header, so the viewer sees what is loading, and shows `Spinner` / `Skeleton` in the body instead of `return null`.                                                                                                                                                                                                                                                                                                                                                                                               |                           |
| P6  | **Layout pieces.** `RankMarker` + `PlayerRow highlighted`, `CardHeader`, `RosterHeading`, `.panel`, `.eyebrow`, `SearchInput`; `ProfileFields` preferred side → `SegmentedControl`; a heading element inside the `CollapsibleCard` header button (review of #76).                                                                                                                                                                                                                                                                                                                                                                                  |                           |
| P7  | **Lock-down.** Tokens for decorative colours (medal gold, avatar palette, gender marks, selection states). Then switch `theme.extend.colors` to a restricted `theme.colors` so raw palette classes stop generating, and add a lint rule for unknown classes (e.g. `eslint-plugin-tailwindcss`, check ESLint 9 support). Retire `design:check` once the theme is locked.                                                                                                                                                                                                                                                                            |                           |

The gallery exists: `/design` in dev (`src/features/design/DesignGallery.tsx`;
open to guests in dev only, left out of the production build). Each step adds
its components to it.

**In parallel (not design system, same principle).** The review's logic
helpers: `formatTeamName` / `fullName`, `isTeamEvent` at the 7 `entryMode`
sites, `registeredEntries`, and the King of the Court helpers (`isKingCourt`,
`placingText`, `ordinal`, `medalFor`, `useViewerKingOfCourt`).

## Later

- **Colour pairings** (owner, 2026-10-26). Document which foregrounds and
  fills may sit on which surfaces, so a component can't pick a pair that
  doesn't read. Prompted by #72's review: the `ghost` hover fill (`lob-line`)
  is nearly invisible on `lob-well` rows.

- **Revisit the heavy card pattern** (owner, 2026-10-24). Most screens stack
  white shadowed cards. Scope still to be set. Have this conversation before
  P6, since `CardHeader` and `.panel` would otherwise cement today's shape.

## Open owner calls

None.

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
  `PlayerPicker`, so the admin add gets the accent-folding name search and
  avatars, and `getAvailablePlayers` loses its `search`. `LinkPlayerModal`
  candidates and the Admin "Needs attention" rows are `OptionRow`s; the Oscars
  vote tiles and category grid are `OptionTile`s. A voted category no longer
  greys out: its "Voted: …" line says so. `CollapsibleCard` gains `leading`
  and `actions` slots outside the toggle, and loses `headerClassName` and
  `chevronClassName` (its header always has `gap-3`). The Oscars stat rows
  (progress bar as `summary`) and results, and the Lobster Way admin category
  and question rows, move onto it.
