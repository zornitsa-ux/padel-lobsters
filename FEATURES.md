# Feature Inventory

All product features, their source files, and per-role access.

**Roles**: `guest` (unauthenticated), `player` (PIN-authenticated), `admin`

---

## Access Matrix Key

| Symbol | Meaning             |
| ------ | ------------------- |
| ✅     | Full access         |
| 👁     | Read-only / view    |
| ❌     | No access           |
| 🔒     | Behind feature gate |

---

## 1. Authentication & Identity

### PIN Login

**Files**: `AppContext.jsx`, `src/lib/authPaths.js`, `src/lib/deviceId.js`

| Feature                     | guest | player | admin |
| --------------------------- | ----- | ------ | ----- |
| See player name list        | ✅    | ✅     | ✅    |
| Enter PIN to claim identity | ✅    | ✅     | ✅    |
| Sign out                    | —     | ✅     | ✅    |
| Change own PIN              | —     | ✅     | ✅    |
| Change admin PIN            | ❌    | ❌     | ✅    |
| Reset another player's PIN  | ❌    | ❌     | ✅    |

**Source component**: `ChangeAdminPinForm.jsx` (admin PIN rotation)

### Device Trust

**Files**: `AppContext.jsx`, `supabase/functions/send-pin-email/`

| Feature                               | guest | player | admin |
| ------------------------------------- | ----- | ------ | ----- |
| Auto-trust during grace window        | ✅    | ✅     | ✅    |
| Probationary mode (approval required) | ✅    | ✅     | —     |
| Approve a device                      | ❌    | ❌     | ✅    |
| Set auto-trust window                 | ❌    | ❌     | ✅    |

### Email PIN Delivery

**Files**: `supabase/functions/send-pin-email/index.ts`, `AppContext.jsx`

- Admin triggers email when creating a player or resetting PIN
- Edge Function → Resend API
- Kinds: `new_signup`, `regenerated`, `forgot_reset`

---

## 2. Dashboard (Home)

**File**: `src/components/Dashboard.jsx`

| Feature                                           | guest | player | admin |
| ------------------------------------------------- | ----- | ------ | ----- |
| Next event countdown                              | 👁    | 👁     | 👁    |
| Register/unregister for next event                | ❌    | ✅     | ✅    |
| "Your Stats" card (win rate, recent form, streak) | ❌    | ✅     | ✅    |
| Transfer offer banners (incoming + outgoing)      | ❌    | ✅     | ✅    |
| Unpaid players alert                              | ❌    | ❌     | ✅    |
| Upcoming birthday alerts (7-day window)           | ❌    | ❌     | ✅    |
| New merch order alerts (Realtime)                 | ❌    | ❌     | ✅    |
| Lobster League tile                               | ❌    | 🔒     | ✅    |

League tile is gated: visible to `admin` or players with first name in `TEST_PLAYER_FIRST_NAMES`.

---

## 3. Events (Tournament Management)

**File**: `src/components/Tournament.jsx`

### Event Discovery

| Feature                                    | guest | player | admin |
| ------------------------------------------ | ----- | ------ | ----- |
| View upcoming events (GuestTournamentView) | 👁    | 👁     | 👁    |
| See registration counts                    | 👁    | 👁     | 👁    |
| See registered player names                | ❌    | ✅     | ✅    |

Guest view is powered by `public_tournament_registration_counts` view — never exposes player names.

### Registration & Waitlist

**File**: `src/components/Registration.jsx`

| Feature                                 | guest | player | admin |
| --------------------------------------- | ----- | ------ | ----- |
| Register for an event                   | ❌    | ✅     | ✅    |
| Join waitlist when full                 | ❌    | ✅     | ✅    |
| Cancel own registration                 | ❌    | ✅     | ✅    |
| Mark registration as paid               | ❌    | ❌     | ✅    |
| Move player from waitlist to registered | ❌    | ❌     | ✅    |

### Spot Transfer System

**Files**: `src/components/TransferSpotModal.jsx`, `src/components/TransferPendingModal.jsx`, `src/components/TransferAccept.jsx`

| Feature                                           | guest | player | admin |
| ------------------------------------------------- | ----- | ------ | ----- |
| Propose to transfer own spot                      | ❌    | ✅     | ✅    |
| Accept transfer via deep link (`/?transfer=<id>`) | ❌    | ✅     | ✅    |
| Cancel outgoing transfer proposal                 | ❌    | ✅     | ✅    |
| Execute any transfer (admin override)             | ❌    | ❌     | ✅    |

`TransferAccept.jsx` guards against wrong-identity acceptance — shows a "you are signed in as X, not Y" message with a sign-out option.

### Event Creation & Admin

| Feature                                                | guest | player | admin |
| ------------------------------------------------------ | ----- | ------ | ----- |
| Create new event                                       | ❌    | ❌     | ✅    |
| Edit event details                                     | ❌    | ❌     | ✅    |
| Cancel / archive event                                 | ❌    | ❌     | ✅    |
| Set booking mode (`admin_all` vs `player_responsible`) | ❌    | ❌     | ✅    |
| Add per-court Tikkie links                             | ❌    | ❌     | ✅    |
| Add to calendar (Google Calendar URL)                  | ❌    | ✅     | ✅    |
| Share event via WhatsApp                               | ❌    | ✅     | ✅    |

---

## 4. Match Schedule

**File**: `src/components/Schedule.jsx`

| Feature                             | guest | player | admin |
| ----------------------------------- | ----- | ------ | ----- |
| View match schedule                 | ❌    | ✅     | ✅    |
| Generate schedule (Lobster Matcher) | ❌    | ❌     | ✅    |
| Edit match assignments              | ❌    | ❌     | ✅    |
| Enter match scores                  | ❌    | ❌     | ✅    |

**Schedule generation** uses the simulated annealing optimizer in `src/lib/lobsterMatcher.js`. Gender modes: `mixed`, `men_only`, `women_only`.

---

## 5. Scores & Standings

**File**: `src/components/Scores.jsx`, `src/lib/standings.js`

| Feature                     | guest | player | admin |
| --------------------------- | ----- | ------ | ----- |
| View live standings         | ❌    | ✅     | ✅    |
| View completed match scores | ❌    | ✅     | ✅    |

Standings algorithm: 1) total game points, 2) matches won, 3) head-to-head. Single source of truth shared with player profile ranks.

---

## 6. Payments

**File**: `src/components/Payments.jsx`

| Feature                          | guest | player | admin |
| -------------------------------- | ----- | ------ | ----- |
| View own payment status          | ❌    | ✅     | ✅    |
| View all players' payment status | ❌    | ❌     | ✅    |
| Mark player as paid              | ❌    | ❌     | ✅    |
| View court cost breakdown        | ❌    | ❌     | ✅    |

---

## 7. Player Profiles & Stats

**File**: `src/components/Players.jsx`, `src/lib/playerStats.js`, `src/lib/playerHistory.js`

| Feature                           | guest | player | admin |
| --------------------------------- | ----- | ------ | ----- |
| Browse player list                | ❌    | ✅     | ✅    |
| View own full profile             | ❌    | ✅     | ✅    |
| View other players' full profiles | ❌    | ✅     | ✅    |
| Edit own name/avatar/nationality  | ❌    | ✅     | ✅    |
| Edit any player's profile         | ❌    | ❌     | ✅    |
| Add/remove player                 | ❌    | ❌     | ✅    |

### Profile Sections

**"Lifetime Stats"** (DB matches only):

- Played, Won, Lost, Win Rate
- Points For/Against, Point Differential
- Recent form (last 5 matches): W/L/D chips
- Best win streak, worst loss streak

**"Rivalries & Chemistry"**:

- Nemesis: opponent with most wins against this player
- Best partner: teammate with highest win rate together
- Head-to-head table (individual + pair level)

**"Lobster Review"** (per-tournament ranks):

- Uses `computeTournamentStandings()` — same algorithm as Scores tab

**"Historical Appearances"**:

- Derived from hardcoded `TOURNAMENTS` in `History.jsx` + `player_aliases` table
- Shows rank, total points, match record per historical tournament
- Podium pins (🥇🥈🥉) for top-3 finishes

**"Glicko-2 Rating"**:

- `learnedLevel = (learned_rating - 1200) / 100`
- Shown as padel level (e.g., 3.2)

### Historical Name Matching (Admin Tool)

**File**: `src/components/PlayerAliasMatcher.jsx`

| Feature                                     | admin |
| ------------------------------------------- | ----- |
| View all historical names with alias status | ✅    |
| Link historical name → current player       | ✅    |
| Mark name as "Not in roster"                | ✅    |
| Fuzzy suggestions via `suggestPlayers()`    | ✅    |

---

## 8. History

**File**: `src/components/History.jsx`

| Feature                            | guest | player | admin |
| ---------------------------------- | ----- | ------ | ----- |
| View historical tournament results | ❌    | ✅     | ✅    |

Static page displaying the hardcoded `TOURNAMENTS` array. No writes. Pre-Supabase tournament records (up to approximately late 2025).

---

## 9. Lobster Oscars (In-Tournament Awards)

**File**: `src/components/Game.jsx`

Session lifecycle: `not_created` → `pre_start` → `active` → `ended` → `shared`

| Feature                         | guest | player | admin |
| ------------------------------- | ----- | ------ | ----- |
| View current session phase      | ❌    | ✅     | ✅    |
| Cast/change vote (active phase) | ❌    | ✅     | ✅    |
| View own votes                  | ❌    | ✅     | ✅    |
| Create session                  | ❌    | ❌     | ✅    |
| Start voting                    | ❌    | ❌     | ✅    |
| End voting                      | ❌    | ❌     | ✅    |
| View live vote stats (10s poll) | ❌    | ❌     | ✅    |
| Share results                   | ❌    | ❌     | ✅    |
| Edit categories                 | ❌    | ❌     | ✅    |

Default categories: 6 core categories + 2 rotating based on gender composition of the session.

---

## 10. Merch Shop

**File**: `src/components/Merch.jsx`

### Shopping

| Feature                                          | guest | player | admin |
| ------------------------------------------------ | ----- | ------ | ----- |
| Browse shop                                      | ❌    | ✅     | ✅    |
| Place order (size + optional name customization) | ❌    | ✅     | ✅    |
| View own orders                                  | ❌    | ✅     | ✅    |
| Cancel own pending order                         | ❌    | ✅     | ✅    |
| View product image lightbox                      | ❌    | ✅     | ✅    |

Name customization (+€5) available on shirts, not tank tops.

### Admin Management

| Feature                                                      | admin |
| ------------------------------------------------------------ | ----- |
| View all orders                                              | ✅    |
| Update order status (ordered → paid → delivered → cancelled) | ✅    |
| Add/edit/delete merch items                                  | ✅    |
| Reorder items (drag-and-drop, persists `display_order`)      | ✅    |
| Upload up to 3 images per item                               | ✅    |
| Set `external_orders` count (offline/WhatsApp sales)         | ✅    |
| Receive Realtime new-order alerts on Dashboard               | ✅    |

### Raffle System

| Feature                       | guest | player | admin |
| ----------------------------- | ----- | ------ | ----- |
| View raffle (in Merch tab)    | ❌    | ✅     | ✅    |
| See own eligibility status    | ❌    | ✅     | ✅    |
| Draw raffle winner            | ❌    | ❌     | ✅    |
| Edit prize label for a winner | ❌    | ❌     | ✅    |

Eligibility rules (checked on draw):

- New players (no prior tournament registrations) get a bonus entry
- Players who won within the last N tournaments (default 2) are excluded
- Players who already won at the current tournament are excluded

---

## 11. Lobster League

**File**: `src/components/League.jsx`

Access is gated: visible to `admin` or players whose first name is in `TEST_PLAYER_FIRST_NAMES`.

### Player Flow

| Feature                                         | player | admin |
| ----------------------------------------------- | ------ | ----- |
| Register interest + experience level            | ✅     | ✅    |
| Mark as "looking for partner"                   | ✅     | ✅    |
| Invite another interested player to form a team | ✅     | ✅    |
| Accept/decline team invite                      | ✅     | ✅    |
| View confirmed team details                     | ✅     | ✅    |

### Admin Management

| Feature                                  | admin |
| ---------------------------------------- | ----- |
| Create/edit league                       | ✅    |
| Toggle visibility (`admin` / `all`)      | ✅    |
| Edit content sections (inline rich text) | ✅    |
| Set league phase date ranges             | ✅    |
| View all registered teams                | ✅    |
| Dissolve a confirmed team                | ✅    |

League phases with configurable date ranges: signup, group_stage, quarterfinals (optional), semifinals, finals.

---

## 12. Settings

**File**: `src/components/Settings.jsx`

| Feature                                          | player | admin |
| ------------------------------------------------ | ------ | ----- |
| Edit own name, nationality, avatar               | ✅     | ✅    |
| Change own PIN                                   | ✅     | ✅    |
| Manage Playtomic level                           | ✅     | ✅    |
| View all players + admin controls                | ❌     | ✅    |
| Manage device approvals                          | ❌     | ✅    |
| Set auto-trust window                            | ❌     | ✅    |
| Trigger Glicko-2 ratings recompute               | ❌     | ✅    |
| Manage player aliases (historical name matching) | ❌     | ✅    |
| Change admin PIN                                 | ❌     | ✅    |

---

## 13. WhatsApp Integration

**File**: `src/lib/whatsapp.js`

| Feature                              | Accessible from                    |
| ------------------------------------ | ---------------------------------- |
| "Join WhatsApp Group" button         | Layout header (all users)          |
| Share event via WhatsApp             | Tournament.jsx, CalendarPieces.jsx |
| Spot transfer deep link via WhatsApp | TransferSpotModal.jsx              |

Group URL is hardcoded in `whatsapp.js`. Base app URL: `https://padelobsters.nl`.

---

## 14. Calendar Integration

**File**: `src/lib/calendar.js`, `src/components/CalendarPieces.jsx`

| Feature                  | Notes                                                            |
| ------------------------ | ---------------------------------------------------------------- |
| "Add to Calendar" button | Opens Google Calendar URL (not .ics — avoids iOS popup blocking) |
| Two alarms               | 24h + 2h before event                                            |
| Share via WhatsApp       | Builds `wa.me/?text=` with event details                         |

`DateTile` component: visual calendar tear-off used on event cards (sizes: sm/md/lg).

---

## 15. Country Picker

**File**: `src/components/CountryPicker.jsx`

Searchable dropdown with `flagcdn.com` flag images. 65 countries. Used in player profile (nationality field).

---

## Feature Gates Summary

| Feature                        | Gate                               |
| ------------------------------ | ---------------------------------- |
| Lobster League visibility      | Admin OR first-name in test list   |
| Lobster Oscars                 | Admin-created session required     |
| Raffle                         | Admin-only draw                    |
| Historical data (player stats) | Requires alias mapping by admin    |
| Device trust bypass            | `settings.auto_trust_until` window |
