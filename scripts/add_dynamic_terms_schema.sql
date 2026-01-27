-- 1. Add 'items' JSONB column to 'terms' table
ALTER TABLE terms ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- 2. Migrate existing 'reserve' terms into 'items' array
-- We create two objects: one for 'Responsibility' (Liability) and one for 'Privacy'.
UPDATE terms
SET items = jsonb_build_array(
    jsonb_build_object(
        'id', 'term_liability',
        'title', COALESCE(responsibility_title, '민형사상 책임 및 거래 약관 동의'),
        'content', responsibility,
        'required', true
    ),
    jsonb_build_object(
        'id', 'term_privacy',
        'title', COALESCE(privacy_title, '개인정보 수집 및 이용 동의'),
        'content', privacy,
        'required', true
    )
)
WHERE type = 'reserve' AND (items IS NULL OR items = '[]'::jsonb);

-- Verify migration (Optional select to check)
-- SELECT * FROM terms WHERE type = 'reserve';
