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

| Need                                 | Use                                                 | Status    |
| ------------------------------------ | --------------------------------------------------- | --------- |
| Error / warning / success / info box | `AlertBox variant=… (size="sm")`                    | size: P3  |
| Field-level error text               | `FormError` (moving to `components/ui`)             | P3        |
| Status pill                          | `Badge tone=…`                                      | tones: P4 |
| Button                               | `Button variant=… size=…` (today: `.btn-*` classes) | P2        |
| Underlined / inline text action      | `TextButton`                                        | P2        |
| Icon-only button                     | `IconButton` (always with `aria-label`)             | exists    |
| Empty list / nothing yet             | `EmptyState` (`variant="inline"` coming)            | P5        |
| Signed-out viewer                    | `SignInPrompt`                                      | P5        |
| Player or team row, ranked row       | `PlayerRow` + `RankMarker`                          | P6        |
| Card title + pill + description      | `CardHeader`                                        | P6        |
| Inset panel / well                   | `.panel` / `.panel-accent`                          | P6        |
| Search field                         | `SearchInput`                                       | P6        |
| Two-to-four way choice               | `SegmentedControl`                                  | exists    |
| Loading                              | `Spinner` / `Skeleton`                              | exists    |
| Eyebrow / overline                   | `.eyebrow` / `.eyebrow-accent`                      | P6        |

## Steps

Each step is one branch off `main` and one PR. Each PR updates this file and
the gallery, and runs `npm run design:baseline` when counts drop.

| #   | Step                                                                                                                                                                                                                                                                                                                                                                                                                                              | Status                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| P1  | **Tokens and migration.** Status/neutral/type/brand/shadow tokens; ui primitives and every status use moved onto them; CLAUDE.md rules; `design:check` ratchet.                                                                                                                                                                                                                                                                                   | Branch `design-tokens` |
| P2  | **`Button` and `TextButton`.** A `Button variant size` component replacing `.btn-*` plus overrides (about 50 `text-sm`/`py-2` overrides, 9 redundant `disabled:opacity-50`), and `TextButton` for the 10 hand-built text links. Bare icon buttons → `IconButton`.                                                                                                                                                                                 | Next                   |
| P3  | **`AlertBox` size and role, `FormError` in ui.** Migrate the 15 hand-built alert boxes and 7 field-error spellings.                                                                                                                                                                                                                                                                                                                               |                        |
| P4  | **`Badge` tones** (`success`, `neutral`, `warning`, `outline`) and **payment status single source** (`paymentStatus.ts`, `PaymentStatusBadge` on `Badge`; blue "transferred" gets a token). Rename team-state "Confirmed".                                                                                                                                                                                                                        |                        |
| P5  | **Empty and signed-out states.** `EmptyState variant="inline"`, `SignInPrompt`; decide loading (`return null` vs `Spinner`).                                                                                                                                                                                                                                                                                                                      |                        |
| P6  | **Layout pieces.** `RankMarker` + `PlayerRow highlighted`, `CardHeader`, `RosterHeading`, `.panel`, `.eyebrow`, `SearchInput`; `ProfileFields` preferred side → `SegmentedControl`.                                                                                                                                                                                                                                                               |                        |
| P7  | **Gallery and lock-down.** Dev-only `/design` route listing every component and variant. Tokens for decorative colours (medal gold, avatar palette, gender marks, selection states). Then switch `theme.extend.colors` to a restricted `theme.colors` so raw palette classes stop generating, and add a lint rule for unknown classes (e.g. `eslint-plugin-tailwindcss`, check ESLint 9 support). Retire `design:check` once the theme is locked. |                        |

The gallery can start earlier: each of P2–P6 can add its components to it if
the route exists by then. Build the route as the first part of P2 if that's
cheap.

**In parallel (not design system, same principle).** The review's logic
helpers: `formatTeamName` / `fullName`, `isTeamEvent` at the 7 `entryMode`
sites, `registeredEntries`, and the King of the Court helpers (`isKingCourt`,
`placingText`, `ordinal`, `medalFor`, `useViewerKingOfCourt`).

## Open owner calls

- `text-[11px]`: fold into `text-2xs` (10px) or `text-xs` (12px)?
- `py-2.5 text-sm` full-width card CTA: `size="sm"` or a separate `size="md"`?
- `AlertBox` `info`: stays teal (current), or moves to `lob-info` (sky)?
- Loading inside cards: keep `return null` (no flash) or show `Spinner` /
  `Skeleton`?

## Log

- **2026-10-24.** Plan written. Owner calls: `danger` is its own red (not
  `lob-coral`); `warning` replaces `lob-amber` for status; card shadows from
  `lob-dark`; P1 does the full app-wide migration. 753 token uses after P1;
  129 raw palette classes left (decorative and categorical), held by the
  ratchet.
