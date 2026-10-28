# Design tokens

Tokens live in `tailwind.config.js` under `colors.lob` (plus a few top-level
brand tokens). Use them instead of raw Tailwind palette classes
(`text-green-700`, `bg-red-50`, …) and hex literals. What is being built on
top of them is in [`PLAN.md`](./PLAN.md).

## Brand and text

| Token             | Value     | Use                                                   |
| ----------------- | --------- | ----------------------------------------------------- |
| `lob-teal`        | `#3D7A8A` | Brand, links, selected states (chips, segments, rows) |
| `lob-teal-dark`   | `#2A5A68` | Header gradient end, hover darken                     |
| `lob-teal-light`  | `#EAF4F7` | Selected row tint, segment track, icon button fill    |
| `lob-coral`       | `#D94F2B` | Primary CTA (`Button` primary), active nav tab        |
| `lob-coral-light` | `#FAEAE5` | Coral tint (unpaid badge)                             |
| `lob-amber`       | `#E8A030` | Accent only, not status (league draft badge)          |
| `lob-cream`       | `#F5F0E8` | Page background (`body`), accent icon button          |
| `lob-dark`        | `#1C2B30` | Headings and body text; base of the card shadows      |
| `lob-slate`       | `#40565C` | Secondary text that needs more weight than muted      |
| `lob-muted`       | `#6B8A92` | Secondary text, inactive icons                        |
| `lob-muted-light` | `#97ADB3` | Tertiary text, placeholder, disabled text             |

## Status colours

Four families: `success`, `warning`, `danger`, `info`. Each has the same
ramp, so a meaning picks the family and a role picks the suffix.

| Class suffix | Role                                        | success   | warning   | danger    | info    |
| ------------ | ------------------------------------------- | --------- | --------- | --------- | ------- |
| `-light`     | Tinted surface (alert box, highlighted row) | green-50  | amber-50  | red-50    | sky-50  |
| `-soft`      | Pill, chip or avatar background             | green-100 | amber-100 | red-100   | sky-100 |
| `-border`    | Border, ring, divider on a tinted surface   | green-200 | amber-200 | red-200   | sky-200 |
| `-on-dark`   | Text on the teal header or dark tiles       | green-300 | amber-300 | red-300   | sky-300 |
| `-solid`     | Filled button or bar, icon colour           | green-600 | amber-500 | `#9B1C31` | sky-500 |
| _(none)_     | Text on a light background                  | green-700 | amber-700 | `#9B1C31` | sky-700 |
| `-strong`    | Heading on a tint, hover of a solid fill    | green-800 | amber-800 | `#7A1526` | sky-800 |

Examples: `text-lob-success`, `bg-lob-warning-light border-lob-warning-border`,
`bg-lob-danger-solid hover:bg-lob-danger-strong`.

**Decisions (owner, 2026-10-24):**

- `danger` is its own red, not `lob-coral`. Coral is the primary-action
  colour; errors shouldn't look like CTAs.
- `danger` is a deep crimson (`#9B1C31`, hover `#7A1526`), darker and
  cooler than coral so the two never read as the same button (owner,
  2026-10-26). Its `-solid` and text shades share one value in
  `tailwind.config.js`.
- `warning` covers every warning, waitlist and pending state, including what
  used to be orange or yellow. `lob-amber` stays as an accent colour for
  non-status uses (e.g. the league draft badge), not for status.
- `info` is sky, not teal, so info alerts don't read as brand teal.
  `AlertBox` `info` uses it.

## Neutrals

| Token             | Use                         | Value    |
| ----------------- | --------------------------- | -------- |
| `lob-well`        | Inset well / panel surface  | gray-50  |
| `lob-line`        | Hairline border, divider    | gray-100 |
| `lob-line-strong` | Input border, stronger line | gray-200 |

## Type, brand, effects

- `text-2xs`: 10px eyebrows and micro labels. 11px folded into `text-xs`
  (12px). `text-[9px]` is still raw.
- No third-party brand colours (owner, 2026-10-26). Tikkie pay links and the
  WhatsApp reminder are standard `Button`s.
- `bg-celebrate`: the gold-to-coral gradient on placing and completed banners.
- `bg-header`: the teal header gradient.
- `shadow-card`, `shadow-card-elevated`: the `.card` / `.card-elevated`
  shadows, built from `lob-dark`.

## Still raw, on purpose

Decorative and categorical colour isn't status, so it stays on the Tailwind
palette for now (107 classes, held by the `design:check` ratchet; tokens for
these are P7):

- Medal, podium and trophy gold; raffle and Oscars gold.
- The avatar letter palette (`playerConstants.ts`) and the gender marks.
- The blue "transferred" payment pill and "delivered" merch status. These move
  with the payment-status single source (P4).
- The blue Playtomic-level panel, copied in `ProfileFields`, `ProfileSection`
  and `PlayerForm` (a `.panel` candidate, P6).
