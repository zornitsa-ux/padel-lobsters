-- players.email: blank means NULL (docs/pin-auth-removal C-1).
--
-- admin_add_player stored '' for a missing email, so "no email" had two
-- spellings and readiness/invite checks had to guard both. Existing blanks
-- become NULL, the writers stop producing them, and a check keeps it that way.
-- The email-sync trigger restores the synthetic auth address for rows that
-- change to NULL.

update public.players set email = null where email is not null and btrim(email) = '';

alter table public.players
  add constraint players_email_not_blank check (email is null or btrim(email) <> '');

-- Unchanged apart from the nullif: a blank auth email must not reach players.email.
create or replace function public.sync_auth_email_to_player()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_target  text;
  v_clean   text;
begin
  if NEW.email is distinct from OLD.email then
    if NEW.email like 'player-%@padelobsters.internal' then
      return NEW;
    end if;
    v_clean := nullif(lower(btrim(NEW.email)), '');
    if v_clean is null then
      return NEW;
    end if;
    select email into v_target from public.players where id = NEW.id;
    if lower(coalesce(v_target, '')) is distinct from v_clean then
      update public.players
        set email = v_clean
        where id = NEW.id;
    end if;
  end if;
  return NEW;
end;
$function$;
