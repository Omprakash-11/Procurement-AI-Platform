-- Backend Schema §6.7 — purge notifications older than 90 days, daily at 03:00 UTC
select cron.schedule(
  'purge-old-notifications',
  '0 3 * * *',
  $$ delete from public.notifications where created_at < now() - interval '90 days'; $$
);
