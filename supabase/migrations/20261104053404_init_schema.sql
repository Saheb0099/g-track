-- G Track: initial schema.
-- Tables, row-level security, group functions, the 10-member limit,
-- live-location bookkeeping and the 7-day cleanup job.
--
-- Rules of thumb used throughout:
--   * All group changes go through security-definer functions; clients can't write groups directly.
--   * RLS helpers live in the `private` schema, which the API does not expose.
--   * Every function sets `search_path = ''` and fully qualifies names.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

-- Device-side tracking state, reported by the app. Pausing is `profiles.sharing_enabled`.
create type public.device_status as enum ('ok', 'location_off', 'permission_missing');

-- Where a point came from: Android's fused provider, a cached last-known fix, or an IP estimate.
create type public.location_source as enum ('fused', 'last_known', 'ip');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 50),
  avatar_url text,
  sharing_enabled boolean not null default true,
  status public.device_status not null default 'ok',
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  admin_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_id_idx on public.group_members (user_id);

-- One join code per group, kept apart from `groups` so only the admin can read it.
create table public.group_invites (
  group_id uuid primary key references public.groups (id) on delete cascade,
  code text not null unique check (code ~ '^[A-HJKMNP-Z2-9]{6}$'),
  created_at timestamptz not null default now()
);

create table public.locations (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy_m real check (accuracy_m >= 0),
  speed real,
  heading real,
  source public.location_source not null default 'fused',
  battery_pct smallint check (battery_pct between 0 and 100),
  recorded_at timestamptz not null,
  received_at timestamptz not null default now(),
  -- The phone retries uploads, so the same point may arrive twice.
  unique (user_id, recorded_at)
);
create index locations_recorded_at_idx on public.locations (recorded_at);

-- Newest point per person; the live map reads and subscribes to this table only.
create table public.latest_locations (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy_m real,
  speed real,
  heading real,
  source public.location_source not null,
  battery_pct smallint,
  recorded_at timestamptz not null
);

-- ---------------------------------------------------------------------------
-- RLS helpers (private schema)
-- ---------------------------------------------------------------------------

create function private.my_group_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.group_id from public.group_members m where m.user_id = auth.uid();
$$;

create function private.my_admin_group_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select g.id from public.groups g where g.admin_id = auth.uid();
$$;

-- You plus everyone who shares at least one group with you.
create function private.visible_user_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select auth.uid()
  union
  select other.user_id
  from public.group_members mine
  join public.group_members other on other.group_id = mine.group_id
  where mine.user_id = auth.uid();
$$;

-- Like visible_user_ids, minus people who paused sharing (you always see yourself).
create function private.visible_live_user_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select v.id
  from private.visible_user_ids() as v (id)
  join public.profiles p on p.id = v.id
  where p.sharing_enabled or p.id = auth.uid();
$$;

create function private.is_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group_id and m.user_id = p_user_id
  );
$$;

create function private.require_admin(p_group_id uuid)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.groups g where g.id = p_group_id and g.admin_id = auth.uid()) then
    raise exception 'not_admin';
  end if;
end;
$$;

-- 6 characters without look-alikes (no 0/O, 1/I/L).
create function private.new_invite_code()
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(6);
  code text := '';
begin
  for i in 0..5 loop
    code := code || substr(alphabet, 1 + (get_byte(bytes, i) % length(alphabet)), 1);
  end loop;
  return code;
end;
$$;

-- Gives the group a fresh code, replacing any old one; retries on the rare collision.
create function private.assign_new_code(p_group_id uuid)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_code text;
begin
  loop
    v_code := private.new_invite_code();
    begin
      insert into public.group_invites (group_id, code)
      values (p_group_id, v_code)
      on conflict (group_id) do update set code = excluded.code, created_at = now();
      return v_code;
    exception when unique_violation then
      -- Another group already has this code; try again.
    end;
  end loop;
end;
$$;

-- Removes a member. If they were admin, the longest-standing member takes over;
-- if nobody is left, the group is deleted.
create function private.remove_member(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_admin uuid;
  v_next uuid;
begin
  select g.admin_id into v_admin from public.groups g where g.id = p_group_id for update;
  if not found then
    return;
  end if;

  delete from public.group_members m where m.group_id = p_group_id and m.user_id = p_user_id;

  if v_admin = p_user_id then
    select m.user_id into v_next
    from public.group_members m
    where m.group_id = p_group_id
    order by m.joined_at, m.user_id
    limit 1;

    if v_next is null then
      delete from public.groups g where g.id = p_group_id;
    else
      update public.groups g set admin_id = v_next where g.id = p_group_id;
    end if;
  end if;
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.my_group_ids(),
  private.my_admin_group_ids(),
  private.visible_user_ids(),
  private.visible_live_user_ids()
to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Create a profile on first sign-in, named from the Google account.
create function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Friend'
    ), 50),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Before a profile goes (account deletion), leave every group so admin passes on.
create function private.before_profile_delete()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
begin
  for r in select m.group_id from public.group_members m where m.user_id = old.id loop
    perform private.remove_member(r.group_id, old.id);
  end loop;
  return old;
end;
$$;

create trigger before_profile_delete
  before delete on public.profiles
  for each row execute function private.before_profile_delete();

-- At most 10 members per group. Locking the group row makes simultaneous joins queue up.
create function private.enforce_group_limit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform 1 from public.groups g where g.id = new.group_id for update;
  if (select count(*) from public.group_members m where m.group_id = new.group_id) >= 10 then
    raise exception 'group_full' using hint = 'A group can have at most 10 members.';
  end if;
  return new;
end;
$$;

create trigger enforce_group_limit
  before insert on public.group_members
  for each row execute function private.enforce_group_limit();

-- Fix up timestamps from the phone: clamp future clocks, drop points already past retention.
create function private.before_location_insert()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.recorded_at > now() + interval '10 minutes' then
    new.recorded_at := now();
  end if;
  if new.recorded_at < now() - interval '7 days' then
    return null;
  end if;
  new.received_at := now();
  return new;
end;
$$;

create trigger before_location_insert
  before insert on public.locations
  for each row execute function private.before_location_insert();

-- Keep latest_locations and last_seen_at current.
create function private.after_location_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.latest_locations as l
    (user_id, lat, lng, accuracy_m, speed, heading, source, battery_pct, recorded_at)
  values
    (new.user_id, new.lat, new.lng, new.accuracy_m, new.speed, new.heading, new.source, new.battery_pct, new.recorded_at)
  on conflict (user_id) do update set
    lat = excluded.lat,
    lng = excluded.lng,
    accuracy_m = excluded.accuracy_m,
    speed = excluded.speed,
    heading = excluded.heading,
    source = excluded.source,
    battery_pct = excluded.battery_pct,
    recorded_at = excluded.recorded_at
  where l.recorded_at < excluded.recorded_at;

  update public.profiles p set last_seen_at = now() where p.id = new.user_id;
  return null;
end;
$$;

create trigger after_location_insert
  after insert on public.locations
  for each row execute function private.after_location_insert();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.locations enable row level security;
alter table public.latest_locations enable row level security;

create policy "See yourself and people in your groups"
  on public.profiles for select to authenticated
  using (id in (select private.visible_user_ids()));

create policy "Edit your own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "See groups you are in"
  on public.groups for select to authenticated
  using (id in (select private.my_group_ids()));

create policy "See members of your groups"
  on public.group_members for select to authenticated
  using (group_id in (select private.my_group_ids()));

create policy "Admins see their group's join code"
  on public.group_invites for select to authenticated
  using (group_id in (select private.my_admin_group_ids()));

create policy "Upload your own points"
  on public.locations for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "See history of yourself and people in your groups"
  on public.locations for select to authenticated
  using (user_id in (select private.visible_user_ids()));

create policy "See live position of people in your groups who are sharing"
  on public.latest_locations for select to authenticated
  using (user_id in (select private.visible_live_user_ids()));

-- ---------------------------------------------------------------------------
-- Table privileges: reads go through RLS; writes only where the app needs them.
-- ---------------------------------------------------------------------------

revoke all on
  public.profiles, public.groups, public.group_members,
  public.group_invites, public.locations, public.latest_locations
from anon, authenticated;

grant select on
  public.profiles, public.groups, public.group_members,
  public.group_invites, public.locations, public.latest_locations
to authenticated;

grant update (display_name, avatar_url, sharing_enabled, status) on public.profiles to authenticated;
grant insert (lat, lng, accuracy_m, speed, heading, source, battery_pct, recorded_at) on public.locations to authenticated;

-- ---------------------------------------------------------------------------
-- Group functions (called from the app as RPCs)
-- ---------------------------------------------------------------------------

create function public.create_group(p_name text)
returns table (group_id uuid, invite_code text)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_group uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.groups (name, admin_id) values (btrim(p_name), v_uid) returning id into v_group;
  insert into public.group_members (group_id, user_id) values (v_group, v_uid);

  return query select v_group, private.assign_new_code(v_group);
end;
$$;

-- What a join code points at, so the app can confirm before joining.
create function public.preview_group(p_code text)
returns table (group_id uuid, name text, member_count int, is_member boolean)
language sql stable security definer set search_path = ''
as $$
  select
    g.id,
    g.name,
    (select count(*)::int from public.group_members m where m.group_id = g.id),
    exists (select 1 from public.group_members m where m.group_id = g.id and m.user_id = auth.uid())
  from public.group_invites i
  join public.groups g on g.id = i.group_id
  where i.code = upper(btrim(p_code))
    and auth.uid() is not null;
$$;

create function public.join_group(p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_group uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select i.group_id into v_group from public.group_invites i where i.code = upper(btrim(p_code));
  if v_group is null then
    raise exception 'invalid_code';
  end if;

  if not private.is_member(v_group, v_uid) then
    insert into public.group_members (group_id, user_id) values (v_group, v_uid);
  end if;
  return v_group;
end;
$$;

create function public.regenerate_invite_code(p_group_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin(p_group_id);
  return private.assign_new_code(p_group_id);
end;
$$;

create function public.rename_group(p_group_id uuid, p_name text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin(p_group_id);
  update public.groups g set name = btrim(p_name) where g.id = p_group_id;
end;
$$;

create function public.kick_member(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin(p_group_id);
  if p_user_id = auth.uid() then
    raise exception 'cannot_kick_self';
  end if;
  if not private.is_member(p_group_id, p_user_id) then
    raise exception 'not_member';
  end if;
  perform private.remove_member(p_group_id, p_user_id);
end;
$$;

create function public.transfer_admin(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin(p_group_id);
  if not private.is_member(p_group_id, p_user_id) then
    raise exception 'not_member';
  end if;
  update public.groups g set admin_id = p_user_id where g.id = p_group_id;
end;
$$;

create function public.leave_group(p_group_id uuid)
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
  perform private.remove_member(p_group_id, auth.uid());
end;
$$;

-- Deletes the auth user; profile, memberships and points cascade from there.
create function public.delete_my_account()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  delete from auth.users u where u.id = auth.uid();
end;
$$;

revoke all on function
  public.create_group(text),
  public.preview_group(text),
  public.join_group(text),
  public.regenerate_invite_code(uuid),
  public.rename_group(uuid, text),
  public.kick_member(uuid, uuid),
  public.transfer_admin(uuid, uuid),
  public.leave_group(uuid),
  public.delete_my_account()
from public, anon;

grant execute on function
  public.create_group(text),
  public.preview_group(text),
  public.join_group(text),
  public.regenerate_invite_code(uuid),
  public.rename_group(uuid, text),
  public.kick_member(uuid, uuid),
  public.transfer_admin(uuid, uuid),
  public.leave_group(uuid),
  public.delete_my_account()
to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: live map, sharing status and membership changes
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.latest_locations, public.profiles, public.group_members;

-- ---------------------------------------------------------------------------
-- Retention: every point is deleted 7 days after it was recorded.
-- ---------------------------------------------------------------------------

select cron.schedule(
  'delete-old-locations',
  '0 * * * *',
  $$
    delete from public.locations where recorded_at < now() - interval '7 days';
    delete from public.latest_locations where recorded_at < now() - interval '7 days';
  $$
);
