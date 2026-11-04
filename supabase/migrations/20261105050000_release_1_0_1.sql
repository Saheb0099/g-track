-- Release 1.0.1: copies on 1.0.0 now show "G Track 1.0.1 is out".
-- (The CLI's query role is bound by app_config's row security, so releases are marked here.)
update public.app_config set latest_version_code = 2, latest_version_name = '1.0.1', updated_at = now();
