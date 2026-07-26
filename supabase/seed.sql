-- =============================================================================
--  PADEL LOBSTERS — Local Development Seed Data
--
--  Generated from production on 2026-07-26.
--  This file is run automatically by `supabase db reset` after all migrations.
--  It populates the local database with realistic data so you can develop and
--  test without touching production.
--
--  Known logins: PIN '9999' = admin (Jon Grim), PIN '1234' = plain player (Trunal).
--  Trunal holds the player-login PIN instead of Zornitsa Mihaylova (used pre-2026-07-26)
--  because Zornitsa is now an admin in production — keeping the test PINs on a
--  non-admin/admin pair avoids surprising a "log in as player" test with admin UI.
--  Emails: All replaced with @lobsters.test addresses.
--
--  NOTE: This is NOT run against production. It is local-only.
-- =============================================================================

-- ── Settings ─────────────────────────────────────────────────────────────────

INSERT INTO settings (id, whatsapp_link, group_name, padel_tips, auto_trust_until)
VALUES (
  1,
  'https://chat.whatsapp.com/test-local-dev',
  'Padel Lobsters (Local)',
  '["Always return to the center of your side after every shot — positioning wins more points than power.","Use the back glass to your advantage: let the ball bounce off it and play it on the way down.","The bandeja is your bread and butter overhead — learn it before the smash.","Communication with your partner is everything. Call \u0027mine\u0027 or \u0027yours\u0027 on every ball.","Keep your racket up and ready between shots — a low racket kills your reaction time.","The lob is the most underrated shot in padel. Use it to reset when under pressure.","Continental grip for volleys and overheads, slightly eastern for drives — don\u0027t overthink it.","Move forward together with your partner. If one goes to the net, both should be at the net.","Don\u0027t smash everything — a well-placed bandeja or víbora is harder to return than a wild smash.","Watch the ball hit your racket. Sounds obvious, but most errors come from looking away too early.","The side glass can be your best friend — practice hitting chiquitas that die off the glass.","Stay low on volleys. Bend your knees, not your back.","Change the pace often. Mixing slow lobs with fast drives keeps opponents guessing.","After serving, move forward to the net immediately — padel is won at the net.","The bajada (off the back glass overhead) is an advanced weapon. Start practicing it early.","Never stand still. Small adjustment steps between shots keep you balanced and ready.","Hit the ball in front of your body, especially on volleys — contact point is key.","The \u0027X\u0027 formation (one up, one back diagonal) can be effective against certain teams.","Practice your serve consistency over power. A deep, consistent serve beats a fast, wild one.","When defending, aim your lobs deep and high — give yourself time to recover position.","The chiquita (soft dipping shot) is essential: aim at your opponents\u0027 feet at the net.","Don\u0027t run backwards for lobs — turn sideways and move to the ball athletically.","Use the double glass (side + back) to create angles your opponents don\u0027t expect.","Patience wins padel matches. Wait for the right ball to attack — don\u0027t force winners.","Your split step should happen just as your opponent hits the ball — it activates your movement.","The volley is a block, not a swing. Firm wrist, short movement, let the ball do the work.","Practice your \u0027por tres\u0027 (3-wall shot) — it\u0027s a spectacular way to win points.","Warm up your wrist and shoulder before every match — padel injuries are often preventable.","Against lobbers, be patient at the net. They want you to retreat — hold your ground.","The drive volley (swing volley) is great for putting away high balls — practice it.","Always know where all four players are on the court. Awareness beats speed.","When your partner is serving, stand close to the net and be aggressive on the return.","Hit the ball to the middle between opponents — confusion causes more errors than angles.","Take the ball early when possible — don\u0027t let it drop too low or you lose attacking options.","Your footwork before the shot matters more than your racket technique during it.","The Golden Point rule: on deuce, the receiving team chooses the side. Use it strategically.","Learn to read your opponent\u0027s racket face — it tells you where the ball is going before they hit it.","A good return of serve is low and to the feet of the server coming to the net.","In defense, use high lobs to the corners to pull your opponents apart.","The víbora is a side-spin overhead that stays low — it\u0027s the pro\u0027s favorite for a reason.","Don\u0027t hug the glass. Stay about 1 meter away so you have room to swing.","Switch sides with your partner fluidly — whoever is closer to the ball takes it.","When you make an error, reset mentally. The next point is a fresh start.","Play the score. At 40-0, take risks. At 30-40, play safe and consistent.","Practice your \u0027globo\u0027 (defensive lob) until you can place it deep every time.","Your non-racket hand helps with balance — keep it active, don\u0027t let it hang.","Watch pro padel on WPT or Premier Padel — you\u0027ll absorb positioning patterns naturally.","After a smash, recover quickly to the net — don\u0027t admire your shot.","Enjoy the game. The best padel comes when you\u0027re relaxed and having fun with your partner."]'::jsonb,
  now() + interval '21 days'
)
ON CONFLICT (id) DO UPDATE SET
  whatsapp_link    = EXCLUDED.whatsapp_link,
  group_name       = EXCLUDED.group_name,
  padel_tips       = EXCLUDED.padel_tips,
  auto_trust_until = EXCLUDED.auto_trust_until;

-- ── Players ──────────────────────────────────────────────────────────────────
-- Full roster from production with sanitised emails (105 players, incl.
-- status='placeholder' shadow accounts for league teammates without app
-- accounts — see docs on the placeholder player pattern).
-- Players marked with pin = '9999' or '1234' can be used to test the login flow.
-- The sync_player_pin_hash trigger will bcrypt-hash the PIN on insert.

INSERT INTO players (name, gender, playtomic_level, adjustment, adjusted_level, status, is_left_handed, country, preferred_position, email, pin)
VALUES
  ('Adriana Dinu', 'female', 1.5, 0, 1.5, 'active', false, 'RO', 'right', 'adriana@lobsters.test', ''),
  ('Aimée van der Pijl', 'female', 2.8, 0, 2.8, 'active', false, 'NL', 'left', 'aimee@lobsters.test', ''),
  ('Alejandro González', 'male', 2.2, 0, 2.2, 'active', true, 'ES', 'right', 'alejandro.g@lobsters.test', ''),
  ('Alejandro Muñoz', 'male', 2.5, 0, 2.5, 'active', false, 'ES', 'left', 'alejandro.m@lobsters.test', ''),
  ('Alex B', 'male', 3, 0, 3, 'active', false, 'RO', 'left', 'alex.b@lobsters.test', ''),
  ('Alex Gomez', 'male', 3, 0, 3, 'active', true, 'ES', 'right', 'alex.g@lobsters.test', ''),
  ('Andres Mendoza', 'male', 1.2, 1.3, 2.5, 'active', true, 'MX', 'right', 'andres@lobsters.test', ''),
  ('Anne Lamsveldt', '', 0, 0, 0, 'placeholder', false, NULL, NULL, 'anne@lobsters.test', ''),
  ('Anthony Kay', 'male', 2, 0.3, 2.3, 'active', false, 'GB', 'right', 'anthony@lobsters.test', ''),
  ('Anton Volodin', 'male', 2.5, 0, 2.5, 'active', false, 'NL', 'both', 'anton@lobsters.test', ''),
  ('Arda Yucel', 'male', 2.5, 0, 2.5, 'active', false, 'TR', 'left', 'arda@lobsters.test', ''),
  ('Ashwanth', 'male', 2, 0, 2, 'active', false, 'NL', 'left', 'ashwanth@lobsters.test', ''),
  ('Aysegul Muslu', 'female', 2.5, 0, 2.5, 'active', false, 'NL', 'both', 'aysegul@lobsters.test', ''),
  ('Baris Evruke', 'male', 2, 0, 2, 'active', false, 'NL', 'both', 'baris@lobsters.test', ''),
  ('Baturay Ucer', 'male', 2, 0.5, 2.5, 'active', false, 'TR', 'right', 'baturay@lobsters.test', ''),
  ('Bianca Hoogkamer', 'female', 2.5, -0.5, 2, 'active', false, 'NL', 'left', 'bianca@lobsters.test', ''),
  ('Can Bezmen', 'male', 2, 0, 2, 'active', false, 'TR', 'right', 'can@lobsters.test', ''),
  ('Carolien van den Berg', 'female', 2, 0, 2, 'active', true, 'NL', 'right', 'carolien@lobsters.test', ''),
  ('Chelsea Veldman', '', 2, 0, 2, 'active', false, NULL, NULL, 'chelsea@lobsters.test', ''),
  ('Chloe Precey', 'female', 1.7, 0, 1.7, 'active', true, 'GB', '', 'chloe@lobsters.test', ''),
  ('Chris Desjardins ', 'male', 1.4, 0, 1.4, 'active', false, 'NL', 'both', 'chris@lobsters.test', ''),
  ('Craig Butler', 'male', 3.3, 0, 3.3, 'active', false, 'NL', 'right', 'craig@lobsters.test', ''),
  ('Daniel Net Hitter', 'male', 2.8, 0, 2.8, 'active', false, 'NL', 'left', 'daniel@lobsters.test', ''),
  ('Davide Di Domenico', 'male', 2.7, 0, 2.7, 'active', false, 'IT', '', 'davide@lobsters.test', ''),
  ('Dominika Rychlewicz', 'female', 2, 0, 2, 'active', false, 'NL', 'left', 'dominika@lobsters.test', ''),
  ('Elena Jiménez ', 'female', 3, 0, 3, 'active', false, 'ES', 'right', 'elena.j@lobsters.test', ''),
  ('Elena Quesada', '', 0, 0, 0, 'placeholder', false, NULL, NULL, 'elena.q@lobsters.test', ''),
  ('Elisabeth Vaudevire ', 'female', 2, 0, 2, 'active', false, 'FR', 'left', 'elisabeth@lobsters.test', ''),
  ('Emiliano Cenizo', 'male', 0.8, 0, 0.8, 'active', false, 'AR', 'right', 'emiliano@lobsters.test', ''),
  ('Emre Can Turkkan', 'male', 2.5, 0, 2.5, 'active', false, 'NL', 'left', 'emre.t@lobsters.test', ''),
  ('Emre Can Türkkan', '', 0, 0, 0, 'placeholder', false, NULL, NULL, 'emre.tu@lobsters.test', ''),
  ('Eric ten Kate', 'male', 2, 0, 2, 'active', false, 'NL', 'both', 'eric@lobsters.test', ''),
  ('Erica van Asten', 'female', 1.3, 0.3, 1.6, 'active', false, 'NL', 'left', 'erica@lobsters.test', ''),
  ('Favio Gerometta', 'male', 1, 0.5, 1.5, 'active', false, 'AR', 'both', 'favio@lobsters.test', ''),
  ('Francesco Di Vincenzo', 'male', 2.2, 0, 2.2, 'active', false, 'IT', 'right', 'francesco@lobsters.test', ''),
  ('Gabriela Malovrh', 'female', 1, 0, 1, 'active', false, 'AR', 'both', 'gabriela@lobsters.test', ''),
  ('Gagan Shetty', 'male', 1.3, 0.2, 1.5, 'active', false, 'IN', '', 'gagan@lobsters.test', ''),
  ('George Chondrompilas', 'male', 2.27, 0.3, 2.57, 'active', false, 'GR', 'both', 'george@lobsters.test', ''),
  ('Gino', 'male', 3, 0, 3, 'active', false, 'IT', 'both', 'gino@lobsters.test', ''),
  ('Gonzalo Espeche', 'male', 3, -0.5, 2.5, 'active', false, 'AR', 'both', 'gonzalo@lobsters.test', ''),
  ('Greg', 'male', 1.3, 0.7, 2, 'active', false, 'FR', 'both', 'greg@lobsters.test', ''),
  ('Gregorio .', 'male', 2.2, 0, 2.2, 'active', false, 'IT', 'both', 'gregorio@lobsters.test', ''),
  ('Ilaria .', 'female', 2, 0, 2, 'active', false, 'NL', '', 'ilaria@lobsters.test', ''),
  ('Ingrid Oudejans', 'female', 2.7, 0, 2.7, 'active', false, 'NL', NULL, 'ingrid@lobsters.test', ''),
  ('Ini', 'female', 1.9, 0.4, 2.3, 'active', false, 'ES', 'left', 'ini@lobsters.test', ''),
  ('Jens N', 'male', 2, 0, 2, 'active', false, 'NL', 'right', 'jens@lobsters.test', ''),
  ('Jessica Spotowski', 'female', 2.4, -1, 1.4, 'active', false, 'NL', 'both', 'jessica@lobsters.test', ''),
  -- Jon (admin) gets a unique test PIN. Keep this distinct from any other
  -- seeded PIN so admin login is unambiguous when verify_player_pin_v2
  -- matches by bcrypt and there are multiple seeded test PINs.
  ('Jon Grim', 'male', 3, 0, 3, 'active', false, 'US', 'both', 'jon@lobsters.test', '9999'),
  ('Josephine Tolley', 'female', 1, 1, 2, 'active', false, 'NL', 'right', 'josephine@lobsters.test', ''),
  ('Juan Blas Diaz', 'male', 2.6, 0, 2.6, 'active', false, 'AR', 'both', 'juan.d@lobsters.test', ''),
  ('Juan Dominguez', 'male', 2, 0.5, 2.5, 'active', false, 'AR', 'both', 'juan.do@lobsters.test', ''),
  ('Julian Keerl', 'male', 2.5, 0, 2.5, 'active', false, 'NL', 'both', 'julian@lobsters.test', ''),
  ('Karlijn Oortman', '', 2.23, 0, 2.23, 'placeholder', false, NULL, NULL, 'karlijn@lobsters.test', ''),
  ('Kate Adams', '', 0, 0, 0, 'active', false, NULL, NULL, 'kate@lobsters.test', ''),
  ('Keita Eriawan', 'male', 2.7, 0.3, 3.0, 'active', false, 'ID', 'left', 'keita@lobsters.test', ''),
  ('Kemal', 'male', 1.6, 0.7, 2.3, 'active', false, 'TR', 'both', 'kemal@lobsters.test', ''),
  ('Kyle Fiore', 'male', 3, 0, 3, 'active', false, 'NL', 'left', 'kyle@lobsters.test', ''),
  ('Lara Leser', 'female', 2, 0, 2, 'active', false, 'NL', 'right', 'lara@lobsters.test', ''),
  ('Lars Theunissen', 'male', 3, 0, 3, 'active', false, 'NL', 'left', 'lars@lobsters.test', ''),
  ('Laura Schelhaas', 'female', 1.9, 0, 1.9, 'active', false, 'NL', 'left', 'laura@lobsters.test', ''),
  ('Lucas Eichhorn', 'male', 2.3, 0.5, 2.8, 'active', false, 'AR', 'right', 'lucas@lobsters.test', ''),
  ('Lucia Juelke', 'female', 2.5, 0, 2.5, 'active', true, 'DE', 'right', 'lucia@lobsters.test', ''),
  ('Lucie', '', 0, 0, 0, 'placeholder', false, NULL, NULL, 'lucie@lobsters.test', ''),
  ('Lucie Johnston', 'female', 2.5, 0, 2.5, 'active', false, 'NL', 'right', 'lucie.j@lobsters.test', ''),
  ('Maria Mata', '', 2, 0, 2, 'active', false, NULL, NULL, 'maria@lobsters.test', ''),
  ('Marielle Braak', 'female', 1.5, 0, 1.5, 'active', false, 'NL', 'right', 'marielle@lobsters.test', ''),
  ('Mario Villani', 'male', 2, 0, 2, 'active', false, 'IT', 'both', 'mario@lobsters.test', ''),
  ('Markus', 'male', 1.9, 0, 1.9, 'active', false, 'DE', 'right', 'markus@lobsters.test', ''),
  ('Massiel Dongo', 'female', 2.2, 0, 2.2, 'active', false, 'ES', 'both', 'massiel@lobsters.test', ''),
  ('Mauricio Wiersma', 'male', 3.5, 0, 3.5, 'active', false, 'AR', 'left', 'mauricio@lobsters.test', ''),
  ('Melanie Burger', 'female', 1, 0.5, 1.5, 'active', false, 'NL', 'both', 'melanie@lobsters.test', ''),
  ('Melvin Veldhuizen', 'male', 2.5, 0, 2.5, 'active', false, 'NL', 'left', 'melvin@lobsters.test', ''),
  ('Mert Gulleroglu', 'male', 2, 0.5, 2.5, 'active', false, 'NL', 'right', 'mert@lobsters.test', ''),
  ('Mick De Nijs', 'male', 2.5, 0, 2.5, 'active', false, 'NL', 'left', 'mick@lobsters.test', ''),
  ('Miguel Lopez', 'male', 2.1, 0.4, 2.5, 'active', false, 'US', NULL, 'miguel@lobsters.test', ''),
  ('Milan Kölling', 'male', 3, 0, 3, 'active', false, 'DE', 'left', 'milan@lobsters.test', ''),
  ('Miriam Hendriks', 'female', 2.4, 0, 2.4, 'active', false, 'NL', 'left', 'miriam@lobsters.test', ''),
  ('Nazar T.', 'male', 1.3, 1.7, 3.0, 'active', false, 'NL', 'right', 'nazar@lobsters.test', ''),
  ('Niall Hurley', 'male', 2.2, 0, 2.2, 'active', false, 'NL', 'left', 'niall@lobsters.test', ''),
  ('Nico Tzinieris', 'male', 1.9, 0.1, 2.0, 'active', false, 'DE', 'left', 'nico@lobsters.test', ''),
  ('Nicole Charlene', 'female', 0.7, 0.5, 1.2, 'active', false, 'ID', 'left', 'nicole@lobsters.test', ''),
  ('Nik van der Poel', 'male', 2.7, 0, 2.7, 'active', false, 'NL', 'left', 'nik@lobsters.test', ''),
  ('Noyan Tufekcioglu', 'male', 3.5, 0, 3.5, 'active', false, 'NL', 'left', 'noyan@lobsters.test', ''),
  ('Omar younis', 'male', 2, 0, 2, 'active', true, 'NL', 'right', 'omar@lobsters.test', ''),
  ('Omid H', 'male', 2, 0, 2, 'active', false, 'NL', 'left', 'omid@lobsters.test', ''),
  ('Orhan Ozkan', 'male', 2, 0, 2, 'active', false, 'NL', 'both', 'orhan@lobsters.test', ''),
  ('Özer Yılmaz', 'male', 3.5, 0, 3.5, 'active', false, 'NL', '', 'ozer@lobsters.test', ''),
  ('Paola Hasbún Lopez', 'female', 1, 0.8, 1.8, 'active', false, 'CL', 'left', 'paola@lobsters.test', ''),
  ('Paul Wood', 'male', 2.4, 0, 2.4, 'active', false, 'NL', 'left', 'paul@lobsters.test', ''),
  ('Raoul Chamuleau', 'male', 3.6, 0, 3.6, 'active', false, 'NL', 'both', 'raoul@lobsters.test', ''),
  ('Ravi Panday', 'male', 3.5, 0, 3.5, 'active', false, 'NL', 'both', 'ravi@lobsters.test', ''),
  ('Rowan Hesta', 'female', 1.5, 0.5, 2.0, 'active', false, 'NL', 'both', 'rowan@lobsters.test', ''),
  ('Sebas solis', 'male', 2.9, 0.3, 3.2, 'active', false, 'CR', 'left', 'sebas@lobsters.test', ''),
  ('Sebastian Araneda', 'male', 2.5, 0.3, 2.8, 'active', false, 'CL', 'right', 'sebastian.a@lobsters.test', ''),
  ('Sebastian Fennell', 'male', 3, 0, 3, 'active', false, 'AR', 'left', 'sebastian.f@lobsters.test', ''),
  ('Shivam Aggarwal', 'male', 1.4, 0.3, 1.7, 'active', false, 'NL', 'left', 'shivam@lobsters.test', ''),
  ('Stephanie v. Baarsen', 'female', 3, 0, 3, 'active', false, 'NL', 'both', 'stephanie@lobsters.test', ''),
  ('Timothy Tjen', 'male', 2.5, 0, 2.5, 'active', false, 'NL', 'left', 'timothy@lobsters.test', ''),
  -- Trunal gets the plain player test PIN — see header note.
  ('Trunal', 'male', 2.5, 0, 2.5, 'active', false, 'NL', 'both', 'trunal@lobsters.test', '1234'),
  ('Uziel Brito', 'male', 3, -0.3, 2.7, 'active', false, 'CL', 'right', 'uziel@lobsters.test', ''),
  ('Valesca', 'female', 2.4, 0, 2.4, 'active', false, 'NL', 'left', 'valesca@lobsters.test', ''),
  ('Xander Bliek', 'male', 0.5, 0, 0.5, 'active', false, 'NL', 'right', 'xander@lobsters.test', ''),
  ('Yaiza Lopez', '', 0, 0, 0, 'active', false, NULL, NULL, 'yaiza@lobsters.test', ''),
  ('Zeyon Henry', 'male', 2.5, 0, 2.5, 'active', false, 'NL', 'both', 'zeyon@lobsters.test', ''),
  ('Zornitsa Mihaylova', 'female', 1.6, 0.4, 2.0, 'active', false, 'BG', 'both', 'zornitsa@lobsters.test', '')
ON CONFLICT DO NOTHING;

-- Grant admin role to match production (Jon Grim, Uziel Brito, Zornitsa Mihaylova).
UPDATE players SET role = 'admin' WHERE name IN ('Jon Grim', 'Uziel Brito', 'Zornitsa Mihaylova');

-- ── Tournaments ──────────────────────────────────────────────────────────────

INSERT INTO tournaments (name, date, time, location, max_players, format, status, duration, gender_mode, notes)
VALUES
  ('Upcoming Test Tournament',  CURRENT_DATE + INTERVAL '7 days',  '18:00', 'Test Courts Amsterdam', 16, 'lobster_matching', 'upcoming', 90, 'mixed', 'Auto-generated for local development'),
  ('Past Test Tournament',      CURRENT_DATE - INTERVAL '14 days', '17:30', 'Test Courts Amsterdam', 16, 'lobster_matching', 'completed', 90, 'mixed', 'Auto-generated for local development')
ON CONFLICT DO NOTHING;

-- ── Raffle winners (historical) ──────────────────────────────────────────────
-- All historical entries use tournament_id = NULL because the seed tournaments
-- above are local test stubs, not the real LOBS #3/5/6 events.
-- Idempotent: skips any row where (player_id, won_at_date) already exists.
INSERT INTO public.raffle_winners (player_id, tournament_id, won_at_date, tournament_label, cooldown_offset, prize)
SELECT p.id, NULL, v.won_at_date, v.tournament_label, v.cooldown_offset, v.prize
FROM (VALUES
  ('Alejandro González', '2026-03-22'::date, 'LOBStournament #3', 1, 'tshirt'),
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
