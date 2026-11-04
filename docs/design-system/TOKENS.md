# Design tokens

Tokens live in `tailwind.config.js` under `colors.lob` (plus a few top-level
brand tokens). Use them instead of raw Tailwind palette classes
(`text-green-700`, `bg-red-50`, …) and hex literals. What is being built on
top of them is in [`PLAN.md`](./PLAN.md).

## Brand and text

| Token              | Value     | Use                                                   |
| ------------------ | --------- | ----------------------------------------------------- |
| `lob-teal`         | `#3D7A8A` | Brand, links, selected states (chips, segments, rows) |
| `lob-teal-dark`    | `#2A5A68` | Header gradient end, hover darken                     |
| `lob-teal-light`   | `#EAF4F7` | Selected row tint, segment track, icon button fill    |
| `lob-coral`        | `#D94F2B` | Primary CTA (`Button` primary), active nav tab        |
| `lob-amber`        | `#E8A030` | Decorative accent: icons, borders, `accent` fill      |
| `lob-amber-strong` | `#8C5A0E` | Accent text, on white or an amber tint                |
| `lob-cream`        | `#F5F0E8` | Page background (`body`), accent icon button          |
| `lob-dark`         | `#1C2B30` | Headings and body text; base of the card shadows      |
| `lob-slate`        | `#40565C` | Secondary text that needs more weight than muted      |
| `lob-muted`        | `#6B8A92` | Secondary text, inactive icons                        |
| `lob-muted-light`  | `#97ADB3` | Tertiary text, placeholder, disabled text             |

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
  non-status uses (e.g. the league draft badge), not for status. It is
  decorative only (icons, borders); accent text is `lob-amber-strong`, as
  `lob-amber` text is about 2.2:1 on white (2026-10-30).
- `info` is sky, not teal, so info alerts don't read as brand teal.
  `AlertBox` `info` uses it.

**Badge tones (owner, 2026-10-30).** A tone is a colour family; meanings map
onto tones. Each is a `-soft` fill (or a token tint) with the text shade:

| Tone      | Fill / text                                 | For                                         |
| --------- | ------------------------------------------- | ------------------------------------------- |
| `success` | `lob-success-soft` / `lob-success`          | Paid, done, won, shown to players           |
| `warning` | `lob-warning-soft` / `lob-warning`          | Pending, waitlist, tikkied, needs review    |
| `danger`  | `lob-danger-soft` / `lob-danger`            | Unpaid, cancelled, lost, failed             |
| `info`    | `lob-info-soft` / `lob-info`                | Self-declared payment, upcoming event       |
| `neutral` | `lob-line` / `lob-slate`                    | Optional, hidden, completed, transferred    |
| `brand`   | `lob-teal-light` / `lob-teal`               | Live, bye, division, "You", league knockout |
| `outline` | white, `lob-line-strong` ring / `lob-slate` | League group stage, tied, streak            |
| `accent`  | `lob-amber` 15% / `lob-amber-strong`        | League draft, intermediate level            |

- Coral is not a Badge tone: it is the CTA colour. Unpaid is `danger`, matching
  its row on the Payments page.
- `accent` text is `lob-amber-strong` (owner, 2026-10-30): `lob-amber` text
  on its tint was 2.0:1; the strong shade is 5.3:1 (WCAG AA for small text).
- No token for the old blue: "Transferred" is `neutral` (the spot came by
  transfer, nothing is owed) and merch "Delivered" is `success`.

## Neutrals

| Token             | Use                         | Value    |
| ----------------- | --------------------------- | -------- |
| `lob-well`        | Inset well / panel surface  | gray-50  |
| `lob-line`        | Hairline border, divider    | gray-100 |
| `lob-line-strong` | Input border, stronger line | gray-200 |

## Type, brand, effects

- `text-2xs`: 10px eyebrows and micro labels. 11px folded into `text-xs`
  (12px).
- `text-3xs`: 9px, the smallest size: bottom nav labels, the header
  tagline, `DateTile` month and weekday, `StatTile`'s muted label, the
  countdown units, the lefty and "main" marks. 8px folded into it; 13px
  into `text-sm`.
- No third-party brand colours (owner, 2026-10-26). Tikkie pay links and the
  WhatsApp reminder are standard `Button`s.
- `bg-celebrate`: the gold-to-coral gradient on placing and completed banners.
- `bg-header`: the teal header gradient.
- `shadow-card`, `shadow-card-elevated`: the `.card` / `.card-elevated`
  shadows, built from `lob-dark`. `shadow-nav` (the bottom nav) and
  `shadow-input` (`.input`'s inset) are built the same way.

## Decorative colours (P7a)

Not status, so they sit outside the status families (owner, 2026-11-04).

| Token              | Value     | Use                                                |
| ------------------ | --------- | -------------------------------------------------- |
| `lob-gold`         | `#FACC15` | First-place fills (`Podium`), winner borders       |
| `lob-gold-light`   | `#FEFCE8` | Winner tint (trophy tile, top rows)                |
| `lob-gold-strong`  | `#CA8A04` | Gold trophy icon on white                          |
| `lob-gold-on-dark` | `#FDE047` | Gold icon on teal (raffle)                         |
| `lob-silver`       | `#9CA3AF` | Silver trophy icon                                 |
| `lob-silver-soft`  | `#E5E7EB` | Second-place fills (`Podium`)                      |
| `lob-bronze`       | `#CD7F32` | Third-place fills and icon; `/10` for the row tint |
| `lob-gender-f`     | `#BE185D` | Woman mark text (`GenderMark`); `-soft` its fill   |
| `lob-gender-m`     | `#1D4ED8` | Man mark text (`GenderMark`); `-soft` its fill     |

- `bg-celebrate`'s gold is `lob-gold`.
- Court gender chips (Men, Women, Mixed) are neutral `Badge`s, in the
  generator and the saved schedule alike; only the W / M marks are coloured.
- `Podium` text on gold and bronze is `lob-dark`; white doesn't read.
- **Level badges** (`LevelBadge`): four bands on a teal ramp, no colour per
  level (owner, 2026-11-04). Under 2 `lob-line-strong` / `lob-slate`; 2 to
  3.9 `lob-teal-light` / `lob-teal-dark`; 4 to 4.9 a `lob-teal` ring with
  `lob-teal-dark` text; 5 and up solid `lob-teal` with white text.

## Still raw, on purpose

- The avatar letter palette (`letterColors.ts`, owner, 2026-04-30): 26
  colours, one per first letter, applied as inline styles. It is data, not
  a token set.
- `white` and `black` with opacity (`bg-white/15` on the header,
  `bg-black/50` on a photo) stay; P7c's locked theme keeps them.
