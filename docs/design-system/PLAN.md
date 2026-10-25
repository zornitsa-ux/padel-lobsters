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
   - Later: remove raw palettes from the Tailwind theme, plus a lint rule for
     unknown classes (step 7).
4. **Discoverability.** A dev-only `/design` gallery of every component and
   variant, and a "need X → use Y" table (below).

## Need X → use Y

| Need                                 | Use                                                  | Status     |
| ------------------------------------ | ---------------------------------------------------- | ---------- |
| Error / warning / success / info box | `AlertBox variant=… (size="sm")`                     | size: P3   |
| Field-level error text               | `FormError` (moving to `components/ui`)              | P3         |
| Status pill                          | `Badge tone=…`                                       | tones: P4  |
| Button (action or navigation)        | `Button variant=… size=…`                            | exists     |
| Destructive action, not the CTA      | `TextButton tone="destructive"`                      | exists     |
| Toggle, filter or info chip          | none yet (`ActionChip` is an action: P2c)            | later      |
| Underlined / inline text action      | `TextButton tone=… size=…` (`to` / `href` for links) | exists     |
| Icon-only button                     | `IconButton` (always with `aria-label`)              | ghost: P2b |
| Empty list / nothing yet             | `EmptyState` (`variant="inline"` coming)             | P5         |
| Signed-out viewer                    | `SignInPrompt`                                       | P5         |
| Player or team row, ranked row       | `PlayerRow` + `RankMarker`                           | P6         |
| Card title + pill + description      | `CardHeader`                                         | P6         |
| Inset panel / well                   | `.panel` / `.panel-accent`                           | P6         |
| Search field                         | `SearchInput`                                        | P6         |
| Two-to-four way choice               | `SegmentedControl`                                   | exists     |
| Loading                              | `Spinner` / `Skeleton`                               | exists     |
| Eyebrow / overline                   | `.eyebrow` / `.eyebrow-accent`                       | P6         |

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

## Steps

Each step is one branch off `main` and one PR. Each PR updates this file and
the gallery, and runs `npm run design:baseline` when counts drop.

| #   | Step                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Status                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| P1  | **Tokens and migration.** Status/neutral/type/brand/shadow tokens; ui primitives and every status use moved onto them; CLAUDE.md rules; `design:check` ratchet.                                                                                                                                                                                                                                                                                                                                                                                                 | Done (#69)             |
| P2  | **`Button` and `TextButton`.** A `Button variant size` component replacing `.btn-*` plus overrides (about 50 `text-sm`/`py-2` overrides, 9 redundant `disabled:opacity-50`), and `TextButton` for the 10 hand-built text links. Bare icon buttons → `IconButton`. Sizes: `md` (default, `py-2 px-4 text-sm`, 40px), `lg` (today's `.btn-*`, `py-3 px-5`, 52px) and `sm` (`py-1.5 px-3 text-xs`, 32px). Unsized buttons move from 52px to 40px. The four `text-xs` buttons (PIN card "Got it" and "Set a password", swap "Apply", run-of-show actions) are `sm`. | Branch `design-button` |
| P2b | **Ghost `IconButton`.** About 15 bare icon buttons (close X, remove, delete, move up/down, refresh, back) are a muted icon with a hover colour. Add a `ghost` variant with a proper tap target, then migrate them.                                                                                                                                                                                                                                                                                                                                              | Next                   |
| P2c | **`ActionChip` → `Button size="sm"`.** Share and Add to calendar are actions, so they are buttons, not chips (see "Buttons and chips"). Pick the variant (likely `neutral`), migrate the two chip call sites and delete `ActionChip`.                                                                                                                                                                                                                                                                                                                           |                        |
| P3  | **`AlertBox` size and role, `FormError` in ui.** Migrate the 15 hand-built alert boxes and 7 field-error spellings.                                                                                                                                                                                                                                                                                                                                                                                                                                             |                        |
| P4  | **`Badge` tones** (`success`, `neutral`, `warning`, `outline`) and **payment status single source** (`paymentStatus.ts`, `PaymentStatusBadge` on `Badge`; blue "transferred" gets a token). Rename team-state "Confirmed".                                                                                                                                                                                                                                                                                                                                      |                        |
| P5  | **Empty and signed-out states.** `EmptyState variant="inline"`, `SignInPrompt`; loading states: a loading card keeps its title or header, so the viewer sees what is loading, and shows `Spinner` / `Skeleton` in the body instead of `return null`.                                                                                                                                                                                                                                                                                                            |                        |
| P6  | **Layout pieces.** `RankMarker` + `PlayerRow highlighted`, `CardHeader`, `RosterHeading`, `.panel`, `.eyebrow`, `SearchInput`; `ProfileFields` preferred side → `SegmentedControl`.                                                                                                                                                                                                                                                                                                                                                                             |                        |
| P7  | **Lock-down.** Tokens for decorative colours (medal gold, avatar palette, gender marks, selection states). Then switch `theme.extend.colors` to a restricted `theme.colors` so raw palette classes stop generating, and add a lint rule for unknown classes (e.g. `eslint-plugin-tailwindcss`, check ESLint 9 support). Retire `design:check` once the theme is locked.                                                                                                                                                                                         |                        |

The gallery exists: `/design` in dev (`src/features/design/DesignGallery.tsx`;
open to guests in dev only, left out of the production build). Each step adds
its components to it.

**In parallel (not design system, same principle).** The review's logic
helpers: `formatTeamName` / `fullName`, `isTeamEvent` at the 7 `entryMode`
sites, `registeredEntries`, and the King of the Court helpers (`isKingCourt`,
`placingText`, `ordinal`, `medalFor`, `useViewerKingOfCourt`).

## Later

- **Revisit the heavy card pattern** (owner, 2026-10-24). Most screens stack
  white shadowed cards. Scope still to be set. Have this conversation before
  P6, since `CardHeader` and `.panel` would otherwise cement today's shape.

## Open owner calls

- P2: `lg` (52px) has no call sites. Keep it for a future lead CTA, or drop
  it to keep the variations down.

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
