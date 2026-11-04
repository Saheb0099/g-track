-- Two fixes around accounts waiting to be deleted:
-- 1. Admin never passes to such an account (it's signed out and can't act), unless nobody else
--    is left, and "Make admin" refuses one.
-- 2. Deleting no longer flips the sharing switch, so cancelling the deletion leaves it as the
--    person had it: a paused account stays paused. Their live position is hidden by deleted_at
--    instead (private.visible_live_user_ids).

create or replace function private.remove_member(p_group_id uuid, p_user_id uuid)
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
    -- The longest-standing member who isn't leaving too; an account being deleted only as a last resort.
    select m.user_id into v_next
    from public.group_members m
    join public.profiles p on p.id = m.user_id
    where m.group_id = p_group_id
    order by (p.deleted_at is not null), m.joined_at, m.user_id
    limit 1;

    if v_next is null then
      delete from public.groups g where g.id = p_group_id;
    else
      update public.groups g set admin_id = v_next where g.id = p_group_id;
    end if;
  end if;
end;
$$;

create or replace function public.transfer_admin(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin(p_group_id);
  if not private.is_member(p_group_id, p_user_id) then
    raise exception 'not_member';
  end if;
  if exists (select 1 from public.profiles p where p.id = p_user_id and p.deleted_at is not null) then
    raise exception 'member_leaving';
  end if;
  update public.groups g set admin_id = p_user_id where g.id = p_group_id;
end;
$$;

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

  update public.profiles p set deleted_at = now() where p.id = auth.uid() and p.deleted_at is null;

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

create or replace function public.restore_my_account()
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  update public.profiles p set deleted_at = null where p.id = auth.uid() and p.deleted_at is not null;
  return found;
end;
$$;
