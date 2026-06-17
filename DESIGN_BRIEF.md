# Padel Lobsters — Design Brief

## Design Vision

Mobile-first sports community app. The aesthetic is **clean, confident, and a little sporty**: white cards on a warm cream background, a teal/coral brand palette, and just enough personality (the lobster, the warm tones) to feel like a real community and not a generic SaaS dashboard.

The guiding principle: **every screen should feel like a single purpose.** The user opens Home and sees what's next. They open Events and see the list. The UI should be so obvious they never have to hunt.

---

## Layout Shell

### Header (Layout.jsx)

The current header is too tall. The 80×80 logo + title + origin story takes up ~160px before content starts — roughly a third of a phone screen.

**Spec:**
- Logo: reduce to **40×40** (pill/circle), positioned left
- Brand name: `Padel Lobsters` — `text-base font-bold` next to logo
- Right side: Instagram icon + WhatsApp chip (keep as-is, they're fine)
- Origin story: **remove from header entirely.** Move to a collapsible "About" section on the Account page. Nobody needs it in the global chrome.
- Header height target: ~60px total (including `pt-safe` for Dynamic Island)
- Background: keep the `header-gradient` (`#3D7A8A → #2A5A68`)
- Sticky with `z-30`, light bottom shadow

### Bottom Navigation

Current state is correct — keep it. Minor clarification:
- Active tab: `bg-lob-coral/15 text-lob-coral`
- Inactive: `text-lob-muted`
- Icon: 20px, label: `text-[10px]`
- The tab strip itself: `bg-white pb-safe` with subtle top shadow

---

## Page Structure Pattern

Every top-level page follows the same three-layer template:

```
┌─────────────────────────────────┐
│  Page Header                    │  ← title + optional primary CTA
├─────────────────────────────────┤
│  [Sub-tabs, if the page has     │  ← pill tab bar (see below)
│   distinct sections]            │
├─────────────────────────────────┤
│  Content area                   │  ← `space-y-4` cards
└─────────────────────────────────┘
```

### Page Header

All six pages must use the same header pattern inside the content area:

```jsx
<div className="flex items-center justify-between mb-1">
  <h1 className="text-xl font-bold text-lob-dark">Page Title</h1>
  {/* optional: one primary action button */}
</div>
```

**Current inconsistencies to fix:**
| Page | Current | Target |
|------|---------|--------|
| Home | No header (greeting replaces it) | Keep — Greeting IS the header here |
| Events | `<h2 text-lg font-bold text-gray-800>` | `<h1 text-xl font-bold text-lob-dark>` |
| League | `<h1 text-2xl font-bold text-lob-dark>` | Drop to `text-xl` to match |
| Community | No header | `<h1 text-xl font-bold text-lob-dark>Community</h1>` above tabs |
| Account | `<h2 text-lg font-bold text-gray-800>` | `<h1 text-xl font-bold text-lob-dark>` |
| Admin | `<h2 text-lg font-bold text-gray-800>` | `<h1 text-xl font-bold text-lob-dark>` |

---

## Typography Scale

Use only these sizes. Do not reach for raw Tailwind grays — use lob tokens.

| Role | Class | Usage |
|------|-------|-------|
| Page title | `text-xl font-bold text-lob-dark` | One per page |
| Card title / section heading | `text-base font-semibold text-lob-dark` | Top of a card |
| Section label (eyebrow) | `text-[10px] font-bold text-lob-muted uppercase tracking-widest` | Above a group of cards |
| Body | `text-sm text-lob-dark` | Main readable content |
| Secondary / supporting | `text-sm text-lob-muted` | Dates, counts, subtitles |
| Caption / meta | `text-xs text-lob-muted` | Timestamps, helper text |
| Micro label | `text-[10px] text-lob-muted` | Nav labels, badges |

**Raw gray ban**: Stop using `text-gray-800`, `text-gray-600`, `text-gray-500`, `text-gray-400` for content text. Map them to lob tokens:
- `text-gray-800` → `text-lob-dark`
- `text-gray-600` / `text-gray-700` → `text-lob-dark` or `text-lob-muted` depending on weight
- `text-gray-500` → `text-lob-muted`
- `text-gray-400` → `text-lob-muted opacity-70`

---

## Color Token Usage

**Single source of truth:** use `lob-*` tokens everywhere. The `lobster-*` aliases are a legacy duplicate and should not be used in new code. Gradually replace when touching a file.

| Token | Hex | Use |
|-------|-----|-----|
| `lob-teal` | `#3D7A8A` | Links, icons, active states, borders on focused inputs |
| `lob-coral` | `#D94F2B` | Primary CTA buttons, active nav, destructive-adjacent alerts |
| `lob-amber` | `#E8A030` | Warnings, in-progress states, streak indicators |
| `lob-cream` | `#F5F0E8` | Page background (set on body already) |
| `lob-dark` | `#1C2B30` | All body text, headings |
| `lob-muted` | `#6B8A92` | Secondary text, icons, placeholder |
| `lob-teal-light` | `#EAF4F7` | Chip backgrounds, highlighted rows, tab track |
| `lob-coral-light` | `#FAEAE5` | Alert / warning card backgrounds |

**Background colors:**
- Page bg: `bg-lob-cream` (body-level, inherited)
- Cards: `bg-white`
- Highlighted/selected: `bg-lob-teal-light`
- Warning/alert: `bg-lob-coral-light`
- Success: `bg-green-50` (keep — green is semantic here, not brand)

---

## Card System

Three variants. Pick the right one — do not create bespoke inline card styles.

### `.card` (default)
```css
bg-white rounded-2xl p-4
shadow: 0 1px 3px rgba(26,43,48,0.08), 0 4px 16px rgba(26,43,48,0.05)
border: 1px solid rgba(26,43,48,0.06)
```
Use for: standard content cards (event cards, stat cards, settings sections).

### `.card-elevated`
```css
bg-white rounded-2xl p-4
shadow: 0 2px 8px rgba(26,43,48,0.12), 0 8px 24px rgba(26,43,48,0.08)
border: 1px solid rgba(26,43,48,0.04)
```
Use for: hero/featured cards only (NextEventCard, LeagueDashboardCard).

### Alert/accent card (inline — no utility class)
```jsx
<div className="card border-l-4 border-lob-amber">…</div>       // warning
<div className="card border-l-4 border-lob-coral">…</div>       // error/action
<div className="card border-l-4 border-lob-teal">…</div>        // info
```
Use for: banners that need urgent visual weight.

**Fix**: `NextEventCard` currently uses a custom `bg-white/80 backdrop-blur` style — replace with `.card-elevated`.

---

## Button Hierarchy

Only four button types. Do not mix and match sizes arbitrarily.

| Class | Shape | Use |
|-------|-------|-----|
| `.btn-primary` | Coral, `rounded-full`, `py-3 px-5` | One per screen maximum — the single most important action |
| `.btn-secondary` | White/teal border, `rounded-full`, `py-3 px-5` | Second-priority action alongside a primary |
| `.btn-danger` | Red, `rounded-full`, `py-2 px-4` | Destructive confirm (delete, leave) |
| Ghost/icon chip | `bg-gray-100 text-lob-muted rounded-lg px-3 py-1.5 text-xs` | Tertiary actions (Schedule, Payments, Share) |

**Sizing rule**: do not override `.btn-primary` padding with `py-2 px-4 text-sm`. If you need a smaller primary button, use the ghost chip pattern instead.

---

## Sub-Tab Pattern

When a page has 2–3 distinct views (e.g., Community Members/Shop, EventShell tabs), use the pill-track pattern:

```jsx
<div className="flex gap-1 bg-lob-teal-light p-1 rounded-xl mb-4">
  <button className="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all text-center
    bg-white text-lob-teal shadow-sm">   {/* active */}
  <button className="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all text-center
    text-lob-muted">                     {/* inactive */}
```

**Fix needed in CommunityShell**: currently uses `bg-gray-100` track — change to `bg-lob-teal-light` to match the token palette.

---

## Section / List Dividers

Between groups of content within a page, use an eyebrow label rather than a hard `<hr>`:

```jsx
<p className="text-[10px] font-bold text-lob-muted uppercase tracking-widest mt-2 mb-1">
  Past Events
</p>
```

The collapsible "Past" section in Tournament.jsx uses `text-gray-500 font-semibold text-sm` — standardise to the eyebrow pattern above with the `ChevronDown/Up` toggle.

---

## Empty States

```jsx
<div className="card flex flex-col items-center py-10 text-center gap-2">
  <Icon size={36} className="text-lob-muted opacity-40" />
  <p className="text-sm font-semibold text-lob-dark">Nothing here yet</p>
  <p className="text-xs text-lob-muted">Supporting explanation copy</p>
  {/* optional CTA */}
</div>
```

Replace all occurrences of `text-gray-400` in empty states with `text-lob-muted`.

---

## Loading States

Spinner: `border-lob-teal border-t-transparent` — already established. Keep it. The `RouteFallback` in App.jsx is correct and is the reference.

---

## Page-Specific Notes

### Home (/home)
- Best-looking page right now — mostly consistent. 
- CountdownClock uses `bg-lobster-teal-dark` → replace with `bg-lob-teal-dark`.
- Greeting text is distinct by design (hero role) — keep `text-xl font-extrabold text-lob-dark`.

### Events (/events)
- Add `h1` page header per the standard pattern.
- LeagueDashboardCard appearing here is duplicate with Home — consider removing.
- The collapsible "Past" section header needs the eyebrow treatment.

### League (/league)
- `h1 text-2xl` → drop to `text-xl` to match all other pages.
- Good otherwise — clean and minimal.

### Community (/community)
- Add page `h1` above the tab bar.
- Tab track: `bg-gray-100` → `bg-lob-teal-light`.

### Account (/account)
- Change `h2 text-lg text-gray-800` → `h1 text-xl text-lob-dark`.
- App info card at the bottom is charming — keep it.

### Admin (/admin)
- Change `h2 text-lg text-gray-800` → `h1 text-xl text-lob-dark`.
- Tool cards use `.card` correctly — good.

---

## What Not to Touch

- `letterColors.ts` — **LOCKED**, do not change avatar colors.
- `header-gradient` CSS class — keep the exact teal gradient.
- Bottom nav layout and active state behavior.
- `pb-safe` iOS safe area handling.
- `.card` / `.card-elevated` shadow values — they're deliberately tuned.
