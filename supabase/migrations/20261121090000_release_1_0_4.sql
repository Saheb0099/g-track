-- Release 1.0.4: copies on older versions now show "G Track 1.0.4 is out".
update public.app_config set latest_version_code = 5, latest_version_name = '1.0.4', updated_at = now();
