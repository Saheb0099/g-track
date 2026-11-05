-- Release 1.0.3: copies on older versions now show "G Track 1.0.3 is out".
update public.app_config set latest_version_code = 4, latest_version_name = '1.0.3', updated_at = now();
