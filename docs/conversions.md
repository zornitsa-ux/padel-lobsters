# Feature conversion playbook

Working notes for the run of feature conversions to TypeScript + sliced data
access. Written from the first one (`src/features/history/`, 2026-07-26) and
meant to be followed by `merch`, `community`, `home` and `events`.

This is a process doc, not a reference — delete it once the run is finished.
The permanent architecture rules live in `ARCHITECTURE.md`
("Feature Data Slices", "New Feature Architecture Pattern").

## Step 0 — check whether the feature actually owns server data

**Do this before creating any slice files.** The main surprise in the history
conversion was that `src/features/history/` owns _no_ server data: `History.tsx`
composes `useTournaments`, `usePlayers`, `useAllMatches` and
`useAllRegistrations` from the `events` and `players` slices. Creating
`historyKeys.ts` / `historySchemas.ts` / `historyQueries.ts` would have been
duplicated ownership of tables another slice already owns — two query keys for
one table means two caches that drift.

How to check, per feature folder:

```bash
grep -rn "supabase\.\|from '\.\./\.\./api/" src/features/<feat>/
grep -rn "use[A-Z].*(" src/features/<feat>/ | grep -v "useState\|useMemo\|useCallback\|useEffect"
```

Three outcomes:

1. **Owns tables nothing else reads** → build the full slice
   (`<feat>Keys.ts` · `<feat>Schemas.ts` · `<feat>Queries.ts` · `use<Feat>.ts`).
2. **Consumes other slices only** → no slice files. Convert to TS and stop.
3. **Consumes other slices but has one or two stray direct fetches** → the stray
   fetch belongs in the slice that _owns that table_, not in a new slice for
   this feature. This is what history was: its per-tournament Oscars fetch moved
   to `features/oscars` as `useOscarResultsFor`.

## Step 1 — move stray fetches into the owning slice

Symptoms to grep for: `useEffect` + `async` + `set<Something>` state, or any
direct `api/*` call inside a component. These bypass TanStack Query, so they get
no cross-mount cache, no dedup, no refetch-on-focus and no retry — and they
almost always drop the `error` half of `{ data, error }`.

Rules that came out of the history case:

- Put the hook in the slice that owns the table, not the consuming feature.
- Reuse the existing key factory (`oscarKeys.results(id)`) so a per-entity hook
  and an N-entity hook share one cache entry each. Do **not** invent a
  `results-many` key — that would double-cache the same rows.
- For the N-entity case use `useQueries` with `combine`, not `useQuery` over a
  joined key. Shape the combined result as
  `{ byId, isPending, isError, errors }`.
- Factor the query options into one exported function
  (`oscarResultsQuery(id)`) that both the single-id and multi-id hook spread, so
  the key and the fetcher can't drift.
- **Propagate errors.** `if (error) throw error` in the `queryFn`. A failed
  fetch must be distinguishable from "no rows" — leave the id _absent_ from the
  combined map rather than mapping it to `[]`.

## Step 2 — rename with `git mv`

```bash
git mv src/features/<feat>/Thing.jsx src/features/<feat>/Thing.tsx
```

Do the renames as their own step, before editing, so git records them as renames
and the review diff stays readable.

## Step 3 — type against real shapes

- Import the types the owning slices already export
  (`Player`, `NormalisedTournament` from `src/lib/normalise.ts`;
  `NormalisedMatch`; `NormalisedRegistration`; `ResultRow` from
  `oscarsSchemas.ts`). Some are still loose today; using them anyway means the
  consumer tightens for free when `normalise.ts` is typed.
- **No `any`.** The repo is ratcheting `no-explicit-any` to `error`. Use
  `unknown` and narrow when a shape is genuinely unknowable (e.g. the
  `loadSkipped()` localStorage payload).
- Write for `strict: true` even though `strict` is currently off — put explicit
  return types on exported functions.
- **Untyped `.js` imports:** assert once, at a single named boundary, and put
  the interfaces next to the module that operates on them. History does:

  ```ts
  import { TOURNAMENTS as TOURNAMENTS_RAW } from '../../data/historicalTournaments'
  const TOURNAMENTS = TOURNAMENTS_RAW as unknown as ArchiveTournament[]
  ```

  with `ArchiveTournament` declared in `historicalStats.ts`, extending the
  `HistoricalMatch`/`HistoricalRound` interfaces `src/lib/playerStats.ts`
  already declares so the archive's consumers can't drift. A sibling `.d.ts`
  next to the `.js` was rejected: it would retype the module for all ~10 of its
  importers at once.

- Prefer narrowing an interface over adding a runtime coercion. `ArchiveMatch`
  narrows `s1`/`s2` from `string | number` to `number` (which the data actually
  is) so no `Number()` wrapper had to be introduced — that would have been a
  silent behaviour change.
- String-union state (`type TabId = 'standings' | 'matches' | 'games'`) needs a
  cast at the `TabSwitcher` boundary, whose `onChange` is `(id: string) => void`.
  One `as TabId` per call site is the accepted cost.

## Step 4 — tests

`src/features/history/` had none. What was cheap and worth pinning:

- Pure helpers: every branch of the sort/tiebreak chain, plus a
  "does not mutate the input" case.
- `localStorage` wrappers: empty, populated, and malformed-JSON fallback.
  Needs `// @vitest-environment jsdom`.
- The new query hook: multi-id happy path, cache-key sharing (assert
  `client.getQueryData(<slice>Keys.x(id))`), the error path, and the empty-input
  case.

Use `src/test/renderWithClient.tsx` (`renderHookWithClient`, `makeTestQueryClient`)
— never hand-roll a `QueryClient`; the shared one has `retry: false` so a
rejected `queryFn` surfaces instead of timing out. Use `propsOf`/`childrenOf`
from `src/test/element.ts` for component-shape assertions.

## Step 5 — verify

```bash
npm test && npm run typecheck && npm run lint && npm run format:check && npm run build
```

Record the before/after numbers for tests, lint warnings and `no-explicit-any`
count, and don't regress any of them. If the tree is dirty, take the baseline
with `git stash -u` (the `-u` matters — untracked test files change the count).

Run `npm run format` before `format:check`; Prettier will reflow the renamed
files.

## Ordering note

Convert leaves first (helpers, then presentational components, then the
container). Each leaf's types become the container's vocabulary, so doing it the
other way round means typing the same shapes twice.
