-- Deleting an account now waits 7 days. Meanwhile the person stays in their groups, marked as
-- deleted: friends see their past week but not where they are now. Signing in again cancels
-- it. On day 8 the hourly purge removes the account and, by cascade, everything in it.

alter table public.profiles add column deleted_at timestamptz;

-- Live positions also leave out accounts waiting to be deleted.
create or replace function private.visible_live_user_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select v.id
  from private.visible_user_ids() as v (id)
  join public.profiles p on p.id = v.id
  where (p.sharing_enabled and p.deleted_at is null) or p.id = auth.uid();
$$;

-- Schedules the deletion. Groups you run pass to the next member who isn't leaving too, so
-- someone can still invite and manage them.
create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  v_next uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  update public.profiles p
  set deleted_at = now(), sharing_enabled = false
  where p.id = auth.uid() and p.deleted_at is null;

  for r in select g.id from public.groups g where g.admin_id = auth.uid() for update loop
    select m.user_id into v_next
    from public.group_members m
    join public.profiles p on p.id = m.user_id
    where m.group_id = r.id and m.user_id <> auth.uid() and p.deleted_at is null
    order by m.joined_at, m.user_id
    limit 1;

    if v_next is not null then
      update public.groups g set admin_id = v_next where g.id = r.id;
    end if;
  end loop;
end;
$$;

-- Signing in again within the 7 days: undo the deletion. Returns whether there was one to undo.
create function public.restore_my_account()
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  update public.profiles p
  set deleted_at = null, sharing_enabled = true
  where p.id = auth.uid() and p.deleted_at is not null;
  return found;
end;
$$;

revoke all on function public.restore_my_account() from public, anon;
grant execute on function public.restore_my_account() to authenticated;

-- Day 8: remove for good. Deleting the auth user cascades to the profile, memberships and
-- points, and the profile trigger hands over or deletes any group they still run.
select cron.schedule(
  'purge-deleted-accounts',
  '30 * * * *',
  $$
    delete from auth.users u
    using public.profiles p
    where p.id = u.id and p.deleted_at < now() - interval '7 days';
  $$
);
