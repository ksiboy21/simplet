-- pending_signatures 테이블 생성
CREATE TABLE IF NOT EXISTS pending_signatures (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id text UNIQUE NOT NULL,
  order_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- RLS 비활성화 (Edge Function이 service role로 접근)
ALTER TABLE pending_signatures DISABLE ROW LEVEL SECURITY;
