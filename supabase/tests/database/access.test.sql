-- Access rules for groups, invites and locations, checked as different users.
-- Runs inside one transaction that is rolled back, so it's safe against the hosted project:
--   supabase test db --remote
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------------------------------------------------------------------------
-- Test helpers
-- ---------------------------------------------------------------------------

create schema tests;
grant usage on schema tests to authenticated;

-- Values shared between steps that run as different users.
create table tests.ctx (k text primary key, v text not null);
grant all on tests.ctx to authenticated;

create function tests.uid(p_name text) returns uuid language sql immutable as $$
  select case p_name
    when 'alice' then 'aaaaaaaa-0000-4000-8000-000000000001'
    when 'bob'   then 'bbbbbbbb-0000-4000-8000-000000000002'
    when 'carol' then 'cccccccc-0000-4000-8000-000000000003'
    when 'dave'  then 'dddddddd-0000-4000-8000-000000000004'
  end::uuid;
$$;

create function tests.get(p_key text) returns text language sql stable as $$
  select v from tests.ctx where k = p_key;
$$;

create function tests.gid() returns uuid language sql stable as $$
  select tests.get('group')::uuid;
$$;

-- Act as a signed-in user for the rest of the transaction (until `reset role`).
create function tests.login(p_name text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', tests.uid(p_name), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

grant execute on all functions in schema tests to authenticated;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  (tests.uid('alice'), 'alice@test.local', 'authenticated', 'authenticated', '{"full_name": "Alice"}'),
  (tests.uid('bob'),   'bob@test.local',   'authenticated', 'authenticated', '{"name": "Bob"}'),
  (tests.uid('carol'), 'carol@test.local', 'authenticated', 'authenticated', '{}'),
  (tests.uid('dave'),  'dave@test.local',  'authenticated', 'authenticated', '{"full_name": "Dave"}');

insert into auth.users (id, email, aud, role)
select ('f0000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       'filler' || n || '@test.local', 'authenticated', 'authenticated'
from generate_series(1, 8) n;

select is((select display_name from public.profiles where id = tests.uid('alice')), 'Alice',
  'Profile is created from the Google full name');
select is((select display_name from public.profiles where id = tests.uid('carol')), 'carol',
  'Profile falls back to the email name');

-- ---------------------------------------------------------------------------
-- Creating and joining a group
-- ---------------------------------------------------------------------------

select tests.login('alice');
insert into tests.ctx (k, v)
select unnest(array['group', 'code']), unnest(array[g.group_id::text, g.invite_code])
from public.create_group('  Test Crew  ') g;

select matches(tests.get('code'), '^[A-HJKMNP-Z2-9]{6}$', 'Join code is 6 characters without look-alikes');
select is((select name from public.groups where id = tests.gid()), 'Test Crew', 'Group name is trimmed');
select is((select admin_id from public.groups where id = tests.gid()), tests.uid('alice'), 'Creator is the admin');
select is((select code from public.group_invites where group_id = tests.gid()), tests.get('code'),
  'Admin can read the join code');

select tests.login('bob');
select is_empty($$ select 1 from public.groups where id = tests.gid() $$,
  'Someone outside the group cannot see it');
select is((select member_count from public.preview_group(lower(tests.get('code')))), 1,
  'Preview finds the group from a lowercase code');
select lives_ok($$ select public.join_group('  ' || lower(tests.get('code')) || ' ') $$,
  'Joining works with spaces and lowercase');
select lives_ok($$ select public.join_group(tests.get('code')) $$, 'Joining twice is harmless');
select is((select count(*) from public.group_members where group_id = tests.gid()), 2::bigint,
  'Member sees both members');
select is_empty($$ select 1 from public.group_invites where group_id = tests.gid() $$,
  'Members cannot read the join code');
select throws_ok($$ select public.kick_member(tests.gid(), tests.uid('alice')) $$, 'not_admin',
  'Members cannot kick');
select throws_ok($$ select public.regenerate_invite_code(tests.gid()) $$, 'not_admin',
  'Members cannot regenerate the code');
select throws_ok($$ select public.rename_group(tests.gid(), 'Mine now') $$, 'not_admin',
  'Members cannot rename the group');
select throws_ok($$ insert into public.groups (name, admin_id) values ('Sneaky', tests.uid('bob')) $$,
  '42501', null, 'Groups cannot be created by direct insert');
select throws_ok($$ insert into public.group_members (group_id, user_id) values (tests.gid(), tests.uid('carol')) $$,
  '42501', null, 'Members cannot be added by direct insert');

-- Make join order explicit: within one transaction now() never changes.
reset role;
update public.group_members set joined_at = now() - interval '3 hours'
  where group_id = tests.gid() and user_id = tests.uid('alice');
update public.group_members set joined_at = now() - interval '2 hours'
  where group_id = tests.gid() and user_id = tests.uid('bob');

-- ---------------------------------------------------------------------------
-- Uploading locations
-- ---------------------------------------------------------------------------

select tests.login('bob');
select lives_ok($$
  insert into public.locations (lat, lng, accuracy_m, battery_pct, recorded_at)
  values (22.5726, 88.3639, 12, 80, now() - interval '1 hour')
$$, 'Uploading your own point works');
select lives_ok($$
  insert into public.locations (lat, lng, accuracy_m, recorded_at)
  values (22.5726, 88.3639, 12, now() - interval '1 hour')
  on conflict (user_id, recorded_at) do nothing
$$, 'A retried upload of the same point is ignored');
select lives_ok($$
  insert into public.locations (lat, lng, accuracy_m, source, recorded_at)
  values (22.5800, 88.3700, 40, 'last_known', now() - interval '30 minutes')
$$, 'Uploading a second point works');
select lives_ok($$
  insert into public.locations (lat, lng, recorded_at) values (22.0, 88.0, now() - interval '8 days')
$$, 'A point older than 7 days is accepted without error');
select is((select count(*) from public.locations where user_id = tests.uid('bob')), 2::bigint,
  'Duplicates and points past retention are not stored');
select is((select recorded_at from public.latest_locations where user_id = tests.uid('bob')),
  now() - interval '30 minutes', 'Latest location tracks the newest point');
select isnt((select last_seen_at from public.profiles where id = tests.uid('bob')), null,
  'Uploading sets last_seen_at');
select throws_ok($$
  insert into public.locations (user_id, lat, lng, recorded_at) values (tests.uid('alice'), 1, 1, now())
$$, '42501', null, 'Nobody can upload points for someone else');
select throws_ok($$ update public.profiles set last_seen_at = now() where id = tests.uid('bob') $$,
  '42501', null, 'last_seen_at is only set by the server');

select tests.login('alice');
select isnt_empty($$ select 1 from public.latest_locations where user_id = tests.uid('bob') $$,
  'Group members see each other''s live position');
select is((select count(*) from public.locations where user_id = tests.uid('bob')), 2::bigint,
  'Group members see each other''s history');

-- ---------------------------------------------------------------------------
-- Strangers see nothing
-- ---------------------------------------------------------------------------

select tests.login('carol');
select is_empty($$ select 1 from public.profiles where id = tests.uid('bob') $$, 'Strangers cannot see profiles');
select is_empty($$ select 1 from public.locations where user_id = tests.uid('bob') $$, 'Strangers cannot see history');
select is_empty($$ select 1 from public.latest_locations where user_id = tests.uid('bob') $$,
  'Strangers cannot see live positions');
select is_empty($$ select 1 from public.group_members where group_id = tests.gid() $$,
  'Strangers cannot see members');
select is(public.join_group('ZZZZZZ'), null, 'A wrong code joins nothing');

-- ---------------------------------------------------------------------------
-- Pausing sharing hides only the live position
-- ---------------------------------------------------------------------------

select tests.login('bob');
select lives_ok($$ update public.profiles set sharing_enabled = false where id = tests.uid('bob') $$,
  'You can pause sharing');
select isnt_empty($$ select 1 from public.latest_locations where user_id = tests.uid('bob') $$,
  'You still see your own live position while paused');

select tests.login('alice');
select is_empty($$ select 1 from public.latest_locations where user_id = tests.uid('bob') $$,
  'Others cannot see the live position of someone paused');
select is((select count(*) from public.locations where user_id = tests.uid('bob')), 2::bigint,
  'History stays visible while paused');

-- ---------------------------------------------------------------------------
-- New members see history from before they joined
-- ---------------------------------------------------------------------------

select tests.login('dave');
select lives_ok($$ select public.join_group(tests.get('code')) $$, 'Dave joins later');
select is((select count(*) from public.locations where user_id = tests.uid('bob')), 2::bigint,
  'New members see history from before they joined');

-- ---------------------------------------------------------------------------
-- The 10-member limit
-- ---------------------------------------------------------------------------

reset role;
insert into public.group_members (group_id, user_id)
select tests.gid(), u.id from auth.users u where u.email like 'filler%' order by u.email limit 7;
select is((select count(*) from public.group_members where group_id = tests.gid()), 10::bigint,
  'Group now has 10 members');

select tests.login('carol');
select throws_ok($$ select public.join_group(tests.get('code')) $$, 'group_full', 'An 11th member is refused');

-- ---------------------------------------------------------------------------
-- Admin actions
-- ---------------------------------------------------------------------------

select tests.login('alice');
select isnt(public.regenerate_invite_code(tests.gid()), tests.get('code'), 'Admin can regenerate the code');
select is_empty($$ select 1 from public.preview_group(tests.get('code')) $$, 'The old code stops working');
select lives_ok($$ select public.rename_group(tests.gid(), 'Weekend Crew') $$, 'Admin can rename the group');
select is((select check_every_min::int * 100 + save_every_min from public.groups where id = tests.gid()), 105,
  'New groups check every 1 min and save every 5');
select lives_ok($$ select public.set_group_timing(tests.gid(), 2, 10) $$, 'Admin can change the timing');
select is((select check_every_min::int * 100 + save_every_min from public.groups where id = tests.gid()), 210,
  'The new timing is stored');
select throws_ok($$ select public.set_group_timing(tests.gid(), 0, 5) $$, '23514', null,
  'Checking less than every minute is refused');
select throws_ok($$ select public.set_group_timing(tests.gid(), 5, 31) $$, '23514', null,
  'Saving more than 30 minutes apart is refused');
select throws_ok($$ select public.set_group_timing(tests.gid(), 10, 5) $$, '23514', null,
  'Saving more often than checking is refused');
select tests.login('bob');
select throws_ok($$ select public.set_group_timing(tests.gid(), 1, 1) $$, 'not_admin',
  'Only the admin can change the timing');
select tests.login('alice');
select throws_ok($$ select public.kick_member(tests.gid(), tests.uid('alice')) $$, 'cannot_kick_self',
  'Admin cannot kick themselves');
select lives_ok($$ select public.kick_member(tests.gid(), tests.uid('dave')) $$, 'Admin can kick a member');

select tests.login('dave');
select is_empty($$ select 1 from public.locations where user_id = tests.uid('bob') $$,
  'A kicked member loses access to the group''s history');

-- ---------------------------------------------------------------------------
-- Leaving and admin hand-over
-- ---------------------------------------------------------------------------

select tests.login('alice');
select lives_ok($$ select public.leave_group(tests.gid()) $$, 'Admin can leave');
reset role;
select is((select admin_id from public.groups where id = tests.gid()), tests.uid('bob'),
  'The longest-standing member becomes admin');

select tests.login('carol');
insert into tests.ctx (k, v) select 'solo', g.group_id::text from public.create_group('Solo') g;
select lives_ok($$ select public.leave_group(tests.get('solo')::uuid) $$, 'Last member can leave');
reset role;
select is_empty($$ select 1 from public.groups where id = tests.get('solo')::uuid $$,
  'A group with nobody left is deleted');

-- ---------------------------------------------------------------------------
-- Deleting an account
-- ---------------------------------------------------------------------------

-- Carol is a friend in Bob's group, and Bob is sharing, so there's a live position to hide.
reset role;
insert into public.group_members (group_id, user_id) values (tests.gid(), tests.uid('carol'));
update public.profiles set sharing_enabled = true where id = tests.uid('bob');

select tests.login('bob');
select lives_ok($$ select public.delete_my_account() $$, 'You can delete your account');
reset role;
select isnt((select deleted_at from public.profiles where id = tests.uid('bob')), null,
  'Deletion is scheduled, not done at once');
select isnt_empty($$ select 1 from public.locations where user_id = tests.uid('bob') $$,
  'Points are kept for the 7 days');
select isnt((select admin_id from public.groups where id = tests.gid()), tests.uid('bob'),
  'Admin passes on when the admin deletes their account');

select tests.login('carol');
select isnt_empty($$ select 1 from public.group_members where user_id = tests.uid('bob') $$,
  'They stay in the group while waiting');
select isnt_empty($$ select 1 from public.locations where user_id = tests.uid('bob') $$,
  'Friends still see their past week');
select is_empty($$ select 1 from public.latest_locations where user_id = tests.uid('bob') $$,
  'Friends no longer see where they are now');

select tests.login('bob');
select is(public.restore_my_account(), true, 'Signing in again cancels the deletion');
select is((select deleted_at from public.profiles where id = tests.uid('bob')), null,
  'A restored account is no longer marked');
select is(public.restore_my_account(), false, 'Nothing to restore the second time');
select lives_ok($$ update public.profiles set sharing_enabled = false where id = tests.uid('bob') $$,
  'Bob pauses sharing');
select lives_ok($$ select public.delete_my_account() $$, 'Bob deletes his account while paused');
select is(public.restore_my_account(), true, 'Bob signs in again');
select is((select sharing_enabled from public.profiles where id = tests.uid('bob')), false,
  'Cancelling a deletion keeps sharing paused');
select lives_ok($$ select public.delete_my_account() $$, 'You can schedule it again');
reset role;

-- Run the purge job's own command on day 6, then day 8.
update public.profiles set deleted_at = now() - interval '6 days' where id = tests.uid('bob');
do $$ begin execute (select command from cron.job where jobname = 'purge-deleted-accounts'); end $$;
select isnt_empty($$ select 1 from public.profiles where id = tests.uid('bob') $$,
  'An account is kept until the 7 days are up');
update public.profiles set deleted_at = now() - interval '7 days 1 minute' where id = tests.uid('bob');
do $$ begin execute (select command from cron.job where jobname = 'purge-deleted-accounts'); end $$;
select is_empty($$ select 1 from public.profiles where id = tests.uid('bob') $$, 'On day 8 the profile is gone');
select is_empty($$ select 1 from public.locations where user_id = tests.uid('bob') $$, 'On day 8 all points are gone');
select is_empty($$ select 1 from public.group_members where user_id = tests.uid('bob') $$,
  'On day 8 they leave every group');

-- ---------------------------------------------------------------------------
-- Deleting a group
-- ---------------------------------------------------------------------------

select tests.login('dave');
insert into tests.ctx (k, v) select 'temp', g.group_id::text from public.create_group('Temp') g;
insert into tests.ctx (k, v) select 'temp_code', i.code from public.group_invites i where i.group_id = tests.get('temp')::uuid;
select tests.login('carol');
select lives_ok($$ select public.join_group(tests.get('temp_code')) $$, 'Carol joins the group');
select throws_ok($$ select public.delete_group(tests.get('temp')::uuid) $$, 'not_admin',
  'Only the admin can delete a group');

select tests.login('dave');
select lives_ok($$ select public.delete_group(tests.get('temp')::uuid) $$, 'The admin can delete the group');
select tests.login('carol');
select isnt_empty($$ select 1 from public.groups where id = tests.get('temp')::uuid and deleted_at is not null $$,
  'The group stays, marked for deletion');
select is((select is_closing from public.preview_group(tests.get('temp_code'))), true,
  'The invite preview says the group is being deleted');
select isnt_empty($$ select 1 from public.group_members where group_id = tests.get('temp')::uuid and user_id = tests.uid('carol') $$,
  'Members stay during the 7 days');
select throws_ok($$ select public.restore_group(tests.get('temp')::uuid) $$, 'not_admin',
  'Only the admin can cancel the deletion');
reset role;
delete from public.group_members where group_id = tests.get('temp')::uuid and user_id = tests.uid('carol');
select tests.login('carol');
select throws_ok($$ select public.join_group(tests.get('temp_code')) $$, 'group_closing',
  'Nobody can join a group being deleted');

select tests.login('dave');
select is(public.restore_group(tests.get('temp')::uuid), true, 'The admin can cancel the deletion');
select is((select deleted_at from public.groups where id = tests.get('temp')::uuid), null,
  'A cancelled deletion leaves the group as it was');
select is(public.restore_group(tests.get('temp')::uuid), false, 'Nothing to cancel the second time');
select lives_ok($$ select public.delete_group(tests.get('temp')::uuid) $$, 'The admin can delete it again');
reset role;

update public.groups set deleted_at = now() - interval '6 days' where id = tests.get('temp')::uuid;
do $$ begin execute (select command from cron.job where jobname = 'purge-deleted-groups'); end $$;
select isnt_empty($$ select 1 from public.groups where id = tests.get('temp')::uuid $$,
  'A group is kept until the 7 days are up');
update public.groups set deleted_at = now() - interval '7 days 1 minute' where id = tests.get('temp')::uuid;
do $$ begin execute (select command from cron.job where jobname = 'purge-deleted-groups'); end $$;
select is_empty($$ select 1 from public.groups where id = tests.get('temp')::uuid $$, 'On day 8 the group is gone');
select is_empty($$ select 1 from public.group_members where group_id = tests.get('temp')::uuid $$,
  'On day 8 its memberships are gone');
select is_empty($$ select 1 from public.group_invites where group_id = tests.get('temp')::uuid $$,
  'On day 8 its invite code is gone');

-- ---------------------------------------------------------------------------
-- Admin never passes to an account being deleted
-- ---------------------------------------------------------------------------

select tests.login('dave');
insert into tests.ctx (k, v) select 'handover', g.group_id::text from public.create_group('Handover') g;
insert into tests.ctx (k, v)
  select 'handover_code', i.code from public.group_invites i where i.group_id = tests.get('handover')::uuid;
select tests.login('carol');
select lives_ok($$ select public.join_group(tests.get('handover_code')) $$, 'Carol joins first');
select tests.login('alice');
select lives_ok($$ select public.join_group(tests.get('handover_code')) $$, 'Alice joins second');
reset role;
update public.profiles set deleted_at = now() where id = tests.uid('carol');

select tests.login('dave');
select throws_ok($$ select public.transfer_admin(tests.get('handover')::uuid, tests.uid('carol')) $$, 'member_leaving',
  'An account being deleted cannot be made admin');
select lives_ok($$ select public.leave_group(tests.get('handover')::uuid) $$, 'The admin leaves');
reset role;
select is((select admin_id from public.groups where id = tests.get('handover')::uuid), tests.uid('alice'),
  'Admin skips the longer-standing member whose account is being deleted');
update public.profiles set deleted_at = null where id = tests.uid('carol');

-- ---------------------------------------------------------------------------
-- Latest app version
-- ---------------------------------------------------------------------------

select tests.login('carol');
select isnt_empty($$ select 1 from public.app_config where latest_version_code >= 1 $$,
  'Signed-in users can read the latest version');
select throws_ok($$ update public.app_config set latest_version_code = 99 $$, '42501', null,
  'Nobody can change the latest version from the app');
reset role;

-- ---------------------------------------------------------------------------
-- Retention job and anonymous access
-- ---------------------------------------------------------------------------

select is((select schedule from cron.job where jobname = 'delete-old-locations'), '0 * * * *',
  'Hourly cleanup job is scheduled');

-- Run the job's own command. Old points can't be uploaded, so age fresh ones instead.
insert into public.locations (user_id, lat, lng, recorded_at) values
  (tests.uid('alice'), 1, 1, now() - interval '1 hour'),
  (tests.uid('alice'), 1, 1, now() - interval '2 hours');
update public.locations set recorded_at = now() - interval '8 days'
  where user_id = tests.uid('alice') and recorded_at = now() - interval '2 hours';
update public.latest_locations set recorded_at = now() - interval '8 days' where user_id = tests.uid('alice');
do $$ begin execute (select command from cron.job where jobname = 'delete-old-locations'); end $$;
select is((select count(*) from public.locations where recorded_at < now() - interval '7 days'), 0::bigint,
  'Cleanup deletes points older than 7 days');
select is((select count(*) from public.locations where user_id = tests.uid('alice')), 1::bigint,
  'Cleanup keeps newer points');
select is_empty($$ select 1 from public.latest_locations where recorded_at < now() - interval '7 days' $$,
  'Cleanup deletes a live position older than 7 days');

-- ---------------------------------------------------------------------------
-- Wrong join codes: 10 an hour per account
-- ---------------------------------------------------------------------------

reset role;
select tests.login('dave');
select lives_ok($$ select public.create_group('Dave''s group') $$, 'Dave makes a group');
reset role;
insert into tests.ctx values ('dave_code', (
  select i.code from public.group_invites i join public.groups g on g.id = i.group_id
  where g.admin_id = tests.uid('dave') and g.name = 'Dave''s group'));
-- Carol has used 1 wrong code above (ZZZZZZ); 8 more different ones, plus repeats that don't count.
do $$
begin
  perform tests.login('carol');
  for i in 1..8 loop
    perform public.preview_group('ZZZZZ' || chr(64 + i));
  end loop;
  perform public.preview_group('ZZZZZA');
  perform public.join_group('ZZZZZA');
end $$;
select is((select count(*) from public.preview_group(tests.get('dave_code'))), 1::bigint,
  'After 9 wrong codes (repeats count once), a right code still works');
select is(public.join_group('YYYYYY'), null, 'The 10th wrong code is noted');
select throws_ok($$ select public.join_group(tests.get('dave_code')) $$, 'too_many_tries',
  'After 10 wrong codes, even a right code is refused');
select throws_ok($$ select * from public.preview_group(tests.get('dave_code')) $$, 'too_many_tries',
  'Looking up codes is refused too');
select tests.login('bob');
select is((select count(*) from public.preview_group(tests.get('dave_code'))), 1::bigint,
  'Other accounts are not affected');
reset role;
update private.join_code_misses set missed_at = now() - interval '61 minutes' where user_id = tests.uid('carol');
select tests.login('carol');
select is((select count(*) from public.preview_group(tests.get('dave_code'))), 1::bigint,
  'An hour later, codes work again');
select throws_ok($$ select 1 from private.join_code_misses $$, '42501', null, 'Users cannot read the wrong-code list');
reset role;

-- ---------------------------------------------------------------------------
-- Pausing for a set time
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('eeeeeeee-0000-4000-8000-000000000005', 'erin@test.local', 'authenticated', 'authenticated', '{"name": "Erin"}'),
  ('ffffffff-0000-4000-8000-000000000006', 'frank@test.local', 'authenticated', 'authenticated', '{"name": "Frank"}'),
  ('99999999-0000-4000-8000-000000000007', 'gina@test.local', 'authenticated', 'authenticated', '{"name": "Gina"}');
create function tests.login_as(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
create function tests.erin() returns uuid language sql immutable as $$ select 'eeeeeeee-0000-4000-8000-000000000005'::uuid $$;
create function tests.frank() returns uuid language sql immutable as $$ select 'ffffffff-0000-4000-8000-000000000006'::uuid $$;
create function tests.gina() returns uuid language sql immutable as $$ select '99999999-0000-4000-8000-000000000007'::uuid $$;
grant execute on function tests.login_as(uuid), tests.erin(), tests.frank(), tests.gina() to authenticated;

select tests.login_as(tests.frank());
select lives_ok($$
  update public.profiles set sharing_enabled = false, paused_until = now() + interval '1 hour' where id = tests.frank()
$$, 'You can pause for a set time');
select lives_ok($$ update public.profiles set sharing_enabled = true where id = tests.frank() $$,
  'You can turn sharing back on early');
select is((select paused_until from public.profiles where id = tests.frank()), null,
  'Turning sharing on clears the pause end');
select lives_ok($$
  update public.profiles set sharing_enabled = false, paused_until = now() - interval '1 minute' where id = tests.frank()
$$, 'A pause whose time is up');
reset role;
select is((select schedule from cron.job where jobname = 'resume-timed-pauses'), '* * * * *',
  'The resume job runs every minute');
do $$ begin execute (select command from cron.job where jobname = 'resume-timed-pauses'); end $$;
select is((select sharing_enabled::text || ' ' || coalesce(paused_until::text, 'none') from public.profiles
  where id = tests.frank()), 'true none', 'Sharing turns back on when the pause is up');

-- ---------------------------------------------------------------------------
-- Not sharing with one group
-- ---------------------------------------------------------------------------

-- Erin and Frank share one group; Frank and Gina share another.
select tests.login_as(tests.erin());
insert into tests.ctx (k, v)
select unnest(array['g2', 'g2_code']), unnest(array[g.group_id::text, g.invite_code])
from public.create_group('Erin and Frank') g;
select tests.login_as(tests.gina());
insert into tests.ctx (k, v)
select unnest(array['g3', 'g3_code']), unnest(array[g.group_id::text, g.invite_code])
from public.create_group('Frank and Gina') g;
select tests.login_as(tests.frank());
select lives_ok($$ select public.join_group(tests.get('g2_code')), public.join_group(tests.get('g3_code')) $$,
  'Frank joins both groups');
select lives_ok($$
  insert into public.locations (lat, lng, recorded_at) values
    (22.5, 88.3, now() - interval '30 minutes'),
    (22.6, 88.4, now() - interval '10 minutes')
$$, 'Frank uploads a point before and one during the hidden time');
select lives_ok($$ select public.set_hidden_from_group(tests.get('g2')::uuid, true) $$,
  'Frank stops sharing with one group');
reset role;
update public.group_members set hidden_at = now() - interval '20 minutes'
  where group_id = tests.get('g2')::uuid and user_id = tests.frank();

select tests.login_as(tests.erin());
select is_empty($$ select 1 from public.latest_locations where user_id = tests.frank() $$,
  'That group cannot see where he is now');
select is((select count(*) from public.locations where user_id = tests.frank()), 1::bigint,
  'That group sees only history from before he stopped sharing');
select isnt_empty($$ select 1 from public.group_members where user_id = tests.frank() and hidden_at is not null $$,
  'That group can tell he is not sharing with them');
select tests.login_as(tests.gina());
select isnt_empty($$ select 1 from public.latest_locations where user_id = tests.frank() $$,
  'His other group still sees where he is');
select is((select count(*) from public.locations where user_id = tests.frank()), 2::bigint,
  'His other group still sees all his history');

select tests.login_as(tests.frank());
select lives_ok($$ select public.set_hidden_from_group(tests.get('g2')::uuid, false) $$,
  'Frank shares with the group again');
-- now() doesn't move inside a test run, so end the hidden stretch 5 minutes ago by hand.
reset role;
update private.group_hidden_periods set ended_at = now() - interval '5 minutes' where user_id = tests.frank();
select tests.login_as(tests.erin());
select isnt_empty($$ select 1 from public.latest_locations where user_id = tests.frank() $$,
  'The group sees where he is again');
select is((select count(*) from public.locations where user_id = tests.frank()), 1::bigint,
  'Points from the hidden time stay hidden afterwards');

-- Leaving while hidden, then rejoining, doesn't reveal the hidden time either.
select tests.login_as(tests.frank());
select lives_ok($$ insert into public.locations (lat, lng, recorded_at) values (22.7, 88.5, now() - interval '3 minutes') $$,
  'Frank uploads another point');
select tests.login_as(tests.erin());
select is((select count(*) from public.locations where user_id = tests.frank()), 2::bigint,
  'The group sees points from after he shared again');
select tests.login_as(tests.frank());
select lives_ok($$ select public.set_hidden_from_group(tests.get('g2')::uuid, true) $$, 'Frank hides again');
reset role;
update public.group_members set hidden_at = now() - interval '4 minutes'
  where group_id = tests.get('g2')::uuid and user_id = tests.frank();
select tests.login_as(tests.frank());
select lives_ok($$ select public.leave_group(tests.get('g2')::uuid) $$, 'Frank leaves while hidden');
select lives_ok($$ select public.join_group(tests.get('g2_code')) $$, 'Frank rejoins');
select tests.login_as(tests.erin());
select is((select count(*) from public.locations where user_id = tests.frank()), 1::bigint,
  'Rejoining does not reveal points from while he was hidden');

select tests.login('carol');
select throws_ok($$ select public.set_hidden_from_group(tests.get('g2')::uuid, true) $$, 'not_member',
  'Only members can hide from a group');
select throws_ok($$ select 1 from private.group_hidden_periods $$, '42501', null,
  'Users cannot read the hidden times');
reset role;

set local role anon;
select throws_ok($$ select public.create_group('Anon') $$, '42501', null, 'Signed-out users cannot call functions');
select throws_ok($$ select 1 from public.locations $$, '42501', null, 'Signed-out users cannot read locations');
select throws_ok($$ select 1 from public.app_config $$, '42501', null, 'Signed-out users cannot read the app version');
reset role;

select * from finish();
rollback;
