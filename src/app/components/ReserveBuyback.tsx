import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PageHeader, Input, Button, Card } from './ui/TossComponents';
import { PhoneVerificationInput } from './ui/PhoneVerificationInput';
import { AgreementItem } from './ui/AgreementItem';
import { X } from 'lucide-react';
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

  // eSignon 서명 모달 State
  const [signUrl, setSignUrl] = useState<string | null>(null);
  const [showSignModal, setShowSignModal] = useState(false);

  // 서명 완료 콜백을 위한 ref (최신 order data snapshot 유지)
  const pendingOrderRef = useRef<any>(null);

  // Dynamic Terms State
  const [checkedTerms, setCheckedTerms] = useState<Record<string, { checked: boolean; agreedAt: string }>>({});

  const toggleTerm = (id: string, checked: boolean) => {
    setCheckedTerms(prev => ({
      ...prev,
      [id]: {
        checked,
        agreedAt: checked ? new Date().toISOString() : (prev[id]?.agreedAt || new Date().toISOString())
      }
    }));
  };

  const areAllTermsChecked = () => {
    if (terms?.reserve?.items && terms.reserve.items.length > 0) {
      return terms.reserve.items.every(item => !item.required || checkedTerms[item.id]?.checked);
    }
    return agreedFinal && agreedPrivacy;
  };

  // Constants & Calculations
  const getRateName = (type: string) => {
    if (type.includes('lotte')) return '롯데';
    return '';
  };

  const rateObj = rates.find(r => r.type === 'reserve' && r.name.includes(getRateName(voucherType)));
  const defaultRate = 0.8;
  const RATE = rateObj ? rateObj.rate / 100 : defaultRate;
  const RATE_PERCENT = rateObj ? rateObj.rate : (defaultRate * 100);

  const faceValue = amount || 0;
  const deposit = Math.round(faceValue * RATE);

  // eSignon 서명 완료 콜백 리스너
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // eSignon은 서명 완료 시 message를 보냄
      console.log('[eSignon callback]', event.data);
      // eSignon callback은 다양한 형태로 올 수 있음: 문자열 또는 객체
      const data = event.data;
      const isSignComplete =
        data === 'esignon_sign_complete' ||
        (typeof data === 'object' && data?.type === 'sign_complete') ||
        (typeof data === 'string' && (data.includes('complete') || data.includes('COMPLETE') || data.includes('sign')));

      if (isSignComplete && pendingOrderRef.current) {
        setShowSignModal(false);
        await submitOrder(pendingOrderRef.current);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!amount) return toast.error("판매금액을 선택해주세요.");
    if (!name) return toast.error("성함을 입력해주세요.");
    if (!contact) return toast.error("연락처를 입력해주세요.");
    if (!isPhoneVerified) return toast.error("연락처 인증을 완료해주세요.");
    if (!bankName || !accountNumber) return toast.error("계좌 정보를 입력해주세요.");
    if (!areAllTermsChecked()) return toast.error("모든 필수 약관에 동의해주세요.");

    setIsSubmitting(true);
    try {
      // 계약서에 미리 채울 주문 정보 준비
      const orderDetails = {
        applicant_name: name,
        phone: contact,
        amount: faceValue,
        deposit: deposit,
        rate: RATE_PERCENT,
        voucherType,
      };

      // 약관 동의 목록
      const termAgreements = terms?.reserve?.items?.map(item => ({
        id: item.id,
        title: item.title,
        agreedAt: checkedTerms[item.id]?.agreedAt || new Date().toISOString()
      })).filter(t => checkedTerms[t.id]?.checked) || [];

      // 서명 완료 후 제출할 주문 데이터 저장
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

      // eSignon Edge Function 호출 → 서명 URL 획득
      const { data, error } = await supabase.functions.invoke('create-esignon-link', {
        body: { orderDetails }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.signUrl) throw new Error('서명 URL을 받지 못했습니다.');

      setSignUrl(data.signUrl);
      setShowSignModal(true);
    } catch (error: any) {
      console.error('eSignon Error:', error);
      toast.error(`계약서 생성 실패: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitOrder = async (orderData: any) => {
    setIsSubmitting(true);
    try {
      await addOrder(orderData);

      // 확인 SMS 발송
      try {
        await sendSMS(orderData.phone, `안녕하세요, 고객님. 주문이 정상적으로 접수되었습니다.\n검토 결과에 따라 매입이 반려될 수 있는 점 양해 부탁드립니다.\n진행 상황은 [주문내역] 페이지에서 실시간으로 확인하실 수 있습니다.`);
      } catch (smsError) {
        console.error('SMS 발송 실패:', smsError);
      }

      toast.success('선매입 신청이 완료되었습니다!');
      pendingOrderRef.current = null;

      if (onSuccess) {
        onSuccess();
      } else {
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Order error:', error);
      toast.error("주문 처리 중 오류가 발생했습니다.");
      setIsSubmitting(false);
    }
  };

  // 서명 완료 버튼 (수동 완료 처리 - iframe 환경에 따라 callback이 안 오는 경우 대비)
  const handleManualComplete = async () => {
    if (!pendingOrderRef.current) return;
    setShowSignModal(false);
    await submitOrder(pendingOrderRef.current);
  };

  return (
    <div className="max-w-md mx-auto pb-20">
      {/* eSignon 서명 모달 */}
      {showSignModal && signUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col" style={{ height: '90vh' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-[#191F28]">선매입 계약서 서명</h2>
              <button
                onClick={() => setShowSignModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              <iframe
                src={signUrl}
                className="w-full h-full border-none"
                title="선매입 계약서 전자서명"
                allow="camera; microphone"
              />
            </div>

            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <p className="text-xs text-[#8B95A1] text-center mb-3">
                위 계약서를 읽고 서명을 완료해주세요. 서명 완료 후 자동으로 처리됩니다.
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" fullWidth onClick={() => setShowSignModal(false)}>
                  취소
                </Button>
                <Button fullWidth onClick={handleManualComplete}>
                  서명 완료했습니다
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  { id: 'lotte_custom', label: '유형 B: 예약 공급형' }
                ].map((item) => {
                  const itemRateName = item.id.includes('lotte') ? '롯데' : '이마트';
                  const foundRate = rates.find(r => r.type === 'reserve' && r.name.includes(itemRateName));
                  const rateValue = foundRate ? foundRate.rate : 80;

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
              <label className="text-[13px] font-semibold text-[#8B95A1] ml-1">신청 후 메인화면 연락처를 통해 문의주세요</label>
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
              <Button fullWidth type="submit" disabled={!areAllTermsChecked() || isSubmitting || !amount}>
                {isSubmitting ? "처리 중..." : "계약서 서명 후 신청하기"}
              </Button>
            </div>
          </form>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
