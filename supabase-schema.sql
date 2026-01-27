-- =============================================
-- 심플티켓 Supabase Database Schema (Final Version)
-- =============================================

-- 기존 테이블이 있다면 삭제 (개발 단계이므로 리셋)
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS rates;
DROP TABLE IF EXISTS terms;

-- 1. Orders 테이블 (주문/신청 내역 통합)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 기본 정보
  type VARCHAR(20) NOT NULL,                     -- types: 'instant', 'reserve', 'submission'
  status VARCHAR(20) NOT NULL DEFAULT '주문 확인중', -- status: '주문 확인중', '예약일정 대기중', '완료', '반려'
  name VARCHAR(100) NOT NULL,                    -- 상품권 이름 (예: 신세계 모바일 상품권)
  amount INTEGER NOT NULL DEFAULT 0,             -- 액면가 총액
  rate DECIMAL(5,2) NOT NULL DEFAULT 0,          -- 적용 매입률 (예: 90.00)
  
  -- 신청자 정보
  phone VARCHAR(20) NOT NULL,                    -- 연락처 (조회용 키)
  applicant_name VARCHAR(50),                    -- 신청자/예금주 이름
  email VARCHAR(100),                            -- 이메일 (선택)
  
  -- 금융 정보 (지금결제/예약판매 시 필요)
  bank_name VARCHAR(50),
  account_number VARCHAR(50),
  
  -- 예약 판매 전용 필드
  deposit INTEGER DEFAULT 0,                     -- 계약금
  expected_date VARCHAR(20),                     -- 예약 희망일 (YYYY-MM-DD)
  is_offset BOOLEAN DEFAULT false,               -- 상계 처리 여부
  
  -- 이미지 경로 (Supabase Storage 경로 저장)
  voucher_images TEXT[] DEFAULT '{}',            -- 상품권 이미지 배열
  id_card_image TEXT,                            -- 신분증 이미지
  bank_book_image TEXT,                          -- 통장사본 이미지
  
  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Rates 테이블 (시세 관리)
CREATE TABLE rates (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL,                     -- types: 'instant', 'reserve'
  name VARCHAR(100) NOT NULL,
  rate DECIMAL(5,2) NOT NULL,                    -- 매입률 (%)
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Terms 테이블 (약관 관리)
CREATE TABLE terms (
  type VARCHAR(20) PRIMARY KEY,                  -- types: 'instant', 'reserve', 'submission'
  privacy TEXT NOT NULL,                         -- 개인정보 수집 및 이용 동의
  privacy_title TEXT DEFAULT '개인정보 수집 및 이용 동의',
  responsibility TEXT NOT NULL,                  -- 책임 동의
  responsibility_title TEXT DEFAULT '민형사상 책임 및 거래 약관 동의',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 초기 데이터 (Rates)
-- =============================================
INSERT INTO rates (type, name, rate) VALUES
  ('reserve', '롯데 모바일 상품권', 80),
  ('reserve', '신세계 이마트전용 상품권', 80),
  ('instant', '신세계 모바일 상품권', 90),
  ('instant', '신세계 지류 상품권', 91),
  ('instant', '롯데 모바일 상품권', 90),
  ('instant', '컬쳐랜드 상품권', 88);

-- =============================================
-- 초기 데이터 (Terms)
-- =============================================
INSERT INTO terms (type, privacy, privacy_title, responsibility, responsibility_title) VALUES
  ('reserve', '예약 판매 서비스 이용을 위한 개인정보 수집 및 이용 동의 내용입니다.', '개인정보 수집 및 이용 동의', '정해진 예약일에 상품권 전송이 되지 않을시 민형사상의 모든 절차에 동의합니다', '민형사상 책임 및 거래 약관 동의'),
  ('instant', '즉시 판매 서비스 이용을 위한 개인정보 수집 및 이용 동의 내용입니다.', '개인정보 수집 및 이용 동의', '이미 사용된 상품권 또는 장물이나 보이스피싱등 불법자금과 연루된 경우 모든 법적책임은 판매자에게 있습니다', '민형사상 책임 및 거래 약관 동의'),
  ('submission', '상품권 제출 서비스 이용을 위한 개인정보 수집 및 이용 동의 내용입니다.', '개인정보 수집 및 이용 동의', '제출된 상품권에 문제가 있을 시 모든 책임은 본인에게 있습니다.', '민형사상 책임 및 거래 약관 동의');

-- =============================================
-- Row Level Security (RLS) & Policies
-- =============================================

-- 모든 테이블 RLS 활성화
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;

-- 1. Orders 정책
-- 누구나 주문 생성 가능 (비회원/전화번호 기반)
CREATE POLICY "Anyone can create orders" ON orders FOR INSERT WITH CHECK (true);

-- 자신의 전화번호로 된 주문만 조회 가능 (실제로는 클라이언트에서 필터링하지만, DB 레벨에서는 일단 모두 허용하되 추후 function으로 제한 권장)
-- 개발 편의를 위해 일단 SELECT/UPDATE 모두 허용 (데모용)
CREATE POLICY "Allow public access for demo" ON orders FOR ALL USING (true);

-- 2. Rates/Terms 정책 (읽기 전용)
CREATE POLICY "Public read access" ON rates FOR SELECT USING (true);
CREATE POLICY "Public read access" ON terms FOR SELECT USING (true);

-- 관리자 기능을 위한 정책 (추후 인증 추가 시 수정)
CREATE POLICY "Admin update access" ON rates FOR UPDATE USING (true);
CREATE POLICY "Admin update access" ON terms FOR UPDATE USING (true);

-- =============================================
-- Storage Bucket 설정 (SQL로 버킷 생성은 불가할 수 있으므로 정책만 참고용으로 기재)
-- Dashboard > Storage > 'attachments' 버킷 생성 필요
-- =============================================
-- insert into storage.buckets (id, name, public) values ('attachments', 'attachments', true);
-- create policy "Public Access" on storage.objects for select using ( bucket_id = 'attachments' );
-- create policy "Public Upload" on storage.objects for insert with check ( bucket_id = 'attachments' );

