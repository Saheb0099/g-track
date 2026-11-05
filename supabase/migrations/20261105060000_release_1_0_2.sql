-- Release 1.0.2: copies on older versions now show "G Track 1.0.2 is out".
update public.app_config set latest_version_code = 3, latest_version_name = '1.0.2', updated_at = now();
