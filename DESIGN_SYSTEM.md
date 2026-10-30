# Padel Lobsters Design System

Feature code composes components from `src/components/ui`. Components own colour, size and
state, built on `lob-*` tokens. This file covers conventions; the details live in three places:

| Need                                  | Where                                                                         |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| Which component for a job             | [`docs/design-system/PLAN.md`](docs/design-system/PLAN.md), "Need X → use Y"  |
| Every component and variant, rendered | `/design` in dev (`src/features/design/DesignGallery.tsx`), works signed out  |
| Colour, type and shadow tokens        | [`docs/design-system/TOKENS.md`](docs/design-system/TOKENS.md)                |
| Owner decisions and what is next      | [`docs/design-system/PLAN.md`](docs/design-system/PLAN.md), "Steps" and "Log" |

## Rules

These are enforced in review, and the first two in CI (`npm run design:check`):

- **No hand-built buttons.** Every `<button>` lives in `src/components/ui`. Use `Button`,
  `TextButton`, `IconButton`, `Chip`, `SegmentedControl`, `OptionRow`, `OptionTile`, `MenuItem`,
  `CardLink` and the rest. If none fits, add the variant or prop to the component.
- **Tokens only.** Colours come from `lob-*` tokens, never raw Tailwind palette classes
  (`text-red-600`, `bg-amber-50`) or hex literals. The raw classes still in the code are held
  by a per-file ratchet (`scripts/raw-colours-baseline.json`) that may only go down.
- **Layout belongs to the parent.** Ui components carry no margins. The parent or a layout
  component (`ActionRow`, `space-y-*`, `gap-*`) places them. `Button` and `TextButton` take no
  `className`; their layout props are `fullWidth` and `grow`.
- **Admins acting for another player** see the chosen player named and confirm with
  `useConfirmOnBehalf` (CLAUDE.md, "Admin actions on behalf of others").

## Page structure

```
PageHeader   ← title, optional eyebrow, back link, badge, right action and tabs
Content      ← space-y-4 stack of cards
```

`PageHeader tabs` covers page sections. A choice inside the page is `SegmentedControl`. Dashboard
is the exception: `Greeting` acts as its header.

## Typography

| Role                   | Classes                                                      |
| ---------------------- | ------------------------------------------------------------ |
| Page title             | `PageHeader title`                                           |
| Card / section title   | `text-base font-semibold text-lob-dark`                      |
| Eyebrow label          | `text-2xs font-bold uppercase tracking-wider text-lob-muted` |
| Body                   | `text-sm text-lob-dark`                                      |
| Secondary / supporting | `text-sm text-lob-muted`                                     |
| Caption / meta         | `text-xs text-lob-muted`                                     |

`text-2xs` is the 10px token (11px folded into `text-xs`); `text-[9px]` is still raw. An
`.eyebrow` class is planned (P6).

## Cards

Owner, 2026-10-30 (being applied in P6):

- A card is one thing you act on: an event, a match, a team. Page sections and settings sit on
  the background under a section heading.
- A list of like items is one card with divided rows, not a card per row.
- No card inside a card. Inside a card, use a flat well or a divider.

- `.card`: `bg-white rounded-2xl p-4`, card shadow and hairline border. The default.
- `.card-elevated`: same shape, stronger shadow, for a hero card (`NextEventCard`).
- A card that is one link is `CardLink` (`flush` for a full-bleed band, as on
  `LeagueDashboardCard`), or `LinkCard` for the title / subtitle / chevron card.
- A card that collapses is `CollapsibleCard`; a section label that collapses is
  `CollapsibleSection`.

## States

- Empty: `EmptyState` for an empty page or tab; `variant="inline"` for an empty list inside a
  card, modal or headed section. It sizes its own icon.
- Signed out: `SignInPrompt` (`variant="inline"` in a card). Its Sign in button opens the
  sign-in modal in place. Admin-only pages redirect a non-admin (`AdminRouteGuard`); they never
  ask for an admin sign-in.
- Loading: `Spinner` or `Skeleton`, never `null`, and never the empty state before the data has
  landed. A loading card keeps its title and shows `Spinner size="inline"` in its body.
- Alerts: `AlertBox variant`. Status labels: `Badge tone`, one size; a meaning maps onto a
  tone. A payment state is always `PaymentStatusBadge` (labels and tones in `paymentStatus.ts`).

## Overlays

- **Sheets and dialogs** are `Modal` (a bottom sheet). A task that needs more room is
  `FullScreenDialog`; a short list of choices from the side is `Drawer`. Confirmations go through
  `useConfirm`, or `useConfirmOnBehalf` for an admin acting for another player. All of them build
  on `DialogShell` (Radix Dialog), which keeps Tab inside, hides the page behind, locks its
  scroll and handles a dialog or menu opened from inside another: Escape and outside taps reach
  only the top one.
- **Header:** `title`, and `description` for a line under it. `FullScreenDialog` and `Drawer`
  close with an X there; the sheet has its drag handle. A live status line goes inside the
  dialog, since the page behind is hidden from assistive tech.
- **First focus** goes to the child marked `data-autofocus`, otherwise the dialog itself, so a
  form doesn't pop the phone keyboard. Focus returns to the opener on close.
- **`dismissible`** (the default) closes on Escape and a backdrop tap, and the sheet on a drag
  down. An open menu or search list inside takes Escape first. A sheet with no `title` names
  itself with `labelId`.
- **Menus** are `Menu` + `MenuItem`, on Radix DropdownMenu. Spread the trigger props onto one
  `Button` or `IconButton`. The chosen item's `onSelect` runs once the menu has closed and focus
  is back on the trigger. Suggestions under a search field are `MenuList` (no Radix).
- **Test overlays with real input.** In the browser, use real taps and key presses: a scripted
  `.click()` or jsdom `fireEvent` misses timing bugs like #88.

## Where component styles live

Styling lives in the component, as class maps built from tokens (see `Button.tsx`), not in global
classes in `src/index.css` and not at the call site. Use a co-located CSS module only for what
classes can't express; `Skeleton.tsx` + `Skeleton.module.css` is the reference pair.

## Motion

- Press feedback: `not-disabled:active:scale-95` (the components already apply it).
- Progress bars: `transition-all duration-500`.
- Route entry: `animate-fade-in-up` (Tailwind config).

## What not to touch

- `src/lib/letterColors.ts`: **locked 2026-04-30**, do not change the avatar colour values.
- `bg-header` (`tailwind.config.js`): keep the exact teal gradient values.
- `.card` and `.card-elevated` shadows: deliberately tuned.
- The `pb-safe` iOS safe-area utility.
- Bottom nav layout, active state and icon sizes.
