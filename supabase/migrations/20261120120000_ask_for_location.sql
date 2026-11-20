-- Ask for a fresh location: a friend's card has "Get location now", which wakes their phone
-- (through Firebase Cloud Messaging) to send where it is right now.
--
-- The request-location edge function calls request_location() as the asking user, which
-- checks the rules and logs the ask, then reads the friend's phone tokens with the service
-- role and sends the wake-up. Clients never read tokens or the log directly.

-- ---------------------------------------------------------------------------
-- Phone tokens: where to send a wake-up. A phone has one token; an account may have several
-- phones, and a phone that changes hands moves to the new account.
-- ---------------------------------------------------------------------------

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  updated_at timestamptz not null default now()
);
create index push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;

create function public.save_push_token(p_token text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if p_token is null or char_length(p_token) not between 20 and 4096 then
    raise exception 'invalid_token';
  end if;
  insert into public.push_tokens (token, user_id) values (p_token, auth.uid())
  on conflict (token) do update set user_id = excluded.user_id, updated_at = now();
end;
$$;

-- Signing out: this phone stops answering for the account.
create function public.remove_push_token(p_token text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.push_tokens t where t.token = p_token and t.user_id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- Requests: who asked whom, for the 2-minute wait between asks.
-- ---------------------------------------------------------------------------

create table private.location_requests (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index location_requests_pair_idx on private.location_requests (requester_id, target_id, created_at);

-- Checks you may ask this person now and logs the ask. Returns your name, for the
-- "<name> asked for your location" notice on their phone.
create function public.request_location(p_user_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot_ask_self';
  end if;
  -- Only someone whose live position you may see: in a group with you that they share with,
  -- not paused, not being deleted.
  if p_user_id not in (select private.visible_live_user_ids()) then
    raise exception 'not_sharing';
  end if;
  if exists (
    select 1 from private.location_requests r
    where r.requester_id = auth.uid() and r.target_id = p_user_id
      and r.created_at > now() - interval '2 minutes'
  ) then
    raise exception 'asked_recently';
  end if;

  insert into private.location_requests (requester_id, target_id) values (auth.uid(), p_user_id);
  select p.display_name into v_name from public.profiles p where p.id = auth.uid();
  return v_name;
end;
$$;

revoke all on function
  public.save_push_token(text),
  public.remove_push_token(text),
  public.request_location(uuid)
from public, anon;
grant execute on function
  public.save_push_token(text),
  public.remove_push_token(text),
  public.request_location(uuid)
to authenticated;

-- Old asks protect nothing; a token unused for two months belongs to a phone that's gone.
select cron.schedule(
  'delete-old-location-requests',
  '20 * * * *',
  $$
    delete from private.location_requests where created_at < now() - interval '1 day';
    delete from public.push_tokens where updated_at < now() - interval '60 days';
  $$
);
