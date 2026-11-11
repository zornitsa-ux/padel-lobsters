-- Native signup replaced this at T₀ and no client calls it since the cutover.
-- Its per-device cap keys on a caller-supplied id, so signed-out callers lose
-- it now; PR 6 drops the function.
revoke execute on function public.self_signup_player(jsonb, text, text) from anon;
