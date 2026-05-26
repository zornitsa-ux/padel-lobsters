# League Navigation Redesign — Design Spec

**Status**: Ready for engineering  
**Scope**: `src/features/league/LeaguePage.tsx`, child UI components, and routing  
**Audience**: Engineering agent implementing the player-facing view

---

## Problem

The current player view stacks up to **three independent tab bars** before any content is visible:

```
[Men's | Women's]           ← Division tabs (sticky)
[Group Stage | Knockout]    ← Stage tabs
[🥇 Gold | 🥈 Silver]     ← Bracket tabs
```

On a mobile viewport this is visually heavy, spatially wasteful, and creates no sense of where the user is or where they can go. There is no back navigation, no league phase context, and no hierarchy — it reads as three disconnected controls governing the same scroll container.

---

## Design Goals

1. **One active navigation affordance at a time** — never stack multiple tab bars
2. **Phase-aware content** — show what's relevant to the current league phase automatically
3. **Orientation** — the user always knows where they are and can go backward
4. **Progressive disclosure** — surface the most important information first; reveal detail on demand

---

## Information Hierarchy

The league has a clear hierarchy that the navigation should mirror:

```
League
└── Division (Men's / Women's)           ← persistent filter
    ├── My Match                          ← personalized, highest priority
    ├── Group Stage                       ← phase 1 (primary view during group_stage)
    │   ├── Group A standings
    │   ├── Group B standings
    │   └── Results
    └── Knockout                          ← phase 2 (primary view during knockout/completed)
        ├── Gold bracket
        ├── Silver bracket
        ├── Knockout results
        └── Group Stage (historical)      ← secondary, behind a link
            ├── Final standings
            └── All group results
```

---

## Proposed Navigation Structure

### 1. League Header (screen top, not sticky)

A hero-style header section containing:

- **League name** — large, `font-display`
- **Phase pill** — small status badge, right-aligned or below the name

Phase pill labels and colors:

| `league.status` | Label       | Color       |
| --------------- | ----------- | ----------- |
| `draft`         | Registering | `lob-amber` |
| `group_stage`   | Group Stage | `lob-teal`  |
| `knockout`      | Knockout    | `lob-coral` |
| `completed`     | Completed   | gray        |

The phase pill gives players instant orientation — they can see at a glance that the league is in Group Stage without having to read any tabs.

---

### 2. Division Filter (compact pill row, sticky)

Replace the full-width `TabSwitcher` with a compact **pill chip row** that sticks below the safe area / nav bar.

**Appearance:**

- Two chips: `Men's` and `Women's`
- Chips are left-aligned (not stretched to full width)
- Active chip: `bg-lob-teal text-white`
- Inactive chip: `bg-gray-100 text-gray-500 border border-transparent`
- Chip height: 28–32px, `rounded-full`, `text-sm font-medium`
- Container: `px-4 py-2 bg-lob-cream border-b border-gray-100 sticky top-0 z-10`

**Why compact pills instead of full-width tabs:**  
The division is a persistent filter, not a primary navigation level. Full-width tabs imply the two divisions are equally the focus of every screen state. Compact pills communicate "this is a filter on the content below" and free up vertical space.

**If only one division exists** (single-gender league): hide the pill row entirely.

---

### 3. My Match Card (conditional hero)

If the authenticated user has a team in the selected division, show a **My Match card** immediately below the division pills, before any other content.

This card already exists (`PendingMatchCard`). Keep it, but promote its visual weight:

- Full-width card with `lob-teal` left border or subtle teal background tint
- Label: "Your next match" above the match details
- No changes to the card internals required

If no match is pending, omit the card entirely (no empty state placeholder here).

---

### 4. Phase-Driven Content (replaces stage tabs)

Remove the `[Group Stage | Knockout]` `TabSwitcher`. Instead, render content sections based on `league.status`. The user does not need to choose which phase to view — the league's current phase determines what is shown.

#### Draft phase (`league.status === 'draft'`)

Single section: **Teams**

- `SectionHeader`: person icon + "Teams (N)"
- `TeamsList` component (unchanged)
- No standings, no results, no bracket — league hasn't started

#### Group Stage phase (`league.status === 'group_stage'`)

Two sections, always both visible, separated by section headers:

**Section A: Standings**

- `SectionHeader`: chart icon + "Standings"
- Group A and Group B rendered as separate subsections within the same scroll context
- Each group has a small label ("Group A", "Group B") as a lightweight `text-xs uppercase tracking-wide text-lob-muted` heading above its table — not a `SectionHeader`, just a label
- `GroupStandingsTable` (unchanged)
- Dashed cutoff line after rank #2 (retain existing behavior)

**Section B: Schedule & Results**

- `SectionHeader`: calendar icon + "Matches"
- Upcoming/pending matches listed first (if any)
- Completed results listed below, separated by a `text-xs` divider label "Completed"
- If more than 5 completed results, show only the 5 most recent with a "Show all (N)" text button that expands inline

#### Knockout phase (`league.status === 'knockout'`)

Three sections:

**Section A: Bracket**

- `SectionHeader`: trophy icon + "Bracket" + **inline Gold/Silver toggle** in the `action` slot
- The Gold/Silver toggle lives in `SectionHeader`'s existing `action` prop — a small two-option segmented control, `text-xs`, no icons required
- Only the bracket visualization changes when toggling; the section header and results below are unaffected
- `KnockoutBracket` (unchanged)

**Section B: Knockout Results**

- `SectionHeader`: check icon + "Results"
- Lists completed knockout match cards

**Section C: Group Stage (historical)**

- `SectionHeader`: archive icon + "Group Stage" + a right-aligned text link "View →"
- Below the header, show only the final standings tables (Group A and Group B) — compact, read-only, no match cards
- The "View →" link navigates to a dedicated `GroupStageHistoryPage` (see below)

This section is intentionally minimal — final standings give enough context (who advanced, who didn't) without surfacing all match results inline. Users who want the full record follow the link.

**Why not hide it entirely:** Players will want to know how the bracket seeding was determined. Showing the final group standings answers that question without cluttering the primary knockout view.

#### Completed phase (`league.status === 'completed'`)

Same as knockout phase. The phase pill shows "Completed". No structural change needed beyond that pill.

---

### 6. Group Stage History Page

A secondary page reachable from the "View →" link in the knockout phase's Group Stage section.

**Route:** `/league/group-stage` (or render as a full-screen `BottomSheet` pushed from the league page — implementation choice)

**Content (read-only, no interaction except team tap):**

- Header: "Group Stage" + back/close button
- Division pill filter (same compact pills, same behavior)
- Final standings tables (Group A, Group B)
- All group stage results in full (`LeagueMatchCard` list), oldest first
- No "Show all" truncation — this page exists specifically to see everything

**Back navigation:** Back button or swipe-down returns to the league page at scroll position before the user tapped "View →".

---

### 5. Team Detail — Slide-Up Sheet (replaces centered modal)

`TeamPage` currently opens in a generic `Modal`. Replace with a bottom sheet that slides up from the bottom of the screen (common mobile pattern).

**Sheet behavior:**

- Slides up to ~85% of viewport height
- Has a drag handle (`div` with gray pill, centered at top of sheet)
- Tapping the backdrop or dragging down dismisses it
- Sheet header: team name left-aligned + "✕" button right-aligned

**Back navigation context:**  
When a user taps a team name in the standings or results, they expect to go back to exactly where they were. The sheet dismissal (swipe down or ✕) accomplishes this — no URL change needed, no breadcrumb required.

This is a UI-only change (no routing changes). The `Modal` component wrapper can be replaced with a new `BottomSheet` component.

---

## Component Changes Summary

| Component                           | Change                                                                                                                                                                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LeaguePage.tsx`                    | Swap `useActiveLeague()` → `useLeagueById(id)` from `useParams()`; remove `STAGE_TABS` and `BRACKET_TABS` TabSwitchers; render phase-driven sections based on `league.status`; add phase pill and "Past seasons →" link |
| Division `TabSwitcher`              | Replace with compact pill chip row (new inline styles or inline component)                                                                                                                                              |
| `KnockoutBracket` section           | Move Gold/Silver toggle into `SectionHeader` action slot                                                                                                                                                                |
| `TeamPage` modal                    | Wrap in `BottomSheet` instead of `Modal`                                                                                                                                                                                |
| `App.jsx`                           | Replace single `/league` route with three routes: `/league`, `/league/:id`, `/league/:id/group-stage`                                                                                                                   |
| `LeagueDashboardCard.tsx`           | Update nav link target from `/league` → `/league/:activeId`                                                                                                                                                             |
| **New** `LeagueIndexPage.tsx`       | Redirects to active league; fallback season list when no active league                                                                                                                                                  |
| **New** `useLeagueById` hook        | Single-league fetch by primary key; add to `useLeagueQueries.ts`                                                                                                                                                        |
| **New** `BottomSheet.tsx`           | Slide-up sheet component with drag handle, backdrop, dismiss behavior                                                                                                                                                   |
| **New** `GroupStageHistoryPage.tsx` | Read-only page: final standings + all group results; reachable from knockout/completed view                                                                                                                             |

---

## Routing

### Route structure

| Route                     | Renders                 | Notes                                                                                                           |
| ------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `/league`                 | `LeagueIndexPage`       | Resolves active league; redirects to `/league/:id` if one exists. If no active league, renders the season list. |
| `/league/:id`             | `LeaguePage`            | Loads the specified league by ID. Works for active and historical leagues alike.                                |
| `/league/:id/group-stage` | `GroupStageHistoryPage` | Read-only group stage view; reachable from knockout/completed phases.                                           |

### Active league priority

- The app nav item "League" and `LeagueDashboardCard` both call `useActiveLeague()` and navigate to `/league/:activeId`. Active league always gets the direct path.
- `LeagueIndexPage` at `/league` exists only as a resolver and fallback — most players will never see it unless there is no active league.
- When no active league exists, `LeagueIndexPage` renders a list of completed seasons so past leagues are still accessible.

### `LeagueIndexPage` (new, minimal)

Renders when there is no active league:

- Heading: "Leagues"
- List of completed leagues, most recent first: league name + year + "Completed" badge
- Each row navigates to `/league/:id`
- If there is an active league, this page never renders — the redirect fires immediately

### "Past Seasons" link

When viewing any league (active or historical), the league header includes a small "Past seasons →" link that navigates to `/league` (the index). This gives users an escape hatch without occupying prominent space.

### Data layer changes

`LeaguePage` currently calls `useActiveLeague()` and derives `league.id` from it. With ID-based routing:

- Add `useLeagueById(id: string)` hook in `useLeagueQueries.ts` — fetches a single league row by primary key. `fetchAllLeagues()` already exists so this is a one-query addition.
- `LeaguePage` reads `id` from `useParams()` and calls `useLeagueById(id)` instead of `useActiveLeague()`.
- `useLeagueTeams(leagueId)` and `useLeagueMatches(leagueId)` are already parameterised — **no changes needed**.
- `LeagueAdminSection` continues to use `useActiveLeague()` internally; admin tools are only ever for the active league, so this is correct.
- `LeagueDashboardCard` continues to use `useActiveLeague()` for the dashboard widget — also correct.

### App.jsx changes

```
// Before
<Route path="/league" element={<LeaguePage />} />

// After
<Route path="/league" element={<LeagueIndexPage />} />
<Route path="/league/:id" element={<LeaguePage />} />
<Route path="/league/:id/group-stage" element={<GroupStageHistoryPage />} />
```

`LeagueIndexPage` handles the redirect:

```ts
const { data: active } = useActiveLeague()
if (active) return <Navigate to={`/league/${active.id}`} replace />
// else render completed seasons list
```

### `useLegacyNavigate` adapter

The existing `useLegacyNavigate` in `App.jsx` maps `case 'league': navigate('/league')`. This continues to work — `/league` redirects to the active league automatically. No change needed.

---

## What Does Not Change

- `GroupStandingsTable` — no changes
- `KnockoutBracket` and `BracketMatchSlot` — no changes
- `LeagueMatchCard` — no changes
- `PendingMatchCard` — no changes, only promoted visually
- `SectionHeader` — no changes (already has `action` slot)
- `LeagueAdminSection` — out of scope for this redesign; continues to use `useActiveLeague()`
- `LeagueDashboardCard` — continues to use `useActiveLeague()`; link target updates to `/league/:activeId`

---

## Mobile Layout Sketch

Group stage phase layout:

```
┌─────────────────────────────┐
│  Summer League 2026         │  ← header (not sticky)
│                  [Group Stage]│  ← phase pill
├─────────────────────────────┤
│  ● Men's   ○ Women's        │  ← sticky pill filter
├─────────────────────────────┤
│  ┌───────────────────────┐  │
│  │ Your next match       │  │  ← My Match card (if applicable)
│  │  Lobsters vs Sharks   │  │
│  └───────────────────────┘  │
│                             │
│  ⊟ Standings                │  ← SectionHeader
│                             │
│  Group A                    │  ← lightweight label
│  ┌─────────────────────┐   │
│  │ # Team   W L Pts +/−│   │
│  │ 1 Lobst  3 0  9  +8 │   │  ← user's team highlighted
│  │ 2 Sharks 2 1  6  +2 │   │
│  │- - - - - - - - - - -│   │  ← cutoff line
│  │ 3 Bears  1 2  3  −3 │   │
│  └─────────────────────┘   │
│                             │
│  Group B                    │
│  ┌─────────────────────┐   │
│  │ ...                 │   │
│  └─────────────────────┘   │
│                             │
│  📅 Matches                 │  ← SectionHeader
│  [upcoming matches]         │
│  ── Completed ──            │
│  [result cards x5]          │
│  Show all (12) ↓            │
└─────────────────────────────┘
```

Knockout phase layout:

```
┌─────────────────────────────┐
│  Summer League 2026         │
│                   [Knockout]│  ← phase pill
├─────────────────────────────┤
│  ● Men's   ○ Women's        │
├─────────────────────────────┤
│  🏆 Bracket    [Gold|Silver]│  ← SectionHeader with inline toggle
│  ┌─────────────────────┐   │
│  │   [bracket SVG]     │   │
│  └─────────────────────┘   │
│                             │
│  ✓ Results                  │  ← knockout results
│  [result cards]             │
│                             │
│  ◫ Group Stage   View →    │  ← SectionHeader with link
│  Group A  (final standings) │  ← compact, read-only tables
│  Group B  (final standings) │
└─────────────────────────────┘
```

Group stage history page (reached via "View →"):

```
┌─────────────────────────────┐
│  ← Group Stage              │  ← back button
├─────────────────────────────┤
│  ● Men's   ○ Women's        │
├─────────────────────────────┤
│  ⊟ Standings                │
│  Group A  [full table]      │
│  Group B  [full table]      │
│                             │
│  ✓ All Results              │
│  [every match card,         │
│   oldest first, no truncate]│
└─────────────────────────────┘
```

---

## Implementation Notes for Engineering

- The `BottomSheet` component should use `transform: translateY` with a CSS transition for the slide animation — no library dependency required
- The Gold/Silver segmented control in the `SectionHeader` action slot can be a minimal inline element: two `<button>` tags in a `<div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">` — active gets `bg-lob-teal text-white`, inactive gets `bg-white text-gray-500`
- Compact pill chips for division: implement as an inline component in `LeaguePage.tsx` rather than a new shared component — it is league-specific
- The phase pill in the header uses the existing `Badge` component (`src/components/ui/Badge.tsx`)
- `league.status` is already available in `LeaguePage` via context — no new data fetching required
- The "Show all" results expansion can use a `useState` boolean local to the matches section; no need for routing or URL params
