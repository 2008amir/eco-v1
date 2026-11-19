CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('monthly-dues-reminder', '0 8 1,25 * *', 'SELECT public.send_monthly_reminders()');