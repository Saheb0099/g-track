-- Join codes can't be guessed by trying many: each account may try 10 wrong codes an hour.
-- After that, every code (right or wrong) is refused with 'too_many_tries' until the hour is up.
-- Codes are counted once each, so re-checking the same mistyped code doesn't use up tries.
--
-- An error undoes everything a function wrote, so a wrong code can't both be remembered and
-- raise 'invalid_code'. join_group therefore returns null for a wrong code now (the app turns
-- that into the same "doesn't match any group" message).

create table private.join_code_misses (
  user_id uuid not null references public.profiles (id) on delete cascade,
  code text not null,
  missed_at timestamptz not null default now(),
  primary key (user_id, code)
);

create function private.check_join_tries()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if (
    select count(*) from private.join_code_misses x
    where x.user_id = auth.uid() and x.missed_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'too_many_tries' using hint = 'Too many wrong join codes. Try again in an hour.';
  end if;
end;
$$;

create function private.record_join_miss(p_code text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  delete from private.join_code_misses x where x.missed_at <= now() - interval '1 hour';
  insert into private.join_code_misses (user_id, code) values (auth.uid(), p_code)
  on conflict (user_id, code) do update set missed_at = now();
end;
$$;

revoke all on function private.check_join_tries(), private.record_join_miss(text) from public, anon, authenticated;

create or replace function public.preview_group(p_code text)
returns table (group_id uuid, name text, member_count int, is_member boolean, is_closing boolean)
language plpgsql volatile security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_code text := upper(btrim(p_code));
begin
  if auth.uid() is null then
    return;
  end if;
  perform private.check_join_tries();

  return query
  select
    g.id,
    g.name,
    (select count(*)::int from public.group_members m where m.group_id = g.id),
    exists (select 1 from public.group_members m where m.group_id = g.id and m.user_id = auth.uid()),
    g.deleted_at is not null
  from public.group_invites i
  join public.groups g on g.id = i.group_id
  where i.code = v_code;

  if not found then
    perform private.record_join_miss(v_code);
  end if;
end;
$$;

create or replace function public.join_group(p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(btrim(p_code));
  v_group uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  perform private.check_join_tries();

  select i.group_id into v_group from public.group_invites i where i.code = v_code;
  if v_group is null then
    perform private.record_join_miss(v_code);
    return null;
  end if;

  if not private.is_member(v_group, v_uid) then
    if exists (select 1 from public.groups g where g.id = v_group and g.deleted_at is not null) then
      raise exception 'group_closing';
    end if;
    insert into public.group_members (group_id, user_id) values (v_group, v_uid);
  end if;
  return v_group;
end;
$$;
