import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PageHeader, Input, Button, Card } from './ui/TossComponents';
import { PhoneVerificationInput } from './ui/PhoneVerificationInput';
import { AgreementItem } from './ui/AgreementItem';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useRates, useTerms, useUserOrders } from '@/lib/useMockData';
import { db, supabase } from '@/lib/supabase';
import { sendSMS } from '@/lib/solapi';

interface ReserveBuybackProps {
  availableDate: string; // YYYY-MM-DD from Admin
  onSuccess?: () => void;
}

export const ReserveBuyback = ({ availableDate, onSuccess }: ReserveBuybackProps) => {
  const [voucherType, setVoucherType] = useState('lotte_tomorrow');
  const [amount, setAmount] = useState<number | null>(null);

  // Data Hooks
  const { rates } = useRates();
  const { terms } = useTerms();
  const { addOrder } = useUserOrders();

  // Form State
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  // Agreements
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [agreedFinal, setAgreedFinal] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 확인코드 검증 State
  const [verifyCode, setVerifyCode] = useState('');
  const [isCodeVerified, setIsCodeVerified] = useState(false);

  const handleVerifyCode = async () => {
    try {
      const savedCode = await db.getAdminSetting('daily_code');
      if (savedCode && verifyCode === savedCode) {
        setIsCodeVerified(true);
        toast.success('확인 코드가 인증되었습니다.');
      } else {
        toast.error('확인 코드가 올바르지 않습니다.');
      }
    } catch {
      toast.error('코드 확인 중 오류가 발생했습니다.');
    }
  };

  // 서명 완료 대기 State
  const PENDING_ORDER_KEY = 'pendingEsignonOrder';
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [contractUrl, setContractUrl] = useState<string | null>(null);
  const pendingOrderRef = useRef<any>(null);

  // 컴포넌트 마운트 시 sessionStorage에서 대기 중인 주문 복원
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(PENDING_ORDER_KEY);
      if (saved) {
        const { workflowId: savedWfId, contractUrl: savedUrl, orderData } = JSON.parse(saved);
        if (savedWfId && orderData) {
          pendingOrderRef.current = orderData;
          setWorkflowId(savedWfId);
          setContractUrl(savedUrl || 'restored');
          console.log('Restored pending order from sessionStorage:', savedWfId);
        }
      }
    } catch (e) {
      console.error('sessionStorage restore error:', e);
    }
  }, []);

  // Dynamic Terms State
  type TermState = { checked: boolean; agreedAt?: string };
  const [checkedTerms, setCheckedTerms] = useState<Record<string, TermState>>({});

  // 휴대폰 번호 변경 시 인증 초기화
  useEffect(() => {
    setIsPhoneVerified(false);
  }, [contact]);

  // 필수 약관 모두 동의 여부
  const areAllTermsChecked = () => {
    if (!terms?.reserve?.items) return false;
    return terms.reserve.items.every(item => checkedTerms[item.id]?.checked);
  };

  const toggleTerm = (id: string, checked: boolean) => {
    setCheckedTerms(prev => ({
      ...prev,
      [id]: {
        checked,
        agreedAt: checked ? new Date().toISOString() : undefined
      }
    }));
  };

  const getReserveRate = (type: string) => {
    const keyword = type === 'lotte_custom' ? '공급일 지정' : '익일 공급';
    return rates.find(r => r.type === 'reserve' && r.name.includes(keyword))?.rate || 80;
  };

  const calculateTotal = (val: number | null) => {
    if (!val) return { deposit: 0, balance: 0, apply_rate: 0 };
    const buybackRate = getReserveRate(voucherType);
    const finalVal = val * (buybackRate / 100);
    return { deposit: finalVal, balance: 0, apply_rate: buybackRate };
  };

  const faceValue = amount || 0;
  const { deposit, apply_rate: RATE_PERCENT } = calculateTotal(amount);

  // eSignon 서명 상태 폴링 리스너
  useEffect(() => {
    let checkInterval: NodeJS.Timeout;

    if (contractUrl && workflowId) {
      checkInterval = setInterval(async () => {
        try {
          const { data, error } = await supabase.functions.invoke('check-esignon-status', {
            body: { workflowId }
          });

          if (!error && data?.isComplete) {
            clearInterval(checkInterval);
            if (pendingOrderRef.current) {
              await submitOrder(pendingOrderRef.current);
            }
          }
        } catch (e) {
          console.error("Status check error", e);
        }
      }, 3000); // 3초마다 상태 확인
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [contractUrl, workflowId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || contractUrl) return;
    if (!amount) return toast.error("판매금액을 선택해주세요.");
    if (!name) return toast.error("성함을 입력해주세요.");
    if (!contact) return toast.error("연락처를 입력해주세요.");
    if (!isPhoneVerified) return toast.error("연락처 인증을 완료해주세요.");
    if (!isCodeVerified) return toast.error("확인 코드 인증을 완료해주세요.");
    if (!bankName || !accountNumber) return toast.error("계좌 정보를 입력해주세요.");
    if (!areAllTermsChecked()) return toast.error("모든 필수 약관에 동의해주세요.");

    setIsSubmitting(true);
    try {
      // 중복 주문 체크
      const existingOrders = await db.getUserOrders(contact);
      const duplicate = existingOrders.find(o =>
        (o.status === '주문 확인중' || o.status === '예약일정 대기중') &&
        o.type === 'reserve'
      );
      if (duplicate) {
        toast.error(`이미 진행 중인 선매입 주문건이 있습니다. (주문번호: #${duplicate.id.slice(0, 8)})`);
        setIsSubmitting(false);
        return;
      }

      // 계약서 정보 준비
      const orderDetails = {
        applicant_name: name,
        phone: contact,
        amount: faceValue,
        deposit: deposit,
        rate: RATE_PERCENT,
        reserveRateB: getReserveRate('lotte_custom'),
        bank_name: bankName,
        account_number: accountNumber,
        voucherType,
        expected_date: availableDate,
      };

      const termAgreements = terms?.reserve?.items?.map(item => ({
        id: item.id,
        title: item.title,
        agreedAt: checkedTerms[item.id]?.agreedAt || new Date().toISOString()
      })).filter(t => checkedTerms[t.id]?.checked) || [];

      // 서명 완료 후 저장할 주문 데이터 준비 (아직 DB 저장 안함)
      pendingOrderRef.current = {
        name: voucherType === 'lotte_tomorrow' ? '롯데 모바일 익일' : '롯데 모바일 예약',
        amount: faceValue,
        deposit,
        expected_date: availableDate,
        status: '주문 확인중' as const,
        phone: contact,
        applicant_name: name,
        bank_name: bankName,
        account_number: accountNumber,
        type: 'reserve' as const,
        rate: RATE_PERCENT,
        is_my_order: true,
        term_agreements: termAgreements,
      };

      // eSignon 계약서 생성
      const { data, error } = await supabase.functions.invoke('create-esignon-link', {
        body: { orderDetails }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      // 계약서 URL + 워크플로우 ID 저장 → 완료 화면 표시 + 백그라운드 폴링 시작
      setContractUrl(data.signUrl);
      setWorkflowId(data.workflowId);

      // sessionStorage에 저장 (페이지 이탈 대비)
      sessionStorage.setItem(PENDING_ORDER_KEY, JSON.stringify({
        workflowId: data.workflowId,
        contractUrl: data.signUrl,
        orderData: pendingOrderRef.current,
      }));

    } catch (error: any) {
      console.error('eSignon Error:', error);
      toast.error(`신청 실패: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 서명 완료 후 주문 등록
  const submitOrder = async (orderData: any) => {
    try {
      await addOrder(orderData);
      try {
        await sendSMS(orderData.phone, `안녕하세요, 고객님. 주문이 정상적으로 접수되었습니다.\n검토 결과에 따라 매입이 반려될 수 있는 점 양해 부탁드립니다.\n진행 상황은 [주문내역] 페이지에서 실시간으로 확인하실 수 있습니다.`);
      } catch (smsError) {
        console.error('SMS 발송 실패:', smsError);
      }

      toast.success('계약서 서명이 완료되어 주문이 접수되었습니다!');
      pendingOrderRef.current = null;
      sessionStorage.removeItem(PENDING_ORDER_KEY);
    } catch (error) {
      console.error('Order error:', error);
      toast.error("주문 처리 중 오류가 발생했습니다.");
    }
  };

  // 신청 완료 + 서명 대기 화면
  if (contractUrl) {
    return (
      <div className="max-w-md mx-auto pb-20">
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 px-4">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center">
            <span className="text-4xl">✅</span>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-[#191F28]">신청이 완료되었습니다</h2>
            <p className="text-[15px] text-[#4E5968] leading-relaxed">
              카카오톡으로 <span className="text-[#3182F6] font-semibold">전자계약서</span>가 발송되었습니다.<br />
              계약서 서명이 완료되면 자동으로 주문이 접수됩니다.
            </p>
          </div>

          <button
            onClick={() => {
              setContractUrl(null);
              setWorkflowId(null);
              pendingOrderRef.current = null;
              if (onSuccess) onSuccess();
            }}
            className="text-[14px] text-[#8B95A1] underline mt-2"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto pb-20">
      <AnimatePresence mode="wait">
        <motion.div
          key="step2"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="space-y-6"
        >
          <PageHeader title="선매입 신청" description={`현재 시세 ${RATE_PERCENT}% 로 매입하고 있어요.`} />

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Voucher Type */}
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-[#8B95A1] ml-1">상품권 종류</label>
              <div className="flex gap-2">
                {[
                  { id: 'lotte_tomorrow', label: '유형 A: 익일 공급형' },
                  { id: 'lotte_custom', label: '유형 B: 예약 공급형' },
                ].map((item) => {
                  const rateValue = getReserveRate(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setVoucherType(item.id)}
                      className={cn(
                        "flex-1 h-12 rounded-[16px] font-medium text-[13px] transition-all border whitespace-nowrap flex flex-col items-center justify-center leading-none gap-1",
                        voucherType === item.id
                          ? "bg-[#E8F3FF] border-[#0064FF] text-[#0064FF]"
                          : "bg-white border-transparent text-[#4E5968] hover:bg-gray-50"
                      )}
                    >
                      <span>{item.label}</span>
                      <span className={cn("text-[11px]", voucherType === item.id ? "text-[#0064FF]" : "text-[#8B95A1]")}>
                        {rateValue}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* User Inputs */}
            <Card className="space-y-4">
              <div className="flex gap-2">
                <div className="w-[30%]">
                  <Input
                    placeholder="은행명"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    placeholder="계좌번호"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                  />
                </div>
              </div>
              <Input
                placeholder="이름"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <PhoneVerificationInput
                value={contact}
                onChange={setContact}
                onVerifiedChange={setIsPhoneVerified}
                onBeforeSend={async () => {
                  if (!contact || contact.length < 10) return false;
                  try {
                    const orders = await db.getUserOrders(contact);
                    const duplicate = orders.find(o =>
                      (o.status === '주문 확인중' || o.status === '예약일정 대기중') &&
                      o.type === 'reserve'
                    );
                    if (duplicate) {
                      alert(`이미 진행 중인 주문건이 있습니다.\n(주문번호: #${duplicate.id.slice(0, 8)})`);
                      return false;
                    }
                    return true;
                  } catch (e) {
                    console.error(e);
                    return true;
                  }
                }}
              />
              {/* 확인 코드 */}
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-[#8B95A1] ml-1">확인 코드</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="확인 코드 6자리 입력"
                    value={verifyCode}
                    onChange={(e) => { setVerifyCode(e.target.value); setIsCodeVerified(false); }}
                    disabled={isCodeVerified}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyCode}
                    disabled={isCodeVerified || verifyCode.length === 0}
                    className={cn(
                      "px-4 py-2 rounded-[16px] text-sm font-bold whitespace-nowrap transition-colors",
                      isCodeVerified
                        ? "bg-green-100 text-green-600"
                        : "bg-[#0064FF] text-white hover:bg-[#0050CC] disabled:opacity-50"
                    )}
                  >
                    {isCodeVerified ? "인증완료" : "확인"}
                  </button>
                </div>
                {isCodeVerified && (
                  <p className="text-[12px] text-green-600 ml-1">✓ 확인 코드가 인증되었습니다.</p>
                )}
              </div>
              <label className="text-[13px] font-semibold text-[#8B95A1] ml-1">확인코드 확인을 위해 메인화면 연락처를 통해 문의주세요</label>
            </Card>

            {/* Amount Selection */}
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-[#8B95A1] ml-1">판매금액(액면가)</label>
              <select
                className="w-full h-12 px-4 rounded-[16px] bg-white border border-gray-200 text-[#191F28] font-medium text-[17px] focus:border-[#0064FF] outline-none appearance-none"
                onChange={(e) => setAmount(Number(e.target.value))}
                defaultValue=""
              >
                <option value="" disabled>금액을 선택해주세요</option>
                {[20, 30, 40, 50, 60, 70, 80, 90, 100].map(val => (
                  <option key={val} value={val * 10000}>{val}만원</option>
                ))}
              </select>
              <p className="text-[13px] text-[#8B95A1] pl-1">* 거래 특성상 매입이 거절 될 수 있습니다.</p>
            </div>

            {/* Calculator Result */}
            {amount && (
              <div className="bg-[#F2F4F6] rounded-[20px] p-5 space-y-3 animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-center text-[15px]">
                  <span className="text-[#4E5968]">물품대금지급 ({RATE_PERCENT}%)</span>
                  <span className="font-bold text-[#0064FF]">{deposit.toLocaleString()}원</span>
                </div>
              </div>
            )}

            {/* Date Selection (Admin Controlled) */}
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-[#8B95A1] ml-1">예약 가능 일자</label>
              <button
                type="button"
                className="w-full p-5 rounded-[20px] bg-[#E8F3FF] border border-[#0064FF] text-[#0064FF] font-bold text-lg shadow-sm flex items-center justify-center gap-2 hover:bg-[#DBE9FF] transition-colors"
              >
                {availableDate} 만 가능해요
              </button>
            </div>

            {/* Final Agreements */}
            <Card className="bg-[#F9FAFB] border-none p-6 rounded-[24px] space-y-4">
              <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 mb-4">
                <p className="text-xs text-orange-600 font-bold break-keep">
                  ⚠ 유의사항: 아래 동의 약관 내용을 반드시 꼼꼼히 읽어보신 후 체크하여 주시기 바랍니다.
                </p>
              </div>

              {terms?.reserve?.items && terms.reserve.items.length > 0 ? (
                terms.reserve.items.map((item, index) => (
                  <AgreementItem
                    key={item.id}
                    title={`[${item.required ? '필수' : '선택'}] ${item.title}`}
                    checked={checkedTerms[item.id]?.checked || false}
                    onChange={(checked) => toggleTerm(item.id, checked)}
                    content={item.content}
                    defaultOpen={index === 0}
                  />
                ))
              ) : (
                <>
                  <AgreementItem
                    title={terms?.reserve?.responsibilityTitle || "민형사상 책임 및 거래 약관 동의"}
                    checked={agreedFinal}
                    onChange={setAgreedFinal}
                    content={terms?.reserve?.responsibility}
                  />
                  <AgreementItem
                    title={terms?.reserve?.privacyTitle || "개인정보 수집 및 이용 동의"}
                    checked={agreedPrivacy}
                    onChange={setAgreedPrivacy}
                    content={terms?.reserve?.privacy}
                  />
                </>
              )}
            </Card>

            <div className="flex gap-3">
              <Button fullWidth type="submit" disabled={!areAllTermsChecked() || isSubmitting || !amount || !isCodeVerified}>
                {isSubmitting ? "처리 중..." : "계약서 서명 후 신청하기"}
              </Button>
            </div>
          </form>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
