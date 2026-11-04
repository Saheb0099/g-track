-- The newest G Track release. Friends install the APK by hand, so the app compares its own
-- versionCode with this and says when a newer file is out. Updated from the CLI (not the app)
-- whenever a new APK is shared:
--   update public.app_config set latest_version_code = 2, latest_version_name = '1.0.1';

create table public.app_config (
  id smallint primary key default 1 check (id = 1),
  latest_version_code int not null check (latest_version_code >= 1),
  latest_version_name text not null,
  updated_at timestamptz not null default now()
);

insert into public.app_config (latest_version_code, latest_version_name) values (1, '1.0.0');

alter table public.app_config enable row level security;
create policy "Signed-in users can read the latest version"
  on public.app_config for select to authenticated using (true);

revoke all on public.app_config from anon, authenticated;
grant select on public.app_config to authenticated;
