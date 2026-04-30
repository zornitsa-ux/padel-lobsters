-- Drop the legacy Kahoot-style Lobster Games tables.
-- Replaced by lobster_oscars_* (migrations 0020/0021).
-- All historical rows discarded per user instruction (the old game system "didn't work").

DROP TABLE IF EXISTS public.game_results  CASCADE;
DROP TABLE IF EXISTS public.game_votes    CASCADE;
DROP TABLE IF EXISTS public.game_sessions CASCADE;
