import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PageHeader, Input, Button, Card } from './ui/TossComponents';
import { PhoneVerificationInput } from './ui/PhoneVerificationInput';
import { AgreementItem } from './ui/AgreementItem';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useRates, useTerms, useUserOrders } from '@/lib/useMockData';
import { db } from '@/lib/supabase';
import { sendSMS } from '@/lib/solapi';

interface ReserveBuybackProps {
  availableDate: string; // YYYY-MM-DD from Admin
  onSuccess?: () => void;
}

export const ReserveBuyback = ({ availableDate, onSuccess }: ReserveBuybackProps) => {
  const [voucherType, setVoucherType] = useState('lotte');
  const [amount, setAmount] = useState<number | null>(null);

  // Data Hooks
  const { rates } = useRates();
  const { terms } = useTerms();
  const { addOrder } = useUserOrders();

  // Step 2 State - Form
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [idCardFiles, setIdCardFiles] = useState<File[]>([]);
  const [bankFiles, setBankFiles] = useState<File[]>([]);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  // Agreements
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [agreedFinal, setAgreedFinal] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic Terms State
  const [checkedTerms, setCheckedTerms] = useState<Record<string, { checked: boolean; agreedAt: string }>>({});

  const toggleTerm = (id: string, checked: boolean) => {
    setCheckedTerms(prev => ({
      ...prev,
      [id]: {
        checked,
        // If checking, record current time. If unchecking, keep old time or reset? Better to reset or update.
        // Requirement: "Show time of LAST agreement".
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
  // Find rate based on selected type
  const getRateName = (type: string) => {
    if (type === 'lotte') return '롯데';
    if (type === 'shinsegae_emart') return '이마트'; // or check specific name in DB
    return '';
  };

  const rateObj = rates.find(r => r.type === 'reserve' && r.name.includes(getRateName(voucherType)));
  // Default rates if DB fetch fails or not found
  const defaultRate = voucherType === 'lotte' ? 0.8 : 0.8;
  const RATE = rateObj ? rateObj.rate / 100 : defaultRate;
  const RATE_PERCENT = rateObj ? rateObj.rate : (defaultRate * 100);

  const faceValue = amount || 0;
  const deposit = faceValue * RATE;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setFiles: React.Dispatch<React.SetStateAction<File[]>>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files || [])]);
    }
  };

  const removeFile = (index: number, files: File[], setFiles: React.Dispatch<React.SetStateAction<File[]>>) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!amount) return toast.error("판매금액을 선택해주세요.");
    if (!name) return toast.error("성함을 입력해주세요.");
    if (!contact) return toast.error("연락처를 입력해주세요.");
    if (!email) return toast.error("이메일을 입력해주세요.");
    if (!isPhoneVerified) return toast.error("연락처 인증을 완료해주세요.");
    //if (idCardFiles.length === 0) return toast.error("신분증을 첨부해주세요.");
    //if (bankFiles.length === 0) return toast.error("통장사본을 첨부해주세요.");
    //if (!bankName || !accountNumber) return toast.error("계좌 정보를 입력해주세요.");


    if (!areAllTermsChecked()) return toast.error("모든 필수 약관에 동의해주세요.");

    setIsSubmitting(true);
    try {
      const idCardUrl = idCardFiles.length > 0 ? await db.uploadImage(idCardFiles[0]) : '';
      const bankBookUrl = bankFiles.length > 0 ? await db.uploadImage(bankFiles[0]) : '';

      // Construct term agreements
      const termAgreements = terms?.reserve?.items?.map(item => ({
        id: item.id,
        title: item.title,
        agreedAt: checkedTerms[item.id]?.agreedAt || new Date().toISOString()
      })).filter(t => checkedTerms[t.id]?.checked) || [];

      await addOrder({
        name: voucherType === 'lotte' ? '롯데 모바일' : '신세계 이마트전용',
        amount: faceValue,
        deposit: deposit,
        expected_date: availableDate,
        status: '주문 확인중',
        phone: contact,
        applicant_name: name,
        bank_name: bankName,
        account_number: accountNumber,
        email: email,
        type: 'reserve',
        rate: RATE_PERCENT,
        id_card_image: idCardUrl,
        bank_book_image: bankBookUrl,
        is_my_order: true,
        term_agreements: termAgreements
      });

      // Send Confirmation SMS
      try {
        await sendSMS(contact, `안녕하세요, 고객님.주문이 정상적으로 접수되었습니다.
검토 결과에 따라 매입이 반려될 수 있는 점 양해 부탁드립니다.
진행 상황은[주문내역] 페이지에서 실시간으로 확인하실 수 있습니다.`);
      } catch (smsError) {
        console.error('Failed to send confirmation SMS:', smsError);
        // Continue flow even if SMS fails
      }

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
          <PageHeader title="예약판매 신청" description={`현재 시세 ${RATE_PERCENT}% 로 매입하고 있어요.`} />

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Voucher Type */}
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-[#8B95A1] ml-1">상품권 종류</label>
              <div className="flex gap-2">
                {[
                  { id: 'lotte', label: '롯데 모바일' },
                  { id: 'shinsegae_emart', label: '신세계 이마트전용' }
                ].map((item) => {
                  // Calculate rate for this item
                  const itemRateName = item.id === 'lotte' ? '롯데' : '이마트';
                  // Fallback to default if not found in rates array
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
              <Input
                label="성함"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="성함을 입력해주세요"
              />
              {/*
              <div className="flex gap-2">
                <div className="w-[30%]">
                  <Input
                    label="은행명"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="은행"
                  />
                </div>
                <div className="flex-1">
                  <Input
                    label="계좌번호"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="계좌번호를 입력해주세요"
                  />
                </div>
              </div>
              */}
              <PhoneVerificationInput
                label="연락처"
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
              <label className="text-[13px] font-semibold text-[#8B95A1] ml-1">신청 후 메인화면 카카오톡을 통해 문의주세요</label>
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

            {/* Uploads */}
            <Card className="space-y-4">
              <Input
                label="이메일(전자계약서 수신용)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@toss.im"
                type="email"
                className="bg-white text-black"
              />
               {/*
              <div className="flex gap-3">
                <div className="flex-1 min-w-0 space-y-2">
                  <label className="text-[13px] font-semibold text-[#8B95A1] ml-1">신분증 이미지</label>
                  <div className="flex flex-col">
                    {idCardFiles.length > 0 ? (
                      idCardFiles.map((file, i) => (
                        <div key={i} className="relative w-full aspect-[1.6] rounded-[16px] overflow-hidden border border-gray-200">
                          <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeFile(i, idCardFiles, setIdCardFiles)}
                            className="absolute top-1.5 right-1.5 bg-black/50 text-white rounded-full p-1 transition-colors hover:bg-black/70"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <label className="w-full aspect-[1.6] rounded-[16px] bg-[#F9FAFB] border border-dashed border-[#B0B8C1] flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors text-[#B0B8C1] p-2 text-center">
                        <Plus size={24} />
                        <span className="text-[11px] mt-1 break-keep">주민번호 뒷자리<br />마스킹 필수</span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, setIdCardFiles)} />
                      </label>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  <label className="text-[13px] font-semibold text-[#8B95A1] ml-1">통장사본 이미지</label>
                  <div className="flex flex-col">
                    {bankFiles.length > 0 ? (
                      bankFiles.map((file, i) => (
                        <div key={i} className="relative w-full aspect-[1.6] rounded-[16px] overflow-hidden border border-gray-200">
                          <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeFile(i, bankFiles, setBankFiles)}
                            className="absolute top-1.5 right-1.5 bg-black/50 text-white rounded-full p-1 transition-colors hover:bg-black/70"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <label className="w-full aspect-[1.6] rounded-[16px] bg-[#F9FAFB] border border-dashed border-[#B0B8C1] flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors text-[#B0B8C1] p-2 text-center">
                        <Plus size={24} />
                        <span className="text-[11px] mt-1 break-keep">본인 명의 계좌만<br />가능</span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, setBankFiles)} />
                      </label>
                    )}
                  </div>
                </div>
              </div>
              */}
            </Card>

            {/* Final Agreements */}
            <Card className="bg-[#F9FAFB] border-none p-6 rounded-[24px] space-y-4">
              <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 mb-4">
                <p className="text-xs text-orange-600 font-bold break-keep">
                  ⚠ 유의사항: 아래 동의 약관 내용을 반드시 꼼꼼히 읽어보신 후 체크하여 주시기 바랍니다.
                </p>
              </div>

              {terms?.reserve?.items && terms.reserve.items.length > 0 ? (
                terms.reserve.items.map((item) => (
                  <AgreementItem
                    key={item.id}
                    title={`[${item.required ? '필수' : '선택'}] ${item.title}`}
                    checked={checkedTerms[item.id]?.checked || false}
                    onChange={(checked) => toggleTerm(item.id, checked)}
                    content={item.content}
                  />
                ))
              ) : (
                // Fallback
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
                {isSubmitting ? "처리 중..." : "예약 신청하기"}
              </Button>
            </div>
          </form>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
