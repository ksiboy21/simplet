-- Admin Settings Table
CREATE TABLE IF NOT EXISTS admin_settings (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON admin_settings FOR SELECT USING (true);
CREATE POLICY "Admin update access" ON admin_settings FOR UPDATE USING (true);
CREATE POLICY "Admin insert access" ON admin_settings FOR INSERT WITH CHECK (true);

-- Initial Data
INSERT INTO admin_settings (key, value) VALUES ('reservation_date', '2026-01-30') ON CONFLICT DO NOTHING;
