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
select throws_ok($$ select public.join_group('ZZZZZZ') $$, 'invalid_code', 'A wrong code is refused');

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

set local role anon;
select throws_ok($$ select public.create_group('Anon') $$, '42501', null, 'Signed-out users cannot call functions');
select throws_ok($$ select 1 from public.locations $$, '42501', null, 'Signed-out users cannot read locations');
select throws_ok($$ select 1 from public.app_config $$, '42501', null, 'Signed-out users cannot read the app version');
reset role;

select * from finish();
rollback;
