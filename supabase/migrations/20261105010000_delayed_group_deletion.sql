-- The admin can delete a group, which waits 7 days like account deletion. Meanwhile the group
-- works as before but takes no new members, and the admin can cancel. On day 8 the hourly
-- purge removes it with its memberships and invite code; everyone's own history stays.

alter table public.groups add column deleted_at timestamptz;

create function public.delete_group(p_group_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin(p_group_id);
  update public.groups g set deleted_at = now() where g.id = p_group_id and g.deleted_at is null;
end;
$$;

-- Cancels a scheduled deletion. Returns whether there was one to cancel.
create function public.restore_group(p_group_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin(p_group_id);
  update public.groups g set deleted_at = null where g.id = p_group_id and g.deleted_at is not null;
  return found;
end;
$$;

-- As before, but a group waiting to be deleted takes no new members.
create or replace function public.join_group(p_code text)
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
    if exists (select 1 from public.groups g where g.id = v_group and g.deleted_at is not null) then
      raise exception 'group_closing';
    end if;
    insert into public.group_members (group_id, user_id) values (v_group, v_uid);
  end if;
  return v_group;
end;
$$;

revoke all on function public.delete_group(uuid), public.restore_group(uuid) from public, anon;
grant execute on function public.delete_group(uuid), public.restore_group(uuid) to authenticated;

select cron.schedule(
  'purge-deleted-groups',
  '45 * * * *',
  $$ delete from public.groups g where g.deleted_at < now() - interval '7 days'; $$
);
