-- =============================================================================
--  PADEL LOBSTERS — Local development seed
--
--  Run by `supabase db reset` after the migrations. Synthetic data only: every
--  player is made up, so nothing here names a real player. For production-like
--  data, use scripts/prod-rehearsal/sync.sh instead.
--
--  One of each feature, so every page has something to show. Dates are relative
--  to the day of the reset. IDs are fixed so e2e specs (e2e/fixtures/seed.ts)
--  can find them. Specs that write create their own data; they read this world
--  and leave it as it was.
--
--  Sign-in (any @lobsters.test address also takes an email code via Mailpit):
--    admin@lobsters.test   Lobster-Admin-9999   PIN 9999   admin
--    player@lobsters.test  Lobster-Player-1234  PIN 1234   player
--
--  Local only. Never run against production.
-- =============================================================================

-- ── Settings ─────────────────────────────────────────────────────────────────

INSERT INTO settings (id, whatsapp_link, group_name, padel_tips, lobster_way_content)
VALUES (
  1,
  'https://chat.whatsapp.com/test-local-dev',
  'Padel Lobsters (Local)',
  '["Always return to the center of your side after every shot — positioning wins more points than power.","Use the back glass to your advantage: let the ball bounce off it and play it on the way down.","The bandeja is your bread and butter overhead — learn it before the smash.","Communication with your partner is everything. Call \u0027mine\u0027 or \u0027yours\u0027 on every ball.","Keep your racket up and ready between shots — a low racket kills your reaction time.","The lob is the most underrated shot in padel. Use it to reset when under pressure.","Continental grip for volleys and overheads, slightly eastern for drives — don\u0027t overthink it.","Move forward together with your partner. If one goes to the net, both should be at the net.","Don\u0027t smash everything — a well-placed bandeja or víbora is harder to return than a wild smash.","Watch the ball hit your racket. Sounds obvious, but most errors come from looking away too early.","The side glass can be your best friend — practice hitting chiquitas that die off the glass.","Stay low on volleys. Bend your knees, not your back.","Change the pace often. Mixing slow lobs with fast drives keeps opponents guessing.","After serving, move forward to the net immediately — padel is won at the net.","The bajada (off the back glass overhead) is an advanced weapon. Start practicing it early.","Never stand still. Small adjustment steps between shots keep you balanced and ready.","Hit the ball in front of your body, especially on volleys — contact point is key.","The \u0027X\u0027 formation (one up, one back diagonal) can be effective against certain teams.","Practice your serve consistency over power. A deep, consistent serve beats a fast, wild one.","When defending, aim your lobs deep and high — give yourself time to recover position.","The chiquita (soft dipping shot) is essential: aim at your opponents\u0027 feet at the net.","Don\u0027t run backwards for lobs — turn sideways and move to the ball athletically.","Use the double glass (side + back) to create angles your opponents don\u0027t expect.","Patience wins padel matches. Wait for the right ball to attack — don\u0027t force winners.","Your split step should happen just as your opponent hits the ball — it activates your movement.","The volley is a block, not a swing. Firm wrist, short movement, let the ball do the work.","Practice your \u0027por tres\u0027 (3-wall shot) — it\u0027s a spectacular way to win points.","Warm up your wrist and shoulder before every match — padel injuries are often preventable.","Against lobbers, be patient at the net. They want you to retreat — hold your ground.","The drive volley (swing volley) is great for putting away high balls — practice it.","Always know where all four players are on the court. Awareness beats speed.","When your partner is serving, stand close to the net and be aggressive on the return.","Hit the ball to the middle between opponents — confusion causes more errors than angles.","Take the ball early when possible — don\u0027t let it drop too low or you lose attacking options.","Your footwork before the shot matters more than your racket technique during it.","The Golden Point rule: on deuce, the receiving team chooses the side. Use it strategically.","Learn to read your opponent\u0027s racket face — it tells you where the ball is going before they hit it.","A good return of serve is low and to the feet of the server coming to the net.","In defense, use high lobs to the corners to pull your opponents apart.","The víbora is a side-spin overhead that stays low — it\u0027s the pro\u0027s favorite for a reason.","Don\u0027t hug the glass. Stay about 1 meter away so you have room to swing.","Switch sides with your partner fluidly — whoever is closer to the ball takes it.","When you make an error, reset mentally. The next point is a fresh start.","Play the score. At 40-0, take risks. At 30-40, play safe and consistent.","Practice your \u0027globo\u0027 (defensive lob) until you can place it deep every time.","Your non-racket hand helps with balance — keep it active, don\u0027t let it hang.","Watch pro padel on WPT or Premier Padel — you\u0027ll absorb positioning patterns naturally.","After a smash, recover quickly to the net — don\u0027t admire your shot.","Enjoy the game. The best padel comes when you\u0027re relaxed and having fun with your partner."]'::jsonb,
  '[{"slug":"origin-story","label":"Origin story","chipEmoji":"🦞","isStory":true,"story":"We didn''t plan this. Nobody drafted a mission statement or hired a consultant. One court became two, two became a tournament, and now here we are — a full-blown padel community that somehow keeps showing up. We''re competitive enough to care and relaxed enough to laugh about it. Come as you are. Stay for the padel."},{"slug":"getting-started","label":"Getting started","chipEmoji":"🎾","items":[{"q":"🎾 What''s a standard Lobster tournament?","a":"2 hours of padel, broken into 6 rounds of 20 minutes. We usually run 24 to 32 players per event, depending on demand, so there''s always a court calling your name."},{"q":"🤝 Who do I play with?","a":"Partners are predetermined, so there''s no awkward \"who wants to team up?\" energy. Tournaments are usually mixed, because honestly, it''s more fun. We don''t always manage to recruit equal numbers of men and women, but no fear: our pairing still optimizes for balanced, challenging games either way.","note":"Curious how the pairing actually works? See \"How does the matchmaker decide who plays with whom?\" under During the tournament."},{"q":"✍️ How do I sign up?","a":"Only via the website. No carrier pigeons, no DMs, no \"save me a spot\" texts."},{"q":"💳 Is there a payment?","a":"Yes, and this one isn''t up for negotiation: no payment, no spot. Registrations without payment will be cancelled.","note":"We''re a small operation, run with a lot of love. We genuinely can''t handle refunds, creative excuses, and \"I''ll get you next time\" math, so please just pay your part on time and keep it fair for everyone. Easy."},{"q":"🔑 What do I do if I forgot my PIN?","a":"No panic needed. Tap \"Email me a sign-up link.\" If you really want your PIN back, email us at pin@padelobsters.nl."}]},{"slug":"rules-and-perks","label":"Tournament rules and perks","chipEmoji":"📋","items":[{"q":"📋 What are the rules? (read these, seriously)","a":"Be there 15 minutes early. Check in, warm up, find your people. Stay at least 30 minutes after — that''s when the food, the raffle, and the good chat happen, so don''t be the person who sneaks off. Bring your competitive spirit and be kind to the group: we play hard and we play nice. Both. Always."},{"q":"🎁 What''s included?","a":"Your spot gets you:","list":[{"emoji":"⏱️","text":"2 hours on court"},{"emoji":"🎾","text":"Balls — provided, so don''t raid your garage"},{"emoji":"🍽️","text":"Food after the tournament — refuel after the carnage"},{"emoji":"🏆","text":"A prize for the tournament winner"},{"emoji":"🎟️","text":"Raffle prizes — because sometimes the lobster gods just like you"},{"emoji":"🎮","text":"Lobster Games — you pick who''s best"}]},{"q":"🎉 What are the prizes?","a":"They vary, but mostly come from the Padel Lobsters merch line. Win glory, wear glory."}]},{"slug":"during-the-tournament","label":"During the tournament","chipEmoji":"📅","items":[{"q":"📅 How do I know which court to go to, and who I''m playing?","a":"Once the tournament kicks off, open the app and you''ll see your personal schedule: all 6 of your rounds, in order, each with a court number and your opponents for that round. No wandering around asking \"wait, am I on court 3?\"","note":"You only see your own rounds and courts, so there''s no need to dig through the full draw — just glance at the app between matches and head to the right court. Report your score to the admin when you''re done with your game."},{"q":"🏆 How are tournament points calculated?","a":"Each of your 6 rounds is a fast, timed match, and the points your side scores during that round get added to your tally. Add up your points across all 6 rounds and that''s your tournament total. Winning a round obviously helps, but a close loss can still bank you a decent haul of points, so the ranking rewards consistently good play, not just wins.","note":"If two players end up tied on total points, the tiebreaker kicks in: fewest losses wins the tie. Still tied after that? Most wins takes it."},{"q":"🤖 How does the matchmaker decide who plays with whom?","a":"Our AI matchmaker pairs and seeds everyone for balanced, challenging games, so you''ll get rallies that actually make you sweat. It draws on whichever of two sources is more reliable for you: your Playtomic score (adjusted by you) or your Lobster score.","note":"Your Lobster score evolves with you: it adjusts your starting score based on how many wins and losses you rack up in Lobster tournaments. The more you play, the more accurate it gets. These aren''t public, but trust the process — each round is worth it."},{"q":"🎮 What are the Lobster Games, and how do I vote?","a":"Every tournament, players get to vote on each other across a bunch of (very serious, totally official) categories. It''s where bragging rights are born. A few of the categories you''ll be voting on:","list":[{"emoji":"🦞","text":"Best Lobster — overall player of the day"},{"emoji":"💥","text":"Best Smash"},{"emoji":"🛡️","text":"Best Defense"},{"emoji":"🎯","text":"Best Serve"},{"emoji":"🔥","text":"Best Rally"},{"emoji":"🌟","text":"Best Newcomer"},{"emoji":"🤝","text":"Best Team Spirit"}],"note":"Vote right in the app, during and after the tournament. So pay attention out there — someone''s watching that net cord miracle and deciding if it deserves a vote."}]},{"slug":"your-profile","label":"Your profile","chipEmoji":"👤","items":[{"q":"👤 What does my profile show, and what does it all mean?","a":"Your profile lives under Community → Members. Here''s what each part means:","list":[{"label":"Rank and rating","text":"your position in the community list and your current skill rating — the number the matchmaker uses to build balanced games."},{"label":"Lobster Review","text":"a fun, one-liner about your play style, based on your real tournament results once you''ve played enough."},{"label":"Played, record, win %","text":"your all-time match count, win-loss-draw record, and win percentage across every tournament."},{"label":"Playtomic score","text":"the rating you arrived with, plus any adjustment."},{"label":"Last 5","text":"win or loss for your five most recent matches, at a glance."},{"label":"Match metrics","text":"points for and against, your average points per match, your best win streak, and your longest losing streak."},{"label":"Rivalries & chemistry","text":"your Nemesis (the opponent you struggle against most), your Best partner, and your Jinx partner (the partner you''ve had the roughest results with)."},{"label":"Head to head","text":"your personal record against specific opponents and pairs you''ve faced before."},{"label":"Tournament history","text":"every tournament you''ve played, with your finishing rank, the date, your record, and the points you scored."}]}]},{"slug":"cancellations-and-transfers","label":"Cancellations and transfers","chipEmoji":"🔁","items":[{"q":"🔁 Can I cancel?","a":"There are no cancellations. But you''re not stuck:","list":[{"emoji":"🔄","text":"Transfer your spot to someone on the waiting list, or"},{"emoji":"💬","text":"Post in the group chat to find a replacement yourself."}],"note":"Just don''t ghost us."},{"q":"📲 How does transferring a spot actually work?","a":"Here''s the full walkthrough, using Oscar (who can''t make it anymore) and Kim (who wants in) as the example:","steps":[{"title":"Open your registration.","text":"Oscar goes to his registered event and finds his registration card. It shows Confirmed and a Transfer spot to another player button.","image":"/lobster-way/transfer-step-1.png"},{"title":"Pick who takes over.","text":"Tapping that button opens a picker. Waitlisted players are shown first (Kim, at Level 2.5, is on the waitlist), but Oscar can search for anyone else in the club too. He picks Kim.","image":"/lobster-way/transfer-step-2.png"},{"title":"Send it straight to their WhatsApp.","text":"This is the one-tap part: Oscar gets a Contact Kim on WhatsApp button that opens a WhatsApp chat with Kim directly, message already filled in — no copying or pasting. If Kim doesn''t have a WhatsApp number on file, or as a backup, there''s also Post in Lobsters WhatsApp group, which copies the message so Oscar can paste it there instead.","image":"/lobster-way/transfer-step-3.png"},{"title":"Your spot stays held.","text":"Oscar stays registered while the offer is pending — no expiry, it only closes automatically once the event starts. His registration card shows a Transfer offer pending banner with buttons to Resend WhatsApp or Cancel offer any time before Kim responds.","image":"/lobster-way/transfer-step-4.png"},{"title":"Kim opens the link and responds.","text":"Tapping the WhatsApp message takes her straight to the offer in the app (behind her PIN if she isn''t already signed in). She sees who it''s from, the event details, and Decline / Accept transfer buttons. If she''s already signed into the app, the same offer also shows up right on her own registration card, so she doesn''t even need to tap the link.","image":"/lobster-way/transfer-step-5.png"},{"title":"Done, either way.","text":"If she accepts, she''s registered and Oscar''s registration is cancelled — he shares the payment link with her separately. If she declines (or Oscar cancels first), Oscar keeps his spot and can offer it to someone else.","image":"/lobster-way/transfer-step-6.png"}],"note":"Payment is always between the two players; the app doesn''t process it."},{"q":"⏳ How do I get on the waiting list?","a":"Hit \"Join waiting list\" on the tournament. If a spot opens up, you''ll get a WhatsApp from the person giving theirs up, so keep an eye out — and don''t forget you''re on the list!"},{"q":"🚫 What about no-shows?","a":"We''ve never had one, and we''d very much like to keep that streak alive.","note":"So consider this fair warning: people who don''t show up won''t be able to join future tournaments. The Lobster remembers."}]},{"slug":"extras","label":"Extras","chipEmoji":"📣","items":[{"q":"📸 Do you take photos at tournaments?","a":"At some tournaments we take pictures for our social media campaigns. We''re very respectful about it: we keep things flattering and avoid close-ups. If you''d rather not appear, no problem at all — just let the organisers know and we''ll keep you out of frame."},{"q":"🛍️ Where do I buy Padel Lobsters merch?","a":"Directly on the website. Wear the claw with pride."},{"q":"🛠️ The app is acting up. Where do I shout about it?","a":"Join the \"Lobster App Help / Feedback\" thread in the WhatsApp group and post your question there."},{"q":"💡 I have feedback, a brilliant idea, or a complaint.","a":"Reach us via the WhatsApp group or email. We actually read these."},{"q":"📣 How do I stay in the loop?","a":"Join the Padel Lobsters WhatsApp group to stay on top of tournaments, scout for padel buddies, and (more often than you''d expect) pick up gifs you never knew you needed.","note":"Never want to miss a tournament? Subscribe to email reminders."}]}]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  whatsapp_link       = EXCLUDED.whatsapp_link,
  group_name          = EXCLUDED.group_name,
  padel_tips          = EXCLUDED.padel_tips,
  lobster_way_content = EXCLUDED.lobster_way_content;

-- ── Players ──────────────────────────────────────────────────────────────────
-- 00…01–19: league and event regulars. 00…20–26: reserved for the sign-in
-- specs (e2e/email-sign-in.spec.ts), which change their auth state, so they
-- play in nothing. 00…27–28: placeholders (league partners with no account).
-- The ensure_auth_user trigger creates each auth user; sync_player_pin_hash
-- hashes the PINs.

INSERT INTO players (id, name, gender, playtomic_level, adjusted_level, status, is_left_handed, country, preferred_position, email, pin, role)
VALUES
  ('00000000-0000-4000-a000-000000000001', 'Mara Quint',     'female', 3.0, 3.0, 'active', false, 'NL', 'left',  'admin@lobsters.test',  '9999', 'admin'),
  ('00000000-0000-4000-a000-000000000002', 'Lena Voss',      'female', 2.4, 2.4, 'active', false, 'DE', 'right', 'lena@lobsters.test',   '', 'player'),
  ('00000000-0000-4000-a000-000000000003', 'Ines Calder',    'female', 1.8, 1.8, 'active', true,  'PT', 'both',  'ines@lobsters.test',   '', 'player'),
  ('00000000-0000-4000-a000-000000000004', 'Noor Haddad',    'female', 2.9, 2.9, 'active', false, 'NL', 'left',  'noor@lobsters.test',   '', 'player'),
  ('00000000-0000-4000-a000-000000000005', 'Sofia Brandt',   'female', 1.5, 1.5, 'active', false, 'SE', 'right', 'sofia@lobsters.test',  '', 'player'),
  ('00000000-0000-4000-a000-000000000006', 'Elif Kaya',      'female', 2.2, 2.2, 'active', false, 'TR', 'both',  'elif@lobsters.test',   '', 'player'),
  ('00000000-0000-4000-a000-000000000007', 'Hanna Moreau',   'female', 3.2, 3.2, 'active', false, 'FR', 'left',  'hanna@lobsters.test',  '', 'player'),
  ('00000000-0000-4000-a000-000000000008', 'Priya Menon',    'female', 2.6, 2.6, 'active', false, 'IN', 'right', 'priya@lobsters.test',  '', 'player'),
  ('00000000-0000-4000-a000-000000000009', 'Clara Duval',    'female', 2.0, 2.0, 'active', false, 'BE', 'right', 'clara@lobsters.test',  '', 'player'),
  ('00000000-0000-4000-a000-000000000010', 'Theo Lind',      'male',   2.5, 2.5, 'active', false, 'NL', 'right', 'player@lobsters.test', '1234', 'player'),
  ('00000000-0000-4000-a000-000000000011', 'Bram Visser',    'male',   3.1, 3.1, 'active', false, 'NL', 'left',  'bram@lobsters.test',   '', 'player'),
  ('00000000-0000-4000-a000-000000000012', 'Diego Ferraz',   'male',   2.7, 2.7, 'active', true,  'BR', 'both',  'diego@lobsters.test',  '', 'player'),
  ('00000000-0000-4000-a000-000000000013', 'Kofi Mensah',    'male',   1.9, 1.9, 'active', false, 'GH', 'right', 'kofi@lobsters.test',   '', 'player'),
  ('00000000-0000-4000-a000-000000000014', 'Luca Bianchi',   'male',   3.4, 3.4, 'active', false, 'IT', 'left',  'luca@lobsters.test',   '', 'player'),
  ('00000000-0000-4000-a000-000000000015', 'Omar Sayed',     'male',   2.3, 2.3, 'active', false, 'EG', 'right', 'omar@lobsters.test',   '', 'player'),
  ('00000000-0000-4000-a000-000000000016', 'Jonas Weber',    'male',   1.6, 1.6, 'active', false, 'DE', 'both',  'jonas@lobsters.test',  '', 'player'),
  ('00000000-0000-4000-a000-000000000017', 'Ravi Kapoor',    'male',   2.8, 2.8, 'active', false, 'IN', 'right', 'ravi@lobsters.test',   '', 'player'),
  ('00000000-0000-4000-a000-000000000018', 'Felix Novak',    'male',   2.1, 2.1, 'active', false, 'CZ', 'left',  'felix@lobsters.test',  '', 'player'),
  ('00000000-0000-4000-a000-000000000019', 'Mateo Ruiz',     'male',   3.0, 3.0, 'active', false, 'ES', 'right', 'mateo@lobsters.test',  '', 'player'),
  ('00000000-0000-4000-a000-000000000020', 'Wren Abbott',    'female', 2.0, 2.0, 'active', false, 'GB', 'right', 'code@lobsters.test',          '', 'player'),
  ('00000000-0000-4000-a000-000000000021', 'Nina Okoro',     'female', 2.0, 2.0, 'active', false, 'NG', 'right', 'modal@lobsters.test',         '', 'player'),
  ('00000000-0000-4000-a000-000000000022', 'Ada Park',       'female', 2.0, 2.0, 'active', false, 'KR', 'left',  'password@lobsters.test',      '', 'player'),
  ('00000000-0000-4000-a000-000000000023', 'Erik Sand',      'male',   2.0, 2.0, 'active', false, 'NO', 'right', 'link@lobsters.test',          '', 'player'),
  ('00000000-0000-4000-a000-000000000024', 'Fay Lund',       'female', 2.0, 2.0, 'active', false, 'DK', 'both',  'reset@lobsters.test',         '', 'player'),
  ('00000000-0000-4000-a000-000000000025', 'Gil Moss',       'male',   2.0, 2.0, 'active', false, 'IE', 'right', 'transfer-from@lobsters.test', '', 'player'),
  ('00000000-0000-4000-a000-000000000026', 'Hugo Lane',      'male',   2.0, 2.0, 'active', false, 'FR', 'left',  'transfer-to@lobsters.test',   '', 'player'),
  ('00000000-0000-4000-a000-000000000027', 'Kit Morrow',     'male',   1.8, 1.8, 'placeholder', false, NULL, NULL, NULL, '', 'player'),
  ('00000000-0000-4000-a000-000000000028', 'Joss Ainsley',   'female', 1.7, 1.7, 'placeholder', false, NULL, NULL, NULL, '', 'player');

-- Passwords for the e2e sign-in (they meet the D-17 rules).
UPDATE auth.users
SET encrypted_password = extensions.crypt('Lobster-Admin-9999', extensions.gen_salt('bf'))
WHERE email = 'admin@lobsters.test';
UPDATE auth.users
SET encrypted_password = extensions.crypt('Lobster-Player-1234', extensions.gen_salt('bf'))
WHERE email = 'player@lobsters.test';

-- ── Events ───────────────────────────────────────────────────────────────────
-- …101 upcoming individual · …102 finished individual (results and Oscars
-- shared) · …103 upcoming team event · …104 upcoming King of the Court.

INSERT INTO tournaments (id, name, date, time, location, max_players, format, entry_mode, status, duration, gender_mode, total_price, tikkie_link, courts, notes, completed_at, ratings_applied_at, results_shared_at)
VALUES
  ('00000000-0000-4000-b000-000000000101', 'Lobster Social', CURRENT_DATE + 7, '18:00', 'Seed Courts Amsterdam', 16, 'lobster_matching', 'individual', 'upcoming', 90, 'mixed', 160, 'https://tikkie.me/pay/seed-local',
   '[{"name":"Court 1","booked":true},{"name":"Court 2","booked":true},{"name":"Court 3","booked":false},{"name":"Court 4","booked":false}]',
   'Seed event: open for registration.', NULL, NULL, NULL),
  ('00000000-0000-4000-b000-000000000102', 'Season Opener', CURRENT_DATE - 14, '17:30', 'Seed Courts Amsterdam', 8, 'lobster_matching', 'individual', 'completed', 90, 'mixed', 80, NULL,
   '[{"name":"Court 1","booked":true},{"name":"Court 2","booked":true}]',
   'Seed event: finished, results shared.', now() - interval '14 days', now() - interval '14 days', now() - interval '13 days'),
  ('00000000-0000-4000-b000-000000000103', 'Mixed Pairs Night', CURRENT_DATE + 14, '19:00', 'Seed Courts Amsterdam', 16, 'lobster_matching', 'team', 'upcoming', 120, 'mixed', 160, NULL,
   '[{"name":"Court 1","booked":true},{"name":"Court 2","booked":false}]',
   'Seed event: register as a pair.', NULL, NULL, NULL),
  ('00000000-0000-4000-b000-000000000104', 'King of the Court', CURRENT_DATE + 21, '18:30', 'Seed Courts Amsterdam', 12, 'king_of_court', 'team', 'upcoming', 120, 'mixed', 120, NULL,
   '[{"name":"Centre","booked":true},{"name":"Court 2","booked":true},{"name":"Court 3","booked":true}]',
   'Seed event: King of the Court.', NULL, NULL, NULL);

-- Lobster Social: 12 of 16 spots, every payment state. Theo (player@) is in,
-- Bram and Mateo are not.
INSERT INTO registrations (tournament_id, player_id, status, payment_status, payment_method)
SELECT '00000000-0000-4000-b000-000000000101', p.id::uuid, 'registered', p.pay, p.method
FROM (VALUES
  ('00000000-0000-4000-a000-000000000001', 'paid',                 'tikkie'),
  ('00000000-0000-4000-a000-000000000002', 'paid',                 'tikkie'),
  ('00000000-0000-4000-a000-000000000003', 'unpaid',               NULL),
  ('00000000-0000-4000-a000-000000000004', 'pending_confirmation', 'tikkie'),
  ('00000000-0000-4000-a000-000000000005', 'tikkied',              NULL),
  ('00000000-0000-4000-a000-000000000006', 'unpaid',               NULL),
  ('00000000-0000-4000-a000-000000000010', 'unpaid',               NULL),
  ('00000000-0000-4000-a000-000000000012', 'paid',                 'cash'),
  ('00000000-0000-4000-a000-000000000013', 'covered',              NULL),
  ('00000000-0000-4000-a000-000000000014', 'unpaid',               NULL),
  ('00000000-0000-4000-a000-000000000015', 'paid',                 'tikkie'),
  ('00000000-0000-4000-a000-000000000016', 'unpaid',               NULL)
) AS p(id, pay, method);

-- Season Opener: 8 players, two rounds on two courts, all scored.
INSERT INTO registrations (tournament_id, player_id, status, payment_status)
SELECT '00000000-0000-4000-b000-000000000102', id::uuid, 'registered', 'paid'
FROM unnest(ARRAY[
  '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002',
  '00000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000004',
  '00000000-0000-4000-a000-000000000010', '00000000-0000-4000-a000-000000000011',
  '00000000-0000-4000-a000-000000000012', '00000000-0000-4000-a000-000000000013'
]) AS id;

INSERT INTO matches (tournament_id, round, court, team1_ids, team2_ids, score1, score2, completed)
VALUES
  ('00000000-0000-4000-b000-000000000102', 1, 'Court 1',
   ARRAY['00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000010']::uuid[],
   ARRAY['00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000011']::uuid[], 6, 4, true),
  ('00000000-0000-4000-b000-000000000102', 1, 'Court 2',
   ARRAY['00000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000012']::uuid[],
   ARRAY['00000000-0000-4000-a000-000000000004', '00000000-0000-4000-a000-000000000013']::uuid[], 3, 6, true),
  ('00000000-0000-4000-b000-000000000102', 2, 'Court 1',
   ARRAY['00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000012']::uuid[],
   ARRAY['00000000-0000-4000-a000-000000000004', '00000000-0000-4000-a000-000000000011']::uuid[], 6, 5, true),
  ('00000000-0000-4000-b000-000000000102', 2, 'Court 2',
   ARRAY['00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000013']::uuid[],
   ARRAY['00000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000010']::uuid[], 2, 6, true);

-- Its Oscars: voting closed and shared, two categories.
INSERT INTO lobster_oscars_sessions (id, tournament_id, started_at, closed_at, shared_at)
VALUES ('00000000-0000-4000-c000-000000000102', '00000000-0000-4000-b000-000000000102',
        now() - interval '14 days', now() - interval '13 days', now() - interval '13 days');

INSERT INTO lobster_oscars_categories (id, session_id, name, icon, display_order)
VALUES
  ('00000000-0000-4000-c000-000000000201', '00000000-0000-4000-c000-000000000102', 'Best Lobster', '🦞', 1),
  ('00000000-0000-4000-c000-000000000202', '00000000-0000-4000-c000-000000000102', 'Shot of the Night', '🎯', 2);

INSERT INTO lobster_oscars_votes (category_id, voter_id, target_id)
SELECT c.id::uuid, v.voter::uuid, v.target::uuid
FROM (VALUES
  ('00000000-0000-4000-c000-000000000201', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000004'),
  ('00000000-0000-4000-c000-000000000201', '00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000004'),
  ('00000000-0000-4000-c000-000000000201', '00000000-0000-4000-a000-000000000010', '00000000-0000-4000-a000-000000000012'),
  ('00000000-0000-4000-c000-000000000202', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000013'),
  ('00000000-0000-4000-c000-000000000202', '00000000-0000-4000-a000-000000000011', '00000000-0000-4000-a000-000000000013')
) AS v(id, voter, target)
JOIN lobster_oscars_categories c ON c.id = v.id::uuid;

-- Team events: a captain and partner register together in one statement, as
-- the team-consistency trigger checks both rows at once.
INSERT INTO event_teams (id, tournament_id, captain_id, seed)
VALUES
  ('00000000-0000-4000-d000-000000000301', '00000000-0000-4000-b000-000000000103', '00000000-0000-4000-a000-000000000010', NULL),
  ('00000000-0000-4000-d000-000000000302', '00000000-0000-4000-b000-000000000103', '00000000-0000-4000-a000-000000000004', NULL),
  ('00000000-0000-4000-d000-000000000303', '00000000-0000-4000-b000-000000000103', '00000000-0000-4000-a000-000000000014', NULL),
  ('00000000-0000-4000-d000-000000000401', '00000000-0000-4000-b000-000000000104', '00000000-0000-4000-a000-000000000011', 1),
  ('00000000-0000-4000-d000-000000000402', '00000000-0000-4000-b000-000000000104', '00000000-0000-4000-a000-000000000007', 2),
  ('00000000-0000-4000-d000-000000000403', '00000000-0000-4000-b000-000000000104', '00000000-0000-4000-a000-000000000017', 3),
  ('00000000-0000-4000-d000-000000000404', '00000000-0000-4000-b000-000000000104', '00000000-0000-4000-a000-000000000008', 4);

INSERT INTO registrations (tournament_id, player_id, team_id, status, payment_status, accepted_at)
SELECT et.tournament_id, m.player::uuid, et.id, 'registered', 'unpaid', now()
FROM (VALUES
  ('00000000-0000-4000-d000-000000000301', '00000000-0000-4000-a000-000000000010'),
  ('00000000-0000-4000-d000-000000000301', '00000000-0000-4000-a000-000000000002'),
  ('00000000-0000-4000-d000-000000000302', '00000000-0000-4000-a000-000000000004'),
  ('00000000-0000-4000-d000-000000000302', '00000000-0000-4000-a000-000000000015'),
  ('00000000-0000-4000-d000-000000000303', '00000000-0000-4000-a000-000000000014'),
  ('00000000-0000-4000-d000-000000000303', '00000000-0000-4000-a000-000000000009'),
  ('00000000-0000-4000-d000-000000000401', '00000000-0000-4000-a000-000000000011'),
  ('00000000-0000-4000-d000-000000000401', '00000000-0000-4000-a000-000000000006'),
  ('00000000-0000-4000-d000-000000000402', '00000000-0000-4000-a000-000000000007'),
  ('00000000-0000-4000-d000-000000000402', '00000000-0000-4000-a000-000000000019'),
  ('00000000-0000-4000-d000-000000000403', '00000000-0000-4000-a000-000000000017'),
  ('00000000-0000-4000-d000-000000000403', '00000000-0000-4000-a000-000000000005'),
  ('00000000-0000-4000-d000-000000000404', '00000000-0000-4000-a000-000000000008'),
  ('00000000-0000-4000-d000-000000000404', '00000000-0000-4000-a000-000000000018')
) AS m(team, player)
JOIN event_teams et ON et.id = m.team::uuid;

-- ── League ───────────────────────────────────────────────────────────────────
-- In its group stage, per division: group A of three pairs (one match still to
-- play, Theo's pair in it) and group B of two. One partner per division is a
-- placeholder.

INSERT INTO leagues (id, name, status, divisions, signup_closes_at, starts_at, ends_at,
                     group_stage_start, group_stage_end, semis_start, semis_end, finals_start, finals_end,
                     description_md, published_at, created_by)
VALUES ('00000000-0000-4000-e000-000000000501', 'Autumn League', 'group_stage', ARRAY['mens', 'womens'],
        now() - interval '30 days', CURRENT_DATE - 21, CURRENT_DATE + 42,
        CURRENT_DATE - 21, CURRENT_DATE + 14, CURRENT_DATE + 15, CURRENT_DATE + 28, CURRENT_DATE + 29, CURRENT_DATE + 42,
        'Fixed pairs, two groups per division, then semis and finals. Book your own court and enter the score.',
        now() - interval '30 days', '00000000-0000-4000-a000-000000000001');

INSERT INTO league_teams (id, league_id, division, player1_id, player2_id, team_name, experience_level, group_label)
VALUES
  ('00000000-0000-4000-e000-000000000601', '00000000-0000-4000-e000-000000000501', 'mens',   '00000000-0000-4000-a000-000000000010', '00000000-0000-4000-a000-000000000011', 'Net Rushers', 'intermediate', 'A'),
  ('00000000-0000-4000-e000-000000000602', '00000000-0000-4000-e000-000000000501', 'mens',   '00000000-0000-4000-a000-000000000012', '00000000-0000-4000-a000-000000000013', 'Glass Bangers', 'intermediate', 'A'),
  ('00000000-0000-4000-e000-000000000603', '00000000-0000-4000-e000-000000000501', 'mens',   '00000000-0000-4000-a000-000000000014', '00000000-0000-4000-a000-000000000015', 'Bandeja Bros', 'advanced', 'A'),
  ('00000000-0000-4000-e000-000000000604', '00000000-0000-4000-e000-000000000501', 'mens',   '00000000-0000-4000-a000-000000000016', '00000000-0000-4000-a000-000000000027', 'Late Lobs', 'beginner', 'B'),
  ('00000000-0000-4000-e000-000000000605', '00000000-0000-4000-e000-000000000501', 'mens',   '00000000-0000-4000-a000-000000000017', '00000000-0000-4000-a000-000000000018', 'Vibora Club', 'intermediate', 'B'),
  ('00000000-0000-4000-e000-000000000611', '00000000-0000-4000-e000-000000000501', 'womens', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002', 'Smash Sisters', 'advanced', 'A'),
  ('00000000-0000-4000-e000-000000000612', '00000000-0000-4000-e000-000000000501', 'womens', '00000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000004', 'Volley Queens', 'intermediate', 'A'),
  ('00000000-0000-4000-e000-000000000613', '00000000-0000-4000-e000-000000000501', 'womens', '00000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000006', 'Chiquita Club', 'beginner', 'A'),
  ('00000000-0000-4000-e000-000000000614', '00000000-0000-4000-e000-000000000501', 'womens', '00000000-0000-4000-a000-000000000007', '00000000-0000-4000-a000-000000000028', 'Wall Whisperers', 'intermediate', 'B'),
  ('00000000-0000-4000-e000-000000000615', '00000000-0000-4000-e000-000000000501', 'womens', '00000000-0000-4000-a000-000000000008', '00000000-0000-4000-a000-000000000009', 'Bajada Belles', 'intermediate', 'B');

INSERT INTO league_matches (league_id, division, stage, team1_id, team2_id, set_scores, winner_id, played_on, location)
VALUES
  ('00000000-0000-4000-e000-000000000501', 'mens', 'group', '00000000-0000-4000-e000-000000000601', '00000000-0000-4000-e000-000000000602',
   '[{"t1":6,"t2":4},{"t1":6,"t2":3}]', '00000000-0000-4000-e000-000000000601', CURRENT_DATE - 10, 'Seed Courts Amsterdam'),
  ('00000000-0000-4000-e000-000000000501', 'mens', 'group', '00000000-0000-4000-e000-000000000602', '00000000-0000-4000-e000-000000000603',
   '[{"t1":6,"t2":4},{"t1":2,"t2":6},{"t1":5,"t2":7}]', '00000000-0000-4000-e000-000000000603', CURRENT_DATE - 6, 'Seed Courts Amsterdam'),
  ('00000000-0000-4000-e000-000000000501', 'mens', 'group', '00000000-0000-4000-e000-000000000601', '00000000-0000-4000-e000-000000000603',
   NULL, NULL, NULL, NULL),
  ('00000000-0000-4000-e000-000000000501', 'mens', 'group', '00000000-0000-4000-e000-000000000604', '00000000-0000-4000-e000-000000000605',
   '[{"t1":4,"t2":6},{"t1":6,"t2":2},{"t1":7,"t2":5}]', '00000000-0000-4000-e000-000000000604', CURRENT_DATE - 8, 'Seed Courts Amsterdam'),
  ('00000000-0000-4000-e000-000000000501', 'womens', 'group', '00000000-0000-4000-e000-000000000611', '00000000-0000-4000-e000-000000000612',
   '[{"t1":6,"t2":2},{"t1":6,"t2":1}]', '00000000-0000-4000-e000-000000000611', CURRENT_DATE - 9, 'Seed Courts Amsterdam'),
  ('00000000-0000-4000-e000-000000000501', 'womens', 'group', '00000000-0000-4000-e000-000000000612', '00000000-0000-4000-e000-000000000613',
   '[{"t1":6,"t2":3},{"t1":6,"t2":4}]', '00000000-0000-4000-e000-000000000612', CURRENT_DATE - 5, 'Seed Courts Amsterdam'),
  ('00000000-0000-4000-e000-000000000501', 'womens', 'group', '00000000-0000-4000-e000-000000000611', '00000000-0000-4000-e000-000000000613',
   NULL, NULL, NULL, NULL),
  ('00000000-0000-4000-e000-000000000501', 'womens', 'group', '00000000-0000-4000-e000-000000000614', '00000000-0000-4000-e000-000000000615',
   '[{"t1":3,"t2":6},{"t1":4,"t2":6}]', '00000000-0000-4000-e000-000000000615', CURRENT_DATE - 4, 'Seed Courts Amsterdam');

-- ── Shop ─────────────────────────────────────────────────────────────────────

INSERT INTO merch_items (id, name, description, price, sizes, category, active, display_order)
VALUES
  (1, 'Lobster Tee',  'Soft cotton tee with the club lobster.', 25, ARRAY['S', 'M', 'L', 'XL'], 'apparel', true, 1),
  (2, 'Lobster Cap',  'One size, adjustable strap.',            18, NULL,                       'apparel', true, 2);
SELECT setval(pg_get_serial_sequence('merch_items', 'id'), 2);

-- One order in each state: ordered, paid, delivered.
INSERT INTO merch_interests (player_id, merch_item_id, size, paid, delivered, status)
VALUES
  ('00000000-0000-4000-a000-000000000012', 1, 'L',  false, false, 'ordered'),
  ('00000000-0000-4000-a000-000000000002', 1, 'M',  true,  false, 'paid'),
  ('00000000-0000-4000-a000-000000000004', 2, NULL, true,  true,  'delivered');

-- ── Raffle winners (historical) ──────────────────────────────────────────────

INSERT INTO raffle_winners (player_id, tournament_id, won_at_date, tournament_label, cooldown_offset, prize)
VALUES
  ('00000000-0000-4000-a000-000000000005', '00000000-0000-4000-b000-000000000102', CURRENT_DATE - 14, 'Season Opener', 0, 'Lobster Tee'),
  ('00000000-0000-4000-a000-000000000013', '00000000-0000-4000-b000-000000000102', CURRENT_DATE - 14, 'Season Opener', 0, 'Lobster Cap');
