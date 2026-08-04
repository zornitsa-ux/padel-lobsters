// Content for "The Lobster Way" — the app's FAQ / help page (formerly "Claw &
// Order"). Sourced from `Claw and Order - FAQ.docx`, grouped into scan-able
// categories for the chip nav on the page. Emoji are carried over from the
// original doc's section headers, kept on individual questions so the flavor
// survives even though several original sections got merged into one
// category here.
//
// Item shape: { q, a, list?, steps?, note? }
//   - list:  [{ emoji?, label?, text }]  — bullet points (perks, vote
//            categories, profile fields)
//   - steps: [{ title, text }]           — numbered walkthrough
//   - note:  string                      — short closing aside

const LOBSTER_WAY_CONTENT = [
  {
    slug: 'origin-story',
    label: 'Origin story',
    chipEmoji: '🦞',
    isStory: true,
    story:
      "We didn't plan this. Nobody drafted a mission statement or hired a consultant. One court became two, two became a tournament, and now here we are — a full-blown padel community that somehow keeps showing up. We're competitive enough to care and relaxed enough to laugh about it. Come as you are. Stay for the padel.",
  },
  {
    slug: 'getting-started',
    label: 'Getting started',
    chipEmoji: '🎾',
    items: [
      {
        q: "🎾 What's a standard Lobster tournament?",
        a: "2 hours of padel, broken into 6 rounds of 20 minutes. We usually run 24 to 32 players per event, depending on demand, so there's always a court calling your name.",
      },
      {
        q: '🤝 Who do I play with?',
        a: "Partners are predetermined, so there's no awkward \"who wants to team up?\" energy. Tournaments are usually mixed, because honestly, it's more fun. We don't always manage to recruit equal numbers of men and women, but no fear: our pairing still optimizes for balanced, challenging games either way.",
        note: 'Curious how the pairing actually works? See "How does the matchmaker decide who plays with whom?" under During the tournament.',
      },
      {
        q: '✍️ How do I sign up?',
        a: 'Only via the website. No carrier pigeons, no DMs, no "save me a spot" texts.',
      },
      {
        q: '💳 Is there a payment?',
        a: "Yes, and this one isn't up for negotiation: no payment, no spot. Registrations without payment will be cancelled.",
        note: "We're a small operation, run with a lot of love. We genuinely can't handle refunds, creative excuses, and \"I'll get you next time\" math, so please just pay your part on time and keep it fair for everyone. Easy.",
      },
      {
        q: '🔑 What do I do if I forgot my PIN?',
        a: 'No panic needed. Tap "Email me a sign-up link." If you really want your PIN back, email us at pin@padelobsters.nl.',
      },
    ],
  },
  {
    slug: 'rules-and-perks',
    label: 'Tournament rules and perks',
    chipEmoji: '📋',
    items: [
      {
        q: '📋 What are the rules? (read these, seriously)',
        a: "Be there 15 minutes early. Check in, warm up, find your people. Stay at least 30 minutes after — that's when the food, the raffle, and the good chat happen, so don't be the person who sneaks off. Bring your competitive spirit and be kind to the group: we play hard and we play nice. Both. Always.",
      },
      {
        q: "🎁 What's included?",
        a: 'Your spot gets you:',
        list: [
          { emoji: '⏱️', text: '2 hours on court' },
          { emoji: '🎾', text: "Balls — provided, so don't raid your garage" },
          { emoji: '🍽️', text: 'Food after the tournament — refuel after the carnage' },
          { emoji: '🏆', text: 'A prize for the tournament winner' },
          { emoji: '🎟️', text: 'Raffle prizes — because sometimes the lobster gods just like you' },
          { emoji: '🎮', text: "Lobster Games — you pick who's best" },
        ],
      },
      {
        q: '🎉 What are the prizes?',
        a: 'They vary, but mostly come from the Padel Lobsters merch line. Win glory, wear glory.',
      },
    ],
  },
  {
    slug: 'during-the-tournament',
    label: 'During the tournament',
    chipEmoji: '📅',
    items: [
      {
        q: '📅 How do I know which court to go to, and who I\'m playing?',
        a: "Once the tournament kicks off, open the app and you'll see your personal schedule: all 6 of your rounds, in order, each with a court number and your opponents for that round. No wandering around asking \"wait, am I on court 3?\"",
        note: "You only see your own rounds and courts, so there's no need to dig through the full draw — just glance at the app between matches and head to the right court. Report your score to the admin when you're done with your game.",
      },
      {
        q: '🏆 How are tournament points calculated?',
        a: 'Each of your 6 rounds is a fast, timed match, and the points your side scores during that round get added to your tally. Add up your points across all 6 rounds and that\'s your tournament total. Winning a round obviously helps, but a close loss can still bank you a decent haul of points, so the ranking rewards consistently good play, not just wins.',
        note: "If two players end up tied on total points, the tiebreaker kicks in: fewest losses wins the tie. Still tied after that? Most wins takes it.",
      },
      {
        q: '🤖 How does the matchmaker decide who plays with whom?',
        a: "Our AI matchmaker pairs and seeds everyone for balanced, challenging games, so you'll get rallies that actually make you sweat. It draws on whichever of two sources is more reliable for you: your Playtomic score (adjusted by you) or your Lobster score.",
        note: "Your Lobster score evolves with you: it adjusts your starting score based on how many wins and losses you rack up in Lobster tournaments. The more you play, the more accurate it gets. These aren't public, but trust the process — each round is worth it.",
      },
      {
        q: '🎮 What are the Lobster Games, and how do I vote?',
        a: "Every tournament, players get to vote on each other across a bunch of (very serious, totally official) categories. It's where bragging rights are born. A few of the categories you'll be voting on:",
        list: [
          { emoji: '🦞', text: 'Best Lobster — overall player of the day' },
          { emoji: '💥', text: 'Best Smash' },
          { emoji: '🛡️', text: 'Best Defense' },
          { emoji: '🎯', text: 'Best Serve' },
          { emoji: '🔥', text: 'Best Rally' },
          { emoji: '🌟', text: 'Best Newcomer' },
          { emoji: '🤝', text: 'Best Team Spirit' },
        ],
        note: "Vote right in the app, during and after the tournament. So pay attention out there — someone's watching that net cord miracle and deciding if it deserves a vote.",
      },
    ],
  },
  {
    slug: 'your-profile',
    label: 'Your profile',
    chipEmoji: '👤',
    items: [
      {
        q: '👤 What does my profile show, and what does it all mean?',
        a: 'Your profile lives under Community → Members. Here\'s what each part means:',
        list: [
          {
            label: 'Rank and rating',
            text: 'your position in the community list and your current skill rating — the number the matchmaker uses to build balanced games.',
          },
          {
            label: 'Lobster Review',
            text: "a fun, one-liner about your play style, based on your real tournament results once you've played enough.",
          },
          {
            label: 'Played, record, win %',
            text: 'your all-time match count, win-loss-draw record, and win percentage across every tournament.',
          },
          {
            label: 'Playtomic score',
            text: 'the rating you arrived with, plus any adjustment.',
          },
          {
            label: 'Last 5',
            text: 'win or loss for your five most recent matches, at a glance.',
          },
          {
            label: 'Match metrics',
            text: 'points for and against, your average points per match, your best win streak, and your longest losing streak.',
          },
          {
            label: 'Rivalries & chemistry',
            text: "your Nemesis (the opponent you struggle against most), your Best partner, and your Jinx partner (the partner you've had the roughest results with).",
          },
          {
            label: 'Head to head',
            text: "your personal record against specific opponents and pairs you've faced before.",
          },
          {
            label: 'Tournament history',
            text: "every tournament you've played, with your finishing rank, the date, your record, and the points you scored.",
          },
        ],
      },
    ],
  },
  {
    slug: 'cancellations-and-transfers',
    label: 'Cancellations and transfers',
    chipEmoji: '🔁',
    items: [
      {
        q: '🔁 Can I cancel?',
        a: "There are no cancellations. But you're not stuck:",
        list: [
          { emoji: '🔄', text: 'Transfer your spot to someone on the waiting list, or' },
          { emoji: '💬', text: 'Post in the group chat to find a replacement yourself.' },
        ],
        note: "Just don't ghost us.",
      },
      {
        q: '📲 How does transferring a spot actually work?',
        a: "Here's the full walkthrough, using Oscar (who can't make it anymore) and Kim (who wants in) as the example:",
        steps: [
          {
            title: 'Open your registration.',
            text: 'Oscar goes to his registered event and finds his registration card. It shows Confirmed and a Transfer spot to another player button.',
            image: '/lobster-way/transfer-step-1.png',
          },
          {
            title: 'Pick who takes over.',
            text: 'Tapping that button opens a picker. Waitlisted players are shown first (Kim, at Level 2.5, is on the waitlist), but Oscar can search for anyone else in the club too. He picks Kim.',
            image: '/lobster-way/transfer-step-2.png',
          },
          {
            title: 'Send it straight to their WhatsApp.',
            text: "This is the one-tap part: Oscar gets a Contact Kim on WhatsApp button that opens a WhatsApp chat with Kim directly, message already filled in — no copying or pasting. If Kim doesn't have a WhatsApp number on file, or as a backup, there's also Post in Lobsters WhatsApp group, which copies the message so Oscar can paste it there instead.",
            image: '/lobster-way/transfer-step-3.png',
          },
          {
            title: 'Your spot stays held.',
            text: 'Oscar stays registered while the offer is pending — no expiry, it only closes automatically once the event starts. His registration card shows a Transfer offer pending banner with buttons to Resend WhatsApp or Cancel offer any time before Kim responds.',
            image: '/lobster-way/transfer-step-4.png',
          },
          {
            title: 'Kim opens the link and responds.',
            text: "Tapping the WhatsApp message takes her straight to the offer in the app (behind her PIN if she isn't already signed in). She sees who it's from, the event details, and Decline / Accept transfer buttons. If she's already signed into the app, the same offer also shows up right on her own registration card, so she doesn't even need to tap the link.",
            image: '/lobster-way/transfer-step-5.png',
          },
          {
            title: 'Done, either way.',
            text: "If she accepts, she's registered and Oscar's registration is cancelled — he shares the payment link with her separately. If she declines (or Oscar cancels first), Oscar keeps his spot and can offer it to someone else.",
            image: '/lobster-way/transfer-step-6.png',
          },
        ],
        note: "Payment is always between the two players; the app doesn't process it.",
      },
      {
        q: '⏳ How do I get on the waiting list?',
        a: "Hit \"Join waiting list\" on the tournament. If a spot opens up, you'll get a WhatsApp from the person giving theirs up, so keep an eye out — and don't forget you're on the list!",
      },
      {
        q: '🚫 What about no-shows?',
        a: "We've never had one, and we'd very much like to keep that streak alive.",
        note: "So consider this fair warning: people who don't show up won't be able to join future tournaments. The Lobster remembers.",
      },
    ],
  },
  {
    slug: 'extras',
    label: 'Extras',
    chipEmoji: '📣',
    items: [
      {
        q: '📸 Do you take photos at tournaments?',
        a: "At some tournaments we take pictures for our social media campaigns. We're very respectful about it: we keep things flattering and avoid close-ups. If you'd rather not appear, no problem at all — just let the organisers know and we'll keep you out of frame.",
      },
      {
        q: '🛍️ Where do I buy Padel Lobsters merch?',
        a: 'Directly on the website. Wear the claw with pride.',
      },
      {
        q: '🛠️ The app is acting up. Where do I shout about it?',
        a: 'Join the "Lobster App Help / Feedback" thread in the WhatsApp group and post your question there.',
      },
      {
        q: '💡 I have feedback, a brilliant idea, or a complaint.',
        a: 'Reach us via the WhatsApp group or email. We actually read these.',
      },
      {
        q: '📣 How do I stay in the loop?',
        a: 'Join the Padel Lobsters WhatsApp group to stay on top of tournaments, scout for padel buddies, and (more often than you\'d expect) pick up gifs you never knew you needed.',
        note: 'Never want to miss a tournament? Subscribe to email reminders.',
      },
    ],
  },
]

export default LOBSTER_WAY_CONTENT

// The DB column (settings.lobster_way_content) is the live, admin-editable
// copy — seeded from this file. Falls back to the static content here if the
// column is empty (e.g. a fresh environment before the admin has saved
// anything), so the page and the editor never render blank.
export function resolveLobsterWayContent(settings) {
  return settings?.lobsterWayContent && settings.lobsterWayContent.length > 0
    ? settings.lobsterWayContent
    : LOBSTER_WAY_CONTENT
}
