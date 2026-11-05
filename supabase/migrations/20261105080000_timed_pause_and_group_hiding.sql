-- Two ways to share less:
-- 1. Pause for a set time: profiles.paused_until. A job every minute turns sharing back on
--    when it's reached; turning sharing on by hand clears it.
-- 2. Stop sharing with one group: group_members.hidden_at. That group sees neither where you
--    are now nor anything recorded while hidden, even after you share again (the hidden
--    stretches are kept in private.group_hidden_periods). Your other groups see you as usual.

-- ---------------------------------------------------------------------------
-- 1. Timed pause
-- ---------------------------------------------------------------------------

alter table public.profiles add column paused_until timestamptz;
grant update (paused_until) on public.profiles to authenticated;

-- Sharing on means no pause end, whichever app version turned it on.
create function private.before_profile_update()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.sharing_enabled then
    new.paused_until := null;
  end if;
  return new;
end;
$$;

create trigger before_profile_update
  before update on public.profiles
  for each row execute function private.before_profile_update();

select cron.schedule(
  'resume-timed-pauses',
  '* * * * *',
  $$ update public.profiles set sharing_enabled = true where paused_until <= now(); $$
);

-- ---------------------------------------------------------------------------
-- 2. Hiding from one group
-- ---------------------------------------------------------------------------

alter table public.group_members add column hidden_at timestamptz;

create table private.group_hidden_periods (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null
);
create index group_hidden_periods_user_group_idx on private.group_hidden_periods (user_id, group_id);

create function public.set_hidden_from_group(p_group_id uuid, p_hidden boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not private.is_member(p_group_id, auth.uid()) then
    raise exception 'not_member';
  end if;

  if p_hidden then
    update public.group_members m set hidden_at = now()
    where m.group_id = p_group_id and m.user_id = auth.uid() and m.hidden_at is null;
  else
    insert into private.group_hidden_periods (group_id, user_id, started_at, ended_at)
    select m.group_id, m.user_id, m.hidden_at, now()
    from public.group_members m
    where m.group_id = p_group_id and m.user_id = auth.uid() and m.hidden_at is not null;
    update public.group_members m set hidden_at = null
    where m.group_id = p_group_id and m.user_id = auth.uid();
  end if;
end;
$$;

revoke all on function public.set_hidden_from_group(uuid, boolean) from public, anon;
grant execute on function public.set_hidden_from_group(uuid, boolean) to authenticated;

-- Leaving (or being removed) while hidden: remember the stretch, so rejoining doesn't reveal it.
-- Skipped when the group itself is being deleted, since then nobody can see anything anyway.
create function private.before_member_delete()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.hidden_at is not null and exists (select 1 from public.groups g where g.id = old.group_id) then
    insert into private.group_hidden_periods (group_id, user_id, started_at, ended_at)
    values (old.group_id, old.user_id, old.hidden_at, now());
  end if;
  return old;
end;
$$;

create trigger before_member_delete
  before delete on public.group_members
  for each row execute function private.before_member_delete();

-- Live positions: only through a group you're not hidden from.
create or replace function private.visible_live_user_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select auth.uid()
  union
  select other.user_id
  from public.group_members mine
  join public.group_members other on other.group_id = mine.group_id
  join public.profiles p on p.id = other.user_id
  where mine.user_id = auth.uid()
    and other.hidden_at is null
    and p.sharing_enabled
    and p.deleted_at is null;
$$;

-- A past point: seen through a group you share where the person wasn't hidden at that moment.
create function private.can_see_point(p_user_id uuid, p_at timestamptz)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_user_id = auth.uid() or exists (
    select 1
    from public.group_members mine
    join public.group_members other on other.group_id = mine.group_id and other.user_id = p_user_id
    where mine.user_id = auth.uid()
      and (other.hidden_at is null or p_at < other.hidden_at)
      and not exists (
        select 1 from private.group_hidden_periods h
        where h.group_id = other.group_id and h.user_id = p_user_id
          and p_at >= h.started_at and p_at < h.ended_at
      )
  );
$$;

revoke all on function private.can_see_point(uuid, timestamptz) from public, anon;
grant execute on function private.can_see_point(uuid, timestamptz) to authenticated;

drop policy "See history of yourself and people in your groups" on public.locations;
create policy "See history of yourself and people in your groups"
  on public.locations for select to authenticated
  using (user_id in (select private.visible_user_ids()) and private.can_see_point(user_id, recorded_at));

-- Hidden stretches older than the 7 days of history protect nothing.
select cron.schedule(
  'delete-old-hidden-periods',
  '15 * * * *',
  $$ delete from private.group_hidden_periods where ended_at < now() - interval '7 days'; $$
);
