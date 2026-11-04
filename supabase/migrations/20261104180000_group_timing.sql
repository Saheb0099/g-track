-- Each group's admin chooses how often members' phones check their location and how often a
-- point is saved, 1 to 30 minutes each. A phone in several groups follows the most frequent.
-- The defaults are the timings used before this existed.

alter table public.groups
  add column check_every_min smallint not null default 1 check (check_every_min between 1 and 30),
  add column save_every_min smallint not null default 5 check (save_every_min between 1 and 30),
  add constraint groups_save_after_check check (save_every_min >= check_every_min);

create function public.set_group_timing(p_group_id uuid, p_check_every_min int, p_save_every_min int)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.groups g where g.id = p_group_id and g.admin_id = auth.uid()) then
    raise exception 'not_admin';
  end if;

  update public.groups g
  set check_every_min = p_check_every_min, save_every_min = p_save_every_min
  where g.id = p_group_id;
end;
$$;

revoke all on function public.set_group_timing(uuid, int, int) from public, anon;
grant execute on function public.set_group_timing(uuid, int, int) to authenticated;
