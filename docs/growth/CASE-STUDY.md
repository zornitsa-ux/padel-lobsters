# Growth case study: new players and event sign-ups

**Question.** How do we get more new players into the community, and more
players into events, with the least extra work for admins?

**Owner's answers (4 Nov 2026)**

- **Goal:** both, new players first. Success is a new player at their first
  event, not just a new account.
- **Community:** open to anyone.
- **Channels today:** the members' WhatsApp group, plus a little Instagram
  posting. There's almost no outreach to people outside the community.
- **Demand:** mixed.
- **Public event view:** a logged-out visitor sees the event details (date,
  venue, format, level, price, spots left) but **no player names**.

Product read is from the code at `main` (`c1dd17a`). The findings come from
read-only aggregates of production data, taken 4 Nov 2026. The figures stay
out of this public repo. The owner holds the baseline privately.

---

## 1. Findings

- **New-player inflow is low and flat.** After the launch, when the existing
  group moved in, few new accounts arrive each month. The one recent rise
  lines up with team events going live (R1, 24 Oct), where players sign up
  _with a partner_. That makes it the first in-app channel that brings in
  outsiders.
- **Many accounts never play.** A sizeable share of accounts has never been
  registered for an event, and that share is higher among recent signups.
- **Events fill, but unevenly.** Completed events have reached their cap.
  "Mixed" demand shows up as fill _speed_ (anywhere from a few days to over
  three weeks) and seat churn, not as empty courts.
- **Cancellations are heavy.** Each one is a spot someone has to re-sell,
  usually by hand in WhatsApp.
- **First-timers per event dropped over the summer**, then picked up in
  October.
- **Retention is strong once someone plays.** Most first-timers come back for
  another event.

### What this says

The product keeps players once they arrive. The leaks are at both ends of the
funnel:

1. **Reach.** Outsiders never see an event (§2).
2. **Activation.** Too many accounts never make it to a first event.

---

## 2. Today's funnel, step by step

| Step                          | Today                                                                                                                                                     | Leak                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **1. Hear about it**          | An admin posts in the members' WhatsApp group. Occasionally on Instagram.                                                                                 | Outsiders aren't in the group.                       |
| **2. See the link**           | `index.html` has one fixed title and **no Open Graph tags**. A pasted event link previews as "Padel Lobsters", with no date, venue, format or spots left. | Nothing makes the link worth tapping.                |
| **3. Open the link**          | `/events/*` is protected (`src/lib/authPaths.ts`, default-deny). A logged-out visitor gets the **sign-in card** and never sees the event.                 | The biggest leak: a wall before any value.           |
| **4. Sign up**                | Self-serve email-code signup exists, with name matching for placeholder accounts.                                                                         | Works, but the visitor's reason (the event) is gone. |
| **5. Register for the event** | Has to find the event again after signup.                                                                                                                 | Context is lost between signup and register.         |
| **6. Share / bring a friend** | No share button or `navigator.share` anywhere. Only team events let a player bring a partner (by email, admin invites).                                   | Members can't easily recruit.                        |
| **7. Come back**              | Strong: most first-timers return.                                                                                                                         | Fine.                                                |

None of this is measured. Signups and registrations don't record where they
came from, so we can't tell an Instagram signup from a WhatsApp forward.

---

## 3. Opportunities

Ranked by impact against effort.

1. **A public event page.** A logged-out visitor sees the details with no
   names, sees spots left, and gets one "Join to play" button. This removes the
   biggest leak, and every other channel depends on it.
2. **Rich link previews.** Each event gets its own title, description and
   preview image (date, format, spots left), so a WhatsApp or Instagram link
   sells itself. Cheap, and it lifts every share.
3. **Signup that returns to the event.** After signing up from an event page,
   land back on it with registration one tap away. That closes the step 4→5
   leak.
4. **A share button.** One tap gives a ready-written message ("King of the
   Court, Sunday, 3 spots left") through the native share sheet
   (WhatsApp, Instagram, copy link). Both admins and members can use it.
5. **Attribution.** Add `?src=` (and a member's referral code) to shared links,
   and store the source on signup and registration. Without this we can't tell
   whether anything here worked.
6. **First-event activation.** For accounts that have never played: a
   "Your first event" card on Home, and an email when an event opens. The
   `send-invite-email` function shows the email path already works.
7. **Bring a friend.** Generalise the team-events partner flow so a member
   can bring a friend to any event. October suggests this is the strongest
   organic channel.
8. **Re-sell cancelled spots.** When a spot frees up, prompt a share ("1 spot
   just opened") or promote from the waitlist. This cuts admin work and gives
   newcomers a way in.

### The capacity tension

Every event fills, so more newcomers means more competition with regulars for
the same courts. If growth works, the next limit is courts, not marketing.
Choices for the owner, once growth needs them (not now):

- Hold a few **first-timer spots** per event.
- Add **events or courts** where demand runs ahead (watch fill speed and the
  waitlist).
- Run **beginner/intro sessions** that act as the first event.

---

## 4. Success metrics

**North star:** **first-time attendees per event**, sustained over the next 3
events after phase 1 ships.

Baselines and numeric targets are held privately by the owner, not in this
repo.

| Metric                                | Direction                 |
| ------------------------------------- | ------------------------- |
| First-time attendees per event        | up                        |
| New accounts per month                | up                        |
| Signups that play within 30 days      | up                        |
| Public event page → signup conversion | measure first, then set   |
| Shares per event                      | measure first, then set   |
| Days to fill an event                 | down, and more consistent |
| Return rate after first event         | hold                      |

---

## 5. Privacy guardrails

- The public page shows **counts, not names**: spots taken and spots left,
  never who registered. Schedule, results and Oscars stay behind sign-in.
- Preview images and share text carry **event facts only**.
- Anon access goes through a dedicated `public_*` view with an explicit column
  list, never through the base tables (the pattern already used for
  `public_tournament_registration_counts`).
- Attribution stores a source label and a referrer's player ID in the
  database only. It never shows up in URLs as a name or email.

The roadmap is in [`PLAN.md`](./PLAN.md).
