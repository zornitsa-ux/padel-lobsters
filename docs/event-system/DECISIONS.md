# Event system: decisions

## EV-D1 Finished comes from the clock, for every format (2026-11-27)

**Decision:** an event is finished at its scheduled end (start + duration),
or once its ratings are applied, whichever comes first. One rule, in the
database and the client (DESIGN §2).

**Why:** the database read `status = 'completed'` in a dozen places, but
nothing sets it on King of the Court. A past King of the Court stayed
"upcoming" to the database: it didn't count as a played night, blocked
account deletion for everyone in it, and needed completing by hand.

**Supersedes:** in `docs/team-events/DECISIONS.md` D-026, "Americano is
still over only when finished". The rest of D-026 stands: nobody presses
Finish on King of the Court, and its standings are public once saved.

## EV-D2 `completed` means "ratings applied" (2026-11-27)

**Decision:** `status = 'completed'` stays, written only by applying ratings
(today's Finish, renamed "Apply ratings"). It locks scores as today. It no
longer means "over".

**Why:** the ratings double-apply guard, live-score sync and score locking
already key off it. Renaming the column or its values buys nothing now.

## EV-D3 Admin paths keep today's gate (2026-11-27)

**Decision:** player signups are refused once an event is finished. Admin
transfers, partner changes, signups on behalf and cancels stay open until
ratings are applied, as today.

**Why:** after the end an admin may still need to fix who played before
applying ratings, and the rating update refuses a player who isn't
registered. Player-side changes already close before the start.

## EV-D4 A missing start time means 19:00 everywhere (2026-11-27)

**Decision:** `tournament_start_ts` defaults a missing time to 19:00, as the
client does, instead of 00:00.

**Why:** the finished rule must agree on both sides. No production event has
a missing time, so no cutoff moves.

## EV-D5 Standings are withheld by preset, not by status (2026-11-27)

**Decision:** for a preset that reveals standings (Americano), players see
the final ranking only once it's revealed, from creation on. Before, it was
withheld only between Finish and the reveal.

**Why:** with Finished from the clock, an Americano past its end but not yet
revealed would otherwise show its ranking on Home and in past results. It
also closes the results route during the event.

## EV-D6 Today's formats become presets first (2026-11-27)

**Decision:** Americano and King of the Court are described as presets
(parts: entry, play, scoring, standings, ratings) before any new format is
added, and lifecycle code reads the parts instead of `isKingOfTheCourt`.

**Why:** new formats then add a preset rather than
another branch in each of about 30 files.
