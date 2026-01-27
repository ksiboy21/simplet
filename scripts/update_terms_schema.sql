-- Add title columns to terms table
ALTER TABLE terms ADD COLUMN IF NOT EXISTS privacy_title TEXT DEFAULT '개인정보 수집 및 이용 동의';
ALTER TABLE terms ADD COLUMN IF NOT EXISTS responsibility_title TEXT DEFAULT '민형사상 책임 및 거래 약관 동의';

-- Optional: Update existing rows to have the default values if they are null (though DEFAULT above handles new rows)
UPDATE terms SET privacy_title = '개인정보 수집 및 이용 동의' WHERE privacy_title IS NULL;
UPDATE terms SET responsibility_title = '민형사상 책임 및 거래 약관 동의' WHERE responsibility_title IS NULL;
