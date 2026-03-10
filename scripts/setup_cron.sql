-- 1. pg_cron, pg_net 확장 활성화 (Supabase 대시보드 Extensions에서도 가능)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. 2분마다 process-pending-signatures Edge Function 호출
-- ⚠️ SERVICE_ROLE_KEY를 실제 값으로 교체하세요 (Supabase 대시보드 → Project Settings → API)
SELECT cron.schedule(
  'process-pending-signatures',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://azrkfvmvlqodeovktvyw.supabase.co/functions/v1/process-pending-signatures',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  )
  $$
);

-- 확인
SELECT * FROM cron.job;
