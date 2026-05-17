import React from 'react'

// ── Range calendar ────────────────────────────────────────────────────────
// Compact custom calendar with range-select. Avoids native <input type="date">
// quirks (pickers closing on month navigation, wonky year entry on mobile).
// Click once for start, click again for end — both highlighted until committed.
// Month arrows navigate without closing. "Today" jumps back to today.
// Dates stored as ISO 'YYYY-MM-DD' strings.
export const toIso = (d) => {
  const yr = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${yr}-${mo}-${da}`
}
export const fromIso = (s) => {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}
export const fmtShort = (iso) => {
  const d = fromIso(iso)
  return d
    ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
    : '—'
}

// Fallback league intro — used when the admin hasn't filled in description_md.
// Rendered inside collapsible sections so the page is scannable after a first read.
export const DEFAULT_SECTIONS = [
  {
    id: 'welcome',
    icon: '🏆',
    title: 'Welcome to the League!',
    body: [
      "Join us this summer for the first edition of the Lobster League! Form your team and get ready for an exciting season of padel competition. You'll compete in a group stage where you'll play three matches against each team in your group, then advance to the playoff bracket where you could compete for the championship or silver title.",
      '',
      '**Why you should join:**',
      "• 🏆 Competitive but friendly — Everyone plays to win, but we're all here for the love of the game",
      '• 📅 Flexible scheduling — You organize your matches around your life, not the other way around',
      '• 🥇 Everyone gets their moment — With gold and silver brackets, every team has something to play for',
      "• 🎉 Community atmosphere — We'll bring everyone together for an exciting Finals Day where we can all cheer on the finalists",
    ].join('\n'),
  },
  {
    id: 'how',
    icon: '📋',
    title: 'How It Works',
    body: [
      '**Group Stage (5 weeks)**',
      '• Play in a small group of 4 teams',
      '• Face each opponent once (3 matches total)',
      '• Self-scheduled — you coordinate with your opponents to find times that work',
      '• Win matches to earn points and climb your group standings',
      '',
      '**Playoff Bracket (single elimination)**',
      '• Top 2 teams from each group → Gold Bracket (competing for the championship)',
      '• Bottom 2 teams from each group → Silver Bracket (competing for the silver title)',
      "• One loss and you're out — every match matters",
      '',
      '**Divisions**',
      "• The league will feature a Men's Division and a Women's Division, provided there are sufficient sign-ups for each.",
      '• If there are insufficient sign-ups to form separate divisions, they will be combined into a single open division.',
    ].join('\n'),
  },
  // This placeholder is only used when the admin hasn't set phase dates.
  // Once dates are saved on the league, the real dates render via
  // renderTimelineBody() below, replacing this generic text.
  {
    id: 'timeline',
    icon: '🗓️',
    title: 'Season Timeline',
    body: [
      "Once the admin locks in the season calendar, you'll see the exact date range for each phase here. Meanwhile, the shape is:",
      '• Sign-up → deadline set by the admin',
      '• Group Stage (5 weeks) — 3 matches per team at your own pace',
      '• Quarterfinals (2 weeks) — only if the league hits 12+ teams per division',
      '• Semifinals (2 weeks)',
      '• Finals (1 day) — gold and silver played back-to-back',
    ].join('\n'),
  },
  {
    id: 'rules',
    icon: '⚔️',
    title: 'Match Rules',
    body: [
      '**Match Format**',
      'All matches are best of 2 sets. If each team wins one set, a match tiebreak to 10 points (win by 2) decides the match.',
      'Finals exception: Both the gold and silver finals are played as a full best of 3 sets (no match tiebreak).',
      '',
      '**The "Star Point" (Deuce Rule)** — same as Premier Padel:',
      '1. First Deuce: advantage / disadvantage as usual.',
      '2. Second Deuce: advantage / disadvantage again.',
      '3. Third Deuce: Golden Point. The receiving team picks the side — winner of the point wins the game.',
    ].join('\n'),
  },
  {
    id: 'scoring',
    icon: '📈',
    title: 'Scoring & Standings',
    body: [
      '**Group Stage points:** Win = 1, Loss = 0.',
      '',
      'Tiebreakers, in order:',
      '1. Head-to-head result between the tied teams',
      '2. Set Difference — sets won minus sets lost',
      '3. Game Difference — games won minus games lost',
      '4. Coin toss',
      '',
      '**Playoff seeding:** 1st-place teams face 2nd-place teams; teams from the same group stay apart until the finals where possible.',
      '',
      '**Reporting results:** post the score in the WhatsApp group within 24 hours of the match. Scores become final after 48 hours.',
      '',
      '**Forfeits:** a no-show is recorded as a 2-0 set loss (6-0, 6-0). Cancellations should be communicated ASAP to reschedule.',
    ].join('\n'),
  },
  {
    id: 'finals',
    icon: '🏅',
    title: 'Finals Day',
    body: [
      "We'd like to host both the gold and silver finals on the same day at the same club so everyone can come out to support the finalists. Venue and date will be shared as we get closer.",
      '',
      "**The organizer has the final say** on group formations, disputes, and rule interpretations. If a situation isn't covered here, we'll settle it in the spirit of fair play.",
    ].join('\n'),
  },
]

export const EXPERIENCE_LEVELS = [
  { id: 'beginner', label: 'Beginner', hint: 'Building the fundamentals · KNLTB 9–8' },
  {
    id: 'intermediate',
    label: 'Intermediate',
    hint: 'Playing regularly, sustaining rallies · KNLTB 7–6',
  },
  { id: 'advanced', label: 'Advanced', hint: 'Competing frequently · KNLTB 5 or lower' },
]

// Very small markdown-ish line renderer so the admin can use **bold** and
// bullets without pulling in a full markdown library.
export function inlineBold(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? (
      <strong key={i}>{p.slice(2, -2)}</strong>
    ) : (
      <React.Fragment key={i}>{p}</React.Fragment>
    ),
  )
}
export function renderBody(body) {
  return body.split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-2" />
    return (
      <p key={i} className="text-sm text-gray-700 leading-relaxed">
        {inlineBold(line)}
      </p>
    )
  })
}

// Pretty-print a phase date range ("25 May → 28 Jun"). Both missing → null.
export function fmtRange(start, end) {
  const fmt = (d) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null
  const s = fmt(start),
    e = fmt(end)
  if (!s && !e) return null
  if (s && !e) return s
  if (!s && e) return `until ${e}`
  return `${s} → ${e}`
}

// Render the Timeline section dynamically from the league's phase fields.
// Falls back to the generic DEFAULT_SECTIONS timeline when nothing's set.
export function renderTimeline(league) {
  const rows = [
    [
      '📝 Sign-up',
      league.signup_closes_at
        ? `until ${new Date(league.signup_closes_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
        : null,
    ],
    ['🏓 Group Stage', fmtRange(league.group_stage_start, league.group_stage_end)],
    ['🎯 Quarterfinals', fmtRange(league.quarters_start, league.quarters_end)],
    ['⚡ Semifinals', fmtRange(league.semis_start, league.semis_end)],
    ['🏆 Finals', fmtRange(league.finals_start, league.finals_end)],
  ].filter(([, range]) => !!range)
  if (rows.length === 0) return null
  return (
    <div className="space-y-1">
      {rows.map(([label, range]) => (
        <div key={label} className="flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold text-gray-700">{label}</span>
          <span className="text-gray-500">{range}</span>
        </div>
      ))}
      <p className="text-[11px] text-gray-400 pt-2">
        About 1 match every 1–2 weeks in the group stage, tighter during playoffs. Quarterfinals
        only run if the league hits 12+ teams per division.
      </p>
    </div>
  )
}

// Countdown shows "N days left" or "Signups closed …" based on the deadline.
// Inherits text color from its parent so the same component looks right on
// the orange hero pill (white) and on lighter admin surfaces (teal/red).
export function Countdown({ deadline }) {
  if (!deadline) return null
  const ms = new Date(deadline).getTime() - Date.now()
  if (Number.isNaN(ms)) return null
  const past = ms <= 0
  const days = Math.floor(Math.abs(ms) / 86400000)
  const hours = Math.floor((Math.abs(ms) % 86400000) / 3600000)
  return (
    <span className="text-xs font-semibold">
      {past
        ? `Sign-up closed ${days}d ago`
        : days > 1
          ? `${days} days left`
          : days === 1
            ? `1 day + ${hours}h left`
            : `${hours}h left`}
    </span>
  )
}
