-- PIN sign-in is retired: the verify-pin function is a 410 stub and no client
-- calls this RPC. Signed-out callers lose it now; PR 6 drops the function.
revoke execute on function public.verify_player_pin_v2(text, text, text) from anon;
