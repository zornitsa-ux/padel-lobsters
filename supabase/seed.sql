-- =============================================================================
--  PADEL LOBSTERS — Local Development Seed Data
--
--  Generated from production on 2025-05-03.
--  This file is run automatically by `supabase db reset` after all migrations.
--  It populates the local database with realistic data so you can develop and
--  test without touching production.
--
--  PINs: A handful of players get PIN '1234' for login testing.
--  Emails: All replaced with @lobsters.test addresses.
--
--  NOTE: This is NOT run against production. It is local-only.
-- =============================================================================

-- ── Settings ─────────────────────────────────────────────────────────────────

INSERT INTO settings (id, whatsapp_link, group_name, padel_tips, auto_trust_until, lobster_way_content)
VALUES (
  1,
  'https://chat.whatsapp.com/test-local-dev',
  'Padel Lobsters (Local)',
  '["Always return to the center of your side after every shot — positioning wins more points than power.","Use the back glass to your advantage: let the ball bounce off it and play it on the way down.","The bandeja is your bread and butter overhead — learn it before the smash.","Communication with your partner is everything. Call \u0027mine\u0027 or \u0027yours\u0027 on every ball.","Keep your racket up and ready between shots — a low racket kills your reaction time.","The lob is the most underrated shot in padel. Use it to reset when under pressure.","Continental grip for volleys and overheads, slightly eastern for drives — don\u0027t overthink it.","Move forward together with your partner. If one goes to the net, both should be at the net.","Don\u0027t smash everything — a well-placed bandeja or víbora is harder to return than a wild smash.","Watch the ball hit your racket. Sounds obvious, but most errors come from looking away too early.","The side glass can be your best friend — practice hitting chiquitas that die off the glass.","Stay low on volleys. Bend your knees, not your back.","Change the pace often. Mixing slow lobs with fast drives keeps opponents guessing.","After serving, move forward to the net immediately — padel is won at the net.","The bajada (off the back glass overhead) is an advanced weapon. Start practicing it early.","Never stand still. Small adjustment steps between shots keep you balanced and ready.","Hit the ball in front of your body, especially on volleys — contact point is key.","The \u0027X\u0027 formation (one up, one back diagonal) can be effective against certain teams.","Practice your serve consistency over power. A deep, consistent serve beats a fast, wild one.","When defending, aim your lobs deep and high — give yourself time to recover position.","The chiquita (soft dipping shot) is essential: aim at your opponents\u0027 feet at the net.","Don\u0027t run backwards for lobs — turn sideways and move to the ball athletically.","Use the double glass (side + back) to create angles your opponents don\u0027t expect.","Patience wins padel matches. Wait for the right ball to attack — don\u0027t force winners.","Your split step should happen just as your opponent hits the ball — it activates your movement.","The volley is a block, not a swing. Firm wrist, short movement, let the ball do the work.","Practice your \u0027por tres\u0027 (3-wall shot) — it\u0027s a spectacular way to win points.","Warm up your wrist and shoulder before every match — padel injuries are often preventable.","Against lobbers, be patient at the net. They want you to retreat — hold your ground.","The drive volley (swing volley) is great for putting away high balls — practice it.","Always know where all four players are on the court. Awareness beats speed.","When your partner is serving, stand close to the net and be aggressive on the return.","Hit the ball to the middle between opponents — confusion causes more errors than angles.","Take the ball early when possible — don\u0027t let it drop too low or you lose attacking options.","Your footwork before the shot matters more than your racket technique during it.","The Golden Point rule: on deuce, the receiving team chooses the side. Use it strategically.","Learn to read your opponent\u0027s racket face — it tells you where the ball is going before they hit it.","A good return of serve is low and to the feet of the server coming to the net.","In defense, use high lobs to the corners to pull your opponents apart.","The víbora is a side-spin overhead that stays low — it\u0027s the pro\u0027s favorite for a reason.","Don\u0027t hug the glass. Stay about 1 meter away so you have room to swing.","Switch sides with your partner fluidly — whoever is closer to the ball takes it.","When you make an error, reset mentally. The next point is a fresh start.","Play the score. At 40-0, take risks. At 30-40, play safe and consistent.","Practice your \u0027globo\u0027 (defensive lob) until you can place it deep every time.","Your non-racket hand helps with balance — keep it active, don\u0027t let it hang.","Watch pro padel on WPT or Premier Padel — you\u0027ll absorb positioning patterns naturally.","After a smash, recover quickly to the net — don\u0027t admire your shot.","Enjoy the game. The best padel comes when you\u0027re relaxed and having fun with your partner."]'::jsonb,
  now() + interval '21 days',
  '[{"slug":"origin-story","label":"Origin story","chipEmoji":"🦞","isStory":true,"story":"We didn''t plan this. Nobody drafted a mission statement or hired a consultant. One court became two, two became a tournament, and now here we are — a full-blown padel community that somehow keeps showing up. We''re competitive enough to care and relaxed enough to laugh about it. Come as you are. Stay for the padel."},{"slug":"getting-started","label":"Getting started","chipEmoji":"🎾","items":[{"q":"🎾 What''s a standard Lobster tournament?","a":"2 hours of padel, broken into 6 rounds of 20 minutes. We usually run 24 to 32 players per event, depending on demand, so there''s always a court calling your name."},{"q":"🤝 Who do I play with?","a":"Partners are predetermined, so there''s no awkward \"who wants to team up?\" energy. Tournaments are usually mixed, because honestly, it''s more fun. We don''t always manage to recruit equal numbers of men and women, but no fear: our pairing still optimizes for balanced, challenging games either way.","note":"Curious how the pairing actually works? See \"How does the matchmaker decide who plays with whom?\" under During the tournament."},{"q":"✍️ How do I sign up?","a":"Only via the website. No carrier pigeons, no DMs, no \"save me a spot\" texts."},{"q":"💳 Is there a payment?","a":"Yes, and this one isn''t up for negotiation: no payment, no spot. Registrations without payment will be cancelled.","note":"We''re a small operation, run with a lot of love. We genuinely can''t handle refunds, creative excuses, and \"I''ll get you next time\" math, so please just pay your part on time and keep it fair for everyone. Easy."},{"q":"🔑 What do I do if I forgot my PIN?","a":"No panic needed. Tap \"Email me a sign-up link.\" If you really want your PIN back, email us at pin@padelobsters.nl."}]},{"slug":"rules-and-perks","label":"Tournament rules and perks","chipEmoji":"📋","items":[{"q":"📋 What are the rules? (read these, seriously)","a":"Be there 15 minutes early. Check in, warm up, find your people. Stay at least 30 minutes after — that''s when the food, the raffle, and the good chat happen, so don''t be the person who sneaks off. Bring your competitive spirit and be kind to the group: we play hard and we play nice. Both. Always."},{"q":"🎁 What''s included?","a":"Your spot gets you:","list":[{"emoji":"⏱️","text":"2 hours on court"},{"emoji":"🎾","text":"Balls — provided, so don''t raid your garage"},{"emoji":"🍽️","text":"Food after the tournament — refuel after the carnage"},{"emoji":"🏆","text":"A prize for the tournament winner"},{"emoji":"🎟️","text":"Raffle prizes — because sometimes the lobster gods just like you"},{"emoji":"🎮","text":"Lobster Games — you pick who''s best"}]},{"q":"🎉 What are the prizes?","a":"They vary, but mostly come from the Padel Lobsters merch line. Win glory, wear glory."}]},{"slug":"during-the-tournament","label":"During the tournament","chipEmoji":"📅","items":[{"q":"📅 How do I know which court to go to, and who I''m playing?","a":"Once the tournament kicks off, open the app and you''ll see your personal schedule: all 6 of your rounds, in order, each with a court number and your opponents for that round. No wandering around asking \"wait, am I on court 3?\"","note":"You only see your own rounds and courts, so there''s no need to dig through the full draw — just glance at the app between matches and head to the right court. Report your score to the admin when you''re done with your game."},{"q":"🏆 How are tournament points calculated?","a":"Each of your 6 rounds is a fast, timed match, and the points your side scores during that round get added to your tally. Add up your points across all 6 rounds and that''s your tournament total. Winning a round obviously helps, but a close loss can still bank you a decent haul of points, so the ranking rewards consistently good play, not just wins.","note":"If two players end up tied on total points, the tiebreaker kicks in: fewest losses wins the tie. Still tied after that? Most wins takes it."},{"q":"🤖 How does the matchmaker decide who plays with whom?","a":"Our AI matchmaker pairs and seeds everyone for balanced, challenging games, so you''ll get rallies that actually make you sweat. It draws on whichever of two sources is more reliable for you: your Playtomic score (adjusted by you) or your Lobster score.","note":"Your Lobster score evolves with you: it adjusts your starting score based on how many wins and losses you rack up in Lobster tournaments. The more you play, the more accurate it gets. These aren''t public, but trust the process — each round is worth it."},{"q":"🎮 What are the Lobster Games, and how do I vote?","a":"Every tournament, players get to vote on each other across a bunch of (very serious, totally official) categories. It''s where bragging rights are born. A few of the categories you''ll be voting on:","list":[{"emoji":"🦞","text":"Best Lobster — overall player of the day"},{"emoji":"💥","text":"Best Smash"},{"emoji":"🛡️","text":"Best Defense"},{"emoji":"🎯","text":"Best Serve"},{"emoji":"🔥","text":"Best Rally"},{"emoji":"🌟","text":"Best Newcomer"},{"emoji":"🤝","text":"Best Team Spirit"}],"note":"Vote right in the app, during and after the tournament. So pay attention out there — someone''s watching that net cord miracle and deciding if it deserves a vote."}]},{"slug":"your-profile","label":"Your profile","chipEmoji":"👤","items":[{"q":"👤 What does my profile show, and what does it all mean?","a":"Your profile lives under Community → Members. Here''s what each part means:","list":[{"label":"Rank and rating","text":"your position in the community list and your current skill rating — the number the matchmaker uses to build balanced games."},{"label":"Lobster Review","text":"a fun, one-liner about your play style, based on your real tournament results once you''ve played enough."},{"label":"Played, record, win %","text":"your all-time match count, win-loss-draw record, and win percentage across every tournament."},{"label":"Playtomic score","text":"the rating you arrived with, plus any adjustment."},{"label":"Last 5","text":"win or loss for your five most recent matches, at a glance."},{"label":"Match metrics","text":"points for and against, your average points per match, your best win streak, and your longest losing streak."},{"label":"Rivalries & chemistry","text":"your Nemesis (the opponent you struggle against most), your Best partner, and your Jinx partner (the partner you''ve had the roughest results with)."},{"label":"Head to head","text":"your personal record against specific opponents and pairs you''ve faced before."},{"label":"Tournament history","text":"every tournament you''ve played, with your finishing rank, the date, your record, and the points you scored."}]}]},{"slug":"cancellations-and-transfers","label":"Cancellations and transfers","chipEmoji":"🔁","items":[{"q":"🔁 Can I cancel?","a":"There are no cancellations. But you''re not stuck:","list":[{"emoji":"🔄","text":"Transfer your spot to someone on the waiting list, or"},{"emoji":"💬","text":"Post in the group chat to find a replacement yourself."}],"note":"Just don''t ghost us."},{"q":"📲 How does transferring a spot actually work?","a":"Here''s the full walkthrough, using Oscar (who can''t make it anymore) and Kim (who wants in) as the example:","steps":[{"title":"Open your registration.","text":"Oscar goes to his registered event and finds his registration card. It shows Confirmed and a Transfer spot to another player button.","image":"/lobster-way/transfer-step-1.png"},{"title":"Pick who takes over.","text":"Tapping that button opens a picker. Waitlisted players are shown first (Kim, at Level 2.5, is on the waitlist), but Oscar can search for anyone else in the club too. He picks Kim.","image":"/lobster-way/transfer-step-2.png"},{"title":"Send it straight to their WhatsApp.","text":"This is the one-tap part: Oscar gets a Contact Kim on WhatsApp button that opens a WhatsApp chat with Kim directly, message already filled in — no copying or pasting. If Kim doesn''t have a WhatsApp number on file, or as a backup, there''s also Post in Lobsters WhatsApp group, which copies the message so Oscar can paste it there instead.","image":"/lobster-way/transfer-step-3.png"},{"title":"Your spot stays held.","text":"Oscar stays registered while the offer is pending — no expiry, it only closes automatically once the event starts. His registration card shows a Transfer offer pending banner with buttons to Resend WhatsApp or Cancel offer any time before Kim responds.","image":"/lobster-way/transfer-step-4.png"},{"title":"Kim opens the link and responds.","text":"Tapping the WhatsApp message takes her straight to the offer in the app (behind her PIN if she isn''t already signed in). She sees who it''s from, the event details, and Decline / Accept transfer buttons. If she''s already signed into the app, the same offer also shows up right on her own registration card, so she doesn''t even need to tap the link.","image":"/lobster-way/transfer-step-5.png"},{"title":"Done, either way.","text":"If she accepts, she''s registered and Oscar''s registration is cancelled — he shares the payment link with her separately. If she declines (or Oscar cancels first), Oscar keeps his spot and can offer it to someone else.","image":"/lobster-way/transfer-step-6.png"}],"note":"Payment is always between the two players; the app doesn''t process it."},{"q":"⏳ How do I get on the waiting list?","a":"Hit \"Join waiting list\" on the tournament. If a spot opens up, you''ll get a WhatsApp from the person giving theirs up, so keep an eye out — and don''t forget you''re on the list!"},{"q":"🚫 What about no-shows?","a":"We''ve never had one, and we''d very much like to keep that streak alive.","note":"So consider this fair warning: people who don''t show up won''t be able to join future tournaments. The Lobster remembers."}]},{"slug":"extras","label":"Extras","chipEmoji":"📣","items":[{"q":"📸 Do you take photos at tournaments?","a":"At some tournaments we take pictures for our social media campaigns. We''re very respectful about it: we keep things flattering and avoid close-ups. If you''d rather not appear, no problem at all — just let the organisers know and we''ll keep you out of frame."},{"q":"🛍️ Where do I buy Padel Lobsters merch?","a":"Directly on the website. Wear the claw with pride."},{"q":"🛠️ The app is acting up. Where do I shout about it?","a":"Join the \"Lobster App Help / Feedback\" thread in the WhatsApp group and post your question there."},{"q":"💡 I have feedback, a brilliant idea, or a complaint.","a":"Reach us via the WhatsApp group or email. We actually read these."},{"q":"📣 How do I stay in the loop?","a":"Join the Padel Lobsters WhatsApp group to stay on top of tournaments, scout for padel buddies, and (more often than you''d expect) pick up gifs you never knew you needed.","note":"Never want to miss a tournament? Subscribe to email reminders."}]}]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  whatsapp_link        = EXCLUDED.whatsapp_link,
  group_name           = EXCLUDED.group_name,
  padel_tips           = EXCLUDED.padel_tips,
  auto_trust_until     = EXCLUDED.auto_trust_until,
  lobster_way_content  = EXCLUDED.lobster_way_content;

-- ── Players ──────────────────────────────────────────────────────────────────
-- Full roster from production with sanitised emails.
-- Players marked with pin = '1234' can be used to test the login flow.
-- The sync_player_pin_hash trigger will bcrypt-hash the PIN on insert.

INSERT INTO players (name, gender, playtomic_level, adjustment, adjusted_level, status, is_left_handed, country, preferred_position, email, pin)
VALUES
  ('Adriana Dinu',          'female', 1.5, 0,    1.5, 'active', false, 'RO', 'right', 'adriana@lobsters.test',    ''),
  ('Aimée van der Pijl',    'female', 2.8, 0,    2.8, 'active', false, 'NL', 'left',  'aimee@lobsters.test',      ''),
  ('ALEJANDRO González',    'male',   2.2, 0,    2.2, 'active', true,  'ES', 'right', 'alejandro.g@lobsters.test',''),
  ('Alejandro Muñoz',       'male',   2.5, 0,    2.5, 'active', false, 'ES', 'left',  'alejandro.m@lobsters.test',''),
  ('Alex B',                'male',   3.0, 0,    3.0, 'active', false, 'RO', 'left',  'alex.b@lobsters.test',     ''),
  ('Alex Gomez',            'male',   3.0, 0,    3.0, 'active', true,  'ES', 'right', 'alex.gomez@lobsters.test', ''),
  ('Andres Mendoza',        'male',   1.2, 0.3,  1.5, 'active', true,  'MX', 'right', 'andres@lobsters.test',     ''),
  ('Anthony Kay',           'male',   2.0, 0.3,  2.3, 'active', false, 'GB', 'right', 'anthony@lobsters.test',    ''),
  ('Arda Yucel',            'male',   2.5, 0,    2.5, 'active', false, 'TR', 'left',  'arda@lobsters.test',       ''),
  ('Ashwanth',              'male',   2.0, 0,    2.0, 'active', false, 'NL', 'left',  'ashwanth@lobsters.test',   ''),
  ('Baturay Ucer',          'male',   2.0, 0.5,  2.5, 'active', false, 'NL', 'right', 'baturay@lobsters.test',    ''),
  ('Bianca Hoogkamer',      'female', 2.5, -0.5, 2.0, 'active', false, 'NL', 'left',  'bianca@lobsters.test',     ''),
  ('Can Bezmen',            'male',   2.0, 0,    2.0, 'active', false, 'TR', 'right', 'can@lobsters.test',        ''),
  ('Carolien van den Berg', 'female', 2.0, 0,    2.0, 'active', true,  'NL', 'right', 'carolien@lobsters.test',   ''),
  ('Chloe Precey',          'female', 1.7, 0,    1.7, 'active', true,  'GB', '',      'chloe@lobsters.test',      ''),
  ('Chris Desjardins ',     'male',   1.4, 0,    1.4, 'active', false, 'NL', 'both',  'chris@lobsters.test',      ''),
  ('Daniel Net Hitter',     'male',   2.8, 0,    2.8, 'active', false, 'NL', 'left',  'daniel@lobsters.test',     ''),
  ('Davide Di Domenico',    'male',   2.7, 0,    2.7, 'active', false, 'IT', '',      'davide@lobsters.test',     ''),
  ('Dominika Rychlewicz',   'female', 2.0, 0,    2.0, 'active', false, 'NL', 'left',  'dominika@lobsters.test',   ''),
  ('Elena Jiménez ',        'female', 3.0, 0,    3.0, 'active', false, 'ES', 'right', 'elena@lobsters.test',      ''),
  ('Elisabeth Vaudevire ',  'female', 2.0, 0,    2.0, 'active', false, 'FR', 'left',  'elisabeth@lobsters.test',  ''),
  ('Emiliano Cenizo',       'male',   0.8, 0,    0.8, 'active', false, 'AR', 'right', 'emiliano@lobsters.test',   ''),
  ('Eric ten Kate',         'male',   2.0, 0,    2.0, 'active', false, 'NL', 'both',  'eric@lobsters.test',       ''),
  ('Erica van Asten',       'female', 1.3, 0.3,  1.6, 'active', false, 'NL', 'left',  'erica@lobsters.test',      ''),
  ('Francesco Di Vincenzo', 'male',   2.2, 0,    2.2, 'active', false, 'IT', 'right', 'francesco@lobsters.test',  ''),
  ('Gabriela Malovrh',      'female', 1.0, 0,    1.0, 'active', false, 'AR', 'both',  'gabriela@lobsters.test',   ''),
  ('Gagan Shetty',          'male',   1.3, 0.2,  1.5, 'active', false, 'IN', '',      'gagan@lobsters.test',      ''),
  ('Gino',                  'male',   3.0, 0,    3.0, 'active', false, 'IT', 'both',  'gino@lobsters.test',       ''),
  ('Greg',                  'male',   1.3, 0.7,  2.0, 'active', false, 'FR', 'both',  'greg@lobsters.test',       ''),
  ('Gregorio .',             'male',   2.2, 0,    2.2, 'active', false, 'IT', 'both',  'gregorio@lobsters.test',   ''),
  ('Ilaria .',               'female', 2.0, 0,    2.0, 'active', false, 'NL', '',      'ilaria@lobsters.test',     ''),
  ('Ingrid Oudejans',       'female', 2.7, 0,    2.7, 'active', false, 'NL', '',      'ingrid@lobsters.test',     ''),
  ('Ini',                   'female', 1.9, 0.4,  2.3, 'active', false, 'ES', 'left',  'ini@lobsters.test',        ''),
  ('Jens N',                'male',   2.0, 0,    2.0, 'active', false, 'NL', 'right', 'jens@lobsters.test',       ''),
  ('Jessica Spotowski',     'female', 2.4, -1.0, 1.4, 'active', false, 'NL', 'both',  'jessica@lobsters.test',    ''),
  -- Jon (admin) gets a unique test PIN. Keep this distinct from any other
  -- seeded PIN so admin login is unambiguous when verify_player_pin_v2
  -- matches by bcrypt and there are multiple seeded test PINs.
  ('Jon Grim',              'male',   2.6, 0.4,  3.0, 'active', false, 'US', 'both',  'jon@lobsters.test',        '9999'),
  ('Josephine Tolley',      'female', 1.0, 1.0,  2.0, 'active', false, 'NL', 'right', 'josephine@lobsters.test',  ''),
  ('Juan Blas Diaz',        'male',   2.6, 0,    2.6, 'active', false, 'AR', 'both',  'juan.blas@lobsters.test',  ''),
  ('Juan Dominguez',        'male',   2.0, 0.5,  2.5, 'active', false, 'AR', 'both',  'juan.d@lobsters.test',     ''),
  ('Julian Keerl',          'male',   2.5, 0,    2.5, 'active', false, 'NL', 'both',  'julian@lobsters.test',     ''),
  ('Kemal',                 'male',   1.6, 0.7,  2.3, 'active', false, 'TR', 'both',  'kemal@lobsters.test',      ''),
  ('Lara Leser',            'female', 2.0, 0,    2.0, 'active', false, 'NL', 'right', 'lara@lobsters.test',       ''),
  ('Laura Schelhaas',       'female', 1.9, 0,    1.9, 'active', false, 'NL', 'left',  'laura@lobsters.test',      ''),
  ('Lucia Juelke',          'female', 2.5, 0,    2.5, 'active', true,  'DE', 'right', 'lucia@lobsters.test',      ''),
  ('Marielle Braak',        'female', 1.5, 0,    1.5, 'active', false, 'NL', 'right', 'marielle@lobsters.test',   ''),
  ('Markus',                'male',   1.9, 0,    1.9, 'active', false, 'DE', 'right', 'markus@lobsters.test',     ''),
  ('Mauricio Wiersma',      'male',   3.5, 0,    3.5, 'active', false, 'AR', 'left',  'mauricio@lobsters.test',   ''),
  ('Melanie Burger',        'female', 1.0, 0.5,  1.5, 'active', false, 'NL', 'both',  'melanie@lobsters.test',    ''),
  ('Mert Gulleroglu',       'male',   1.7, 0,    1.7, 'active', false, 'NL', 'right', 'mert@lobsters.test',       ''),
  ('Milan Kölling',         'male',   3.0, 0,    3.0, 'active', false, 'DE', 'left',  'milan@lobsters.test',      ''),
  ('Nico Tzinieris',        'male',   1.9, 0.1,  2.0, 'active', false, 'DE', 'left',  'nico@lobsters.test',       ''),
  ('Nik van der Poel',      'male',   2.7, 0,    2.7, 'active', false, 'NL', 'left',  'nik@lobsters.test',        ''),
  ('Omar younis',           'male',   2.0, 0,    2.0, 'active', true,  'NL', 'right', 'omar@lobsters.test',       ''),
  ('Orhan Ozkan',           'male',   2.0, 0,    2.0, 'active', false, 'NL', 'both',  'orhan@lobsters.test',      ''),
  ('Paola Hasbún Lopez',    'female', 1.0, 0.8,  1.8, 'active', false, 'CL', 'left',  'paola@lobsters.test',      ''),
  ('Sebas solis',           'male',   2.7, 0.3,  3.0, 'active', false, 'CR', 'left',  'sebas@lobsters.test',      ''),
  ('Sebastian Fennell',     'male',   3.0, 0,    3.0, 'active', false, 'AR', 'left',  'sebastian@lobsters.test',  ''),
  ('Timothy Tjen',          'male',   3.0, -0.2, 2.8, 'active', false, 'NL', 'left',  'timothy@lobsters.test',    ''),
  ('Trunal',                'male',   2.5, 0,    2.5, 'active', false, 'NL', 'both',  'trunal@lobsters.test',     ''),
  ('Uziel Brito',           'male',   3.3, -0.3, 3.0, 'active', false, 'CL', 'right', 'uziel@lobsters.test',      ''),
  ('Valesca',               'female', 2.4, 0,    2.4, 'active', false, 'NL', 'left',  'valesca@lobsters.test',    ''),
  ('Zeyon Henry',           'male',   2.5, 0,    2.5, 'active', false, 'NL', 'both',  'zeyon@lobsters.test',      ''),
  -- Zornitsa gets a test PIN for admin/login testing
  ('Zornitsa Mihaylova',    'female', 1.6, 0.4,  2.0, 'active', false, 'BG', 'both',  'zornitsa@lobsters.test',   '1234')
ON CONFLICT DO NOTHING;

-- Grant admin role to Jon so PIN 9999 works as admin without a manual DB edit.
UPDATE players SET role = 'admin' WHERE name = 'Jon Grim';

-- ── Tournaments ──────────────────────────────────────────────────────────────

INSERT INTO tournaments (name, date, time, location, max_players, format, status, duration, gender_mode, notes)
VALUES
  ('Upcoming Test Tournament',  CURRENT_DATE + INTERVAL '7 days',  '18:00', 'Test Courts Amsterdam', 16, 'americano', 'upcoming', 90, 'mixed', 'Auto-generated for local development'),
  ('Past Test Tournament',      CURRENT_DATE - INTERVAL '14 days', '17:30', 'Test Courts Amsterdam', 16, 'americano', 'completed', 90, 'mixed', 'Auto-generated for local development')
ON CONFLICT DO NOTHING;

-- ── Raffle winners (historical) ──────────────────────────────────────────────
-- All historical entries use tournament_id = NULL because the seed tournaments
-- above are local test stubs, not the real LOBS #3/5/6 events.
-- Idempotent: skips any row where (player_id, won_at_date) already exists.
INSERT INTO public.raffle_winners (player_id, tournament_id, won_at_date, tournament_label, cooldown_offset, prize)
SELECT p.id, NULL, v.won_at_date, v.tournament_label, v.cooldown_offset, v.prize
FROM (VALUES
  ('ALEJANDRO González', '2026-03-22'::date, 'LOBStournament #3', 1, 'tshirt'),
  ('Alejandro Muñoz',    '2026-03-22'::date, 'LOBStournament #3', 1, 'grips'),
  ('Gagan Shetty',       '2026-03-22'::date, 'LOBStournament #3', 1, 'sticker'),
  ('Baturay Ucer',       '2026-03-22'::date, 'LOBStournament #3', 1, 'canvas bag'),
  ('Paola Hasbún Lopez', '2026-04-19'::date, 'LOBStournament #5', 0, NULL),
  ('Ini',                '2026-04-19'::date, 'LOBStournament #5', 0, NULL),
  ('Nico Tzinieris',     '2026-04-19'::date, 'LOBStournament #5', 0, NULL),
  ('Sebas solis',        '2026-05-03'::date, 'LOBStournament #6', 0, 'tshirt'),
  ('Nico Tzinieris',     '2026-05-03'::date, 'LOBStournament #6', 0, 'hat'),
  ('Trunal',             '2026-05-03'::date, 'LOBStournament #6', 0, 'canvas bag'),
  ('Juan Blas Diaz',     '2026-05-03'::date, 'LOBStournament #6', 0, 'sticker'),
  ('Mauricio Wiersma',   '2026-05-03'::date, 'LOBStournament #6', 0, 'sticker')
) AS v(player_name, won_at_date, tournament_label, cooldown_offset, prize)
JOIN public.players p ON p.name = v.player_name
WHERE NOT EXISTS (
  SELECT 1 FROM public.raffle_winners w
   WHERE w.player_id = p.id AND w.won_at_date = v.won_at_date
);
