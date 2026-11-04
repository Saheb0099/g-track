-- The join screen should say up front that a group is being deleted, instead of offering
-- "Join" and then refusing. preview_group gains is_closing; changing what a function returns
-- means dropping and recreating it, so its permissions are set again too.

drop function public.preview_group(text);

create function public.preview_group(p_code text)
returns table (group_id uuid, name text, member_count int, is_member boolean, is_closing boolean)
language sql stable security definer set search_path = ''
as $$
  select
    g.id,
    g.name,
    (select count(*)::int from public.group_members m where m.group_id = g.id),
    exists (select 1 from public.group_members m where m.group_id = g.id and m.user_id = auth.uid()),
    g.deleted_at is not null
  from public.group_invites i
  join public.groups g on g.id = i.group_id
  where i.code = upper(btrim(p_code))
    and auth.uid() is not null;
$$;

revoke all on function public.preview_group(text) from public, anon;
grant execute on function public.preview_group(text) to authenticated;
