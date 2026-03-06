-- 선매입에서 신세계/이마트 항목 완전 삭제
DELETE FROM rates
WHERE type = 'reserve'
  AND (name LIKE '%신세계%' OR name LIKE '%이마트%');
