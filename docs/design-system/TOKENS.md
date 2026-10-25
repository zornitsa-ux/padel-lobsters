# Design tokens

Tokens live in `tailwind.config.js` under `colors.lob` (plus a few top-level
brand tokens). Use them instead of raw Tailwind palette classes
(`text-green-700`, `bg-red-50`, …) and hex literals. What is being built on
top of them is in [`PLAN.md`](./PLAN.md).

## Status colours

Four families: `success`, `warning`, `danger`, `info`. Each has the same
ramp, so a meaning picks the family and a role picks the suffix.

| Class suffix | Role                                        | success   | warning   | danger  | info    |
| ------------ | ------------------------------------------- | --------- | --------- | ------- | ------- |
| `-light`     | Tinted surface (alert box, highlighted row) | green-50  | amber-50  | red-50  | sky-50  |
| `-soft`      | Pill, chip or avatar background             | green-100 | amber-100 | red-100 | sky-100 |
| `-border`    | Border, ring, divider on a tinted surface   | green-200 | amber-200 | red-200 | sky-200 |
| `-on-dark`   | Text on the teal header or dark tiles       | green-300 | amber-300 | red-300 | sky-300 |
| `-solid`     | Filled button or bar, icon colour           | green-600 | amber-500 | red-700 | sky-500 |
| _(none)_     | Text on a light background                  | green-700 | amber-700 | red-700 | sky-700 |
| `-strong`    | Heading on a tint, hover of a solid fill    | green-800 | amber-800 | red-800 | sky-800 |

Examples: `text-lob-success`, `bg-lob-warning-light border-lob-warning-border`,
`bg-lob-danger-solid hover:bg-lob-danger-strong`.

**Decisions (owner, 2026-10-24):**

- `danger` is its own red, not `lob-coral`. Coral is the primary-action
  colour; errors shouldn't look like CTAs.
- `danger` is a deep red (red-700, hover red-800) so it reads apart from
  coral (owner, 2026-10-25). Its `-solid` and text shades are the same.
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
- `bg-tikkie`, `bg-whatsapp`: third-party brand colours, outside `lob`.
- `bg-celebrate`: the gold-to-coral gradient on placing and completed banners.
- `bg-header`: the teal header gradient.
- `shadow-card`, `shadow-card-elevated`: the `.card` / `.card-elevated`
  shadows, built from `lob-dark`.

## Still raw, on purpose

Decorative and categorical colour isn't status, so it stays on the Tailwind
palette for now: medal / podium / trophy gold, raffle and Oscars gold, the
avatar letter palette (`playerConstants.ts`), gender marks, blue "selected"
toggles, and the blue "transferred" / "delivered" pills (these move with the
payment-status single source).
