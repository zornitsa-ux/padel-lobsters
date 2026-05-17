// Long-form league copy. Keeps League.jsx readable. Each block renders
// inside a collapsible <details> section on the page. Update the strings here
// to change the public text — no other file needs to change.

export const LEAGUE_SECTIONS = [
  {
    key: 'welcome',
    icon: '🦞',
    title: 'Welcome to the League',
    body: `Join us this summer for the first edition of the Lobster League! Form your team and get ready for an exciting season of padel competition.

You'll compete in a group stage where you'll play three matches against each team in your group, then advance to the playoff bracket where you could compete for the championship or silver title.

Why you should join:
• 🏆 Competitive but friendly — Everyone plays to win, but we're all here for the love of the game
• 📅 Flexible scheduling — You organize your matches around your life, not the other way around
• 🥇 Everyone gets their moment — With gold and silver brackets, every team has something to play for
• 🎉 Community atmosphere — We'll bring everyone together for an exciting Finals Day

Ready? Register your interest below, then invite your partner to form your team.`,
  },
  {
    key: 'how',
    icon: '🎾',
    title: 'How It Works',
    body: `The Two-Stage Format

The league runs in two phases: a Group Stage where everyone plays to earn their ranking, followed by a Playoff Bracket where the best teams battle it out.

Group Stage (5 weeks)
• Play in a small group of 4 teams
• Face each opponent once (3 matches total)
• Self-scheduled — coordinate with your opponents to find times that work
• Win matches to earn points and climb your group standings

Playoff Bracket (single elimination)
• Top 2 teams from each group → Gold Bracket (championship)
• Bottom 2 teams from each group → Silver Bracket (silver title)
• One loss and you're out — every match matters
• Both finals on the same day so we can all celebrate together

Divisions
• Men's and Women's divisions, provided enough signups
• If one division is short, we combine into a single Open division`,
  },
  {
    key: 'timeline',
    icon: '🗓️',
    title: 'Season Timeline',
    body: `Here's what the season looks like:

Signups            Now → May 18     Register your team before spots fill up
Group Stage        May 25 → June 28 5 weeks to play your 3 group matches
Semifinals         June 29 → July 12 Top teams battle it out
Finals             July 13 → July 26 Gold + silver finals on the same day

If we get 3–4 groups (12+ teams per division), a quarterfinal round is added:

Group Stage        May 25 → June 28
Quarterfinals      June 29 → July 12
Semifinals         July 13 → July 26
Finals             July 27 → Aug 9

Total time: ~9–11 weeks, roughly 1 match per 1–2 weeks during groups, tighter in playoffs.`,
  },
  {
    key: 'signup',
    icon: '📝',
    title: 'What We Need From You',
    body: `Team Details
• Team name (get creative!)
• Player 1 name and phone number
• Player 2 name and phone number
• Team song (optional — played at finals day!)

Division Preference
• Men's Division or Women's Division

Team Experience Level (helps create balanced groups)
• Beginner — Building the fundamentals · KNLTB 9–8
• Intermediate — Sustaining rallies, fewer unforced errors · KNLTB 7–6
• Advanced — Competing frequently at a high level · KNLTB 5 or lower

Agreement
• Confirmation that you've read the league rules and agree to the code of conduct`,
  },
  {
    key: 'scheduling',
    icon: '📆',
    title: 'Scheduling Your Matches',
    body: `Once fixtures are out, the ball's in your court.

Group Stage: 3 matches to play over 5 weeks. Self-service — teams book courts and contact opponents. Unplayed matches may be recorded as forfeits.

Playoff Bracket: 2-week window per round to schedule and complete your match.

Coordination tools:
• Doodle — poll with available dates, share link with opponents
• When2meet — grid availability, overlapping slots highlighted
• WhatsApp Polls — quick if you're already in a group chat`,
  },
  {
    key: 'rules',
    icon: '⚔️',
    title: 'Match Rules',
    body: `Standard padel rules apply, with these tweaks:

Match Format
All matches are best of 2 sets. If each team wins one set, a match tiebreak to 10 points (win by 2) decides the match.
Finals exception: Both the gold and silver finals are full best of 3 sets (no match tiebreak).

The "Star Point" (Deuce Rule)
Same system as Premier Padel:
1. First Deuce: Play with advantage/disadvantage.
2. Second Deuce: Play with advantage/disadvantage again.
3. Third Deuce: Golden Point. The receiving team picks which side receives. Winner of this single point wins the game.`,
  },
  {
    key: 'scoring',
    icon: '📈',
    title: 'Scoring & Standings',
    body: `Group Stage Points
Win = 1 point · Loss = 0 points

Tiebreakers (in order)
1. Head-to-head result between tied teams
2. Set Difference — sets won minus sets lost
3. Game Difference — games won minus games lost
4. Coin toss (if still tied)

Playoff Bracket
Single elimination. Winners advance, losers go home (until Finals Day).

Seeding
• Group winners face 2nd-place teams for favorable matchups
• Same-group teams kept apart until the finals when possible
• Bracket is published once group stage results are final`,
  },
  {
    key: 'reporting',
    icon: '📝',
    title: 'Reporting Results',
    body: `Don't let your hard work go unnoticed.

• Report in the WhatsApp group within 24 hours of the match
• Include: both team names, final set scores (e.g. 6-4, 6-2), date played
• Scores are final 48 hours after submission`,
  },
  {
    key: 'fairplay',
    icon: '🤝',
    title: 'Fair Play & Forfeits',
    body: `• Cancellations: Tell your opponent ASAP and try to reschedule.
• Forfeits: If one team can't play, it's a 2-0 set loss for them (each set 6-0).
• Conduct: Resolve on-court disputes in good faith. Standard padel etiquette applies.

The league organizer has the final say on group formations, disputes, and rule interpretations. If it's not covered here, we settle it in the spirit of fair play.`,
  },
  {
    key: 'finals',
    icon: '🏆',
    title: 'Finals Day',
    body: `We'll host both gold and silver finals on the same day at the same club so everyone can come out and support our finalists.

More details on venue and date as we get closer — keep an eye on the WhatsApp group!`,
  },
]

export const EXPERIENCE_LEVELS = [
  { id: 'beginner', label: 'Beginner', hint: 'KNLTB 9–8 · Building the fundamentals' },
  { id: 'intermediate', label: 'Intermediate', hint: 'KNLTB 7–6 · Sustaining rallies' },
  { id: 'advanced', label: 'Advanced', hint: 'KNLTB 5 or lower · Competing frequently' },
]

export const DIVISION_LABEL = {
  mens: "Men's Division",
  womens: "Women's Division",
  open: 'Open Division',
}
