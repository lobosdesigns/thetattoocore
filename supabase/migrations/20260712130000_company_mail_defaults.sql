insert into public.mail_settings (id)
values (true)
on conflict (id) do nothing;

update public.mail_settings
set
  from_email = coalesce(nullif(from_email, ''), 'support@thetattoocore.com'),
  reply_to_email = coalesce(nullif(reply_to_email, ''), 'support@thetattoocore.com'),
  from_name = coalesce(nullif(from_name, ''), 'TheTattooCore'),
  smtp_host = coalesce(nullif(smtp_host, ''), 'mail.thetattoocore.com'),
  smtp_username = coalesce(nullif(smtp_username, ''), 'support@thetattoocore.com'),
  smtp_port = coalesce(smtp_port, 465),
  smtp_secure = coalesce(smtp_secure, true),
  smtp_password_secret_name = coalesce(
    nullif(smtp_password_secret_name, ''),
    'HOSTGATOR_SMTP_PASSWORD'
  ),
  updated_at = now()
where id = true;
