# Padel Lobsters Design System

## Color Palette

The palette is defined in `tailwind.config.js` under the `lob` namespace. Use **only** `lob-*` tokens.

### Token map

| Token             | Hex       | Use                                              |
| ----------------- | --------- | ------------------------------------------------ |
| `lob-teal`        | `#3D7A8A` | Primary brand, icons, links, active states       |
| `lob-teal-dark`   | `#2A5A68` | Header gradient end, hover darken                |
| `lob-teal-light`  | `#EAF4F7` | Tab tracks, chip backgrounds, subtle rows        |
| `lob-coral`       | `#D94F2B` | Primary CTAs, active nav tab, destructive alerts |
| `lob-coral-light` | `#FAEAE5` | Alert/warning card backgrounds                   |
| `lob-amber`       | `#E8A030` | Warnings, in-progress, streak indicators         |
| `lob-cream`       | `#F5F0E8` | Page background (set on `body`)                  |
| `lob-dark`        | `#1C2B30` | All headings and body text                       |
| `lob-muted`       | `#6B8A92` | Secondary text, placeholders, inactive icons     |

### Raw gray ban

Do not use Tailwind's `gray-*` scale for content text. Map to lob tokens:

| Raw gray                          | Lob token                              |
| --------------------------------- | -------------------------------------- |
| `text-gray-800` / `text-gray-700` | `text-lob-dark`                        |
| `text-gray-600` / `text-gray-500` | `text-lob-muted`                       |
| `text-gray-400`                   | `text-lob-muted` (or add `opacity-70`) |

`bg-gray-100` tracks → `bg-lob-teal-light`. `bg-gray-50` states → `bg-lob-teal-light` or `bg-white`.

Exception: semantic status colors (`bg-green-50`, `text-green-700` for success) are fine — those are not brand tokens.

---

## Page Structure

Every top-level page uses this three-layer layout:

```
Page Header   ← h1 + optional primary CTA
Sub-tabs      ← pill tab bar (only if page has distinct sections)
Content area  ← space-y-4 cards
```

### Page header

```jsx
<div className="flex items-center justify-between mb-1">
  <h1 className="text-xl font-bold text-lob-dark">Page Title</h1>
  {/* one optional primary action */}
</div>
```

All six top-level pages use this exact pattern. Dashboard is the exception — the `<Greeting>` component acts as the page header.

---

## Typography Scale

| Role                           | Classes                                                          |
| ------------------------------ | ---------------------------------------------------------------- |
| Page title                     | `text-xl font-bold text-lob-dark`                                |
| Card / section title           | `text-base font-semibold text-lob-dark`                          |
| Eyebrow label                  | `text-[10px] font-bold text-lob-muted uppercase tracking-widest` |
| Body                           | `text-sm text-lob-dark`                                          |
| Secondary / supporting         | `text-sm text-lob-muted`                                         |
| Caption / meta                 | `text-xs text-lob-muted`                                         |
| Micro (nav labels, badge text) | `text-[10px] text-lob-muted`                                     |

---

## Card System

Three variants — choose the right one, do not write inline card styles.

### `.card` (default)

`bg-white rounded-2xl p-4` with subtle shadow + thin border. Use for all standard content cards.

### `.card-elevated`

Same shape, stronger shadow. Use for hero/featured cards only (NextEventCard, LeagueDashboardCard).

### Accent card (inline modifier)

```jsx
<div className="card border-l-4 border-lob-amber">…</div>   // warning
<div className="card border-l-4 border-lob-coral">…</div>   // error/action
<div className="card border-l-4 border-lob-teal">…</div>    // info
```

---

## Buttons

Use the components in `src/components/ui`. Do not hand-style a `<button>` or a link that looks like one. The full "need X → use Y" table and the owner decisions are in [`docs/design-system/PLAN.md`](docs/design-system/PLAN.md).

| Component    | Variants                                                                                     | Use                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `Button`     | `primary`, `secondary`, `neutral`, `danger` × `sm` (32px), `md` (40px, default), `lg` (52px) | An action that starts something or takes you somewhere. `danger` only confirms a destructive flow. |
| `TextButton` | tone `accent`, `primary`, `destructive`, `warning`, `neutral`                                | Underlined inline action, and a destructive action that isn't the screen's CTA                     |
| `IconButton` | filled, `ghost`, `ghost-destructive`, `on-dark` × `sm`, `md`                                 | Icon-only action, always with `aria-label`                                                         |

- A small utility action under content (Share, Add to calendar) is `Button variant="neutral" size="sm"`.
- All three take `to` (router link), `href` (anchor) and `external` (new tab). Use a real `href` for links that must open on iOS Safari, which blocks `window.open` as a popup. A disabled link renders as a disabled button.
- The components size their own icons: pass `icon={<Plus />}` or `<X />` with no `size`.
- Layout lives in the components and their parents, not in `className`. `Button fullWidth` fills its container; buttons sharing a row go in `ActionRow` (alternative first, confirm last); `EmptyState` spaces its own action. `Button` and `TextButton` take no `className`. Spacing between elements comes from the parent (`space-y-*`, `gap-*`).

### Where component styles live

Styling lives in the component, as class maps built from Tailwind tokens (see `Button.tsx`), not in global classes in `src/index.css` and not at the call site. Use a co-located CSS module only for what classes can't express. `Skeleton.tsx` + `Skeleton.module.css` is the reference pair. Compose from tokens with `@apply` inside the module; do not hard-code hex values.

---

## Sub-tab Pattern

For pages with 2–3 distinct views:

```jsx
<div className="flex gap-1 bg-lob-teal-light p-1 rounded-xl mb-4">
  {/* active */}
  <button className="flex-1 py-1.5 text-xs font-semibold rounded-lg text-center bg-white text-lob-teal shadow-sm">
    Members
  </button>
  {/* inactive */}
  <button className="flex-1 py-1.5 text-xs font-semibold rounded-lg text-center text-lob-muted">
    Shop
  </button>
</div>
```

Tab track is always `bg-lob-teal-light` (not `bg-gray-100`).

---

## Empty States

```jsx
<div className="card flex flex-col items-center py-10 text-center gap-2">
  <Icon size={36} className="text-lob-muted opacity-40" />
  <p className="text-sm font-semibold text-lob-dark">Nothing here yet</p>
  <p className="text-xs text-lob-muted">Supporting copy</p>
</div>
```

---

## Section Dividers

Use an eyebrow label + optional chevron toggle instead of `<hr>`:

```jsx
<button className="w-full flex items-center justify-between py-3 px-1">
  <span className="text-[10px] font-bold text-lob-muted uppercase tracking-widest flex items-center gap-2">
    <Clock size={13} className="text-lob-muted opacity-60" />
    Past
  </span>
  <ChevronDown size={14} className="text-lob-muted opacity-60" />
</button>
```

---

## Loading States

Spinner: `border-lob-teal border-t-transparent animate-spin`. Reference: `RouteFallback` in `App.jsx`.

---

## Motion

- Press feedback: `active:scale-95 transition-all duration-150` on all interactive elements
- Progress bars: `transition-all duration-500`
- Route entry: `animate-fade-in-up` (defined in tailwind config)

---

## What Not to Touch

- `src/lib/letterColors.ts` — **LOCKED 2026-04-30**, do not change avatar color values
- `.header-gradient` CSS class — keep the exact teal gradient values
- `.card` and `.card-elevated` shadow values — deliberately tuned, do not adjust
- `pb-safe` iOS safe-area utility
- Bottom nav layout, active state, and icon sizes
