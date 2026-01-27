import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Plus } from 'lucide-react';
import { PageHeader, Input, Button, Card } from './ui/TossComponents';
import { PhoneVerificationInput } from './ui/PhoneVerificationInput';
import { AgreementItem } from './ui/AgreementItem';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useRates, useTerms, useUserOrders } from '@/lib/useMockData';
import { db } from '@/lib/supabase';
import { sendSMS } from '@/lib/solapi';

interface QuickBuybackProps {
  onSuccess?: () => void;
}

export const QuickBuyback = ({ onSuccess }: QuickBuybackProps) => {
  const [voucherType, setVoucherType] = useState<'shinsegae' | 'shinsegae_mobile' | 'lotte'>('shinsegae');
  const [files, setFiles] = useState<File[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);

  // New States
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [applicantName, setApplicantName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data Hooks
  const { rates } = useRates();
  const { terms } = useTerms();
  const { addOrder } = useUserOrders();

  const getRate = (typeKey: string) => {
    // ... same as before
    const map: Record<string, string> = {
      'shinsegae': '신세계 지류',
      'shinsegae_mobile': '신세계 모바일',
      'lotte': '롯데 모바일'
    };
    const namePart = map[typeKey];
    if (!namePart) return 0;
    const r = rates.find((item: { type: string; name: string; rate: number }) => item.type === 'instant' && item.name.includes(namePart));
    return r ? r.rate : 0;
  };

  const getVoucherName = (typeKey: string) => {
    // ... same as before
    const map: Record<string, string> = {
      'shinsegae': '신세계 지류',
      'shinsegae_mobile': '신세계 모바일',
      'lotte': '롯데 모바일'
    };
    return map[typeKey] || '상품권';
  };

  const currentRate = getRate(voucherType);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files || [])]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!agreed || !agreedPrivacy) return toast.error("모든 약관에 동의해주세요.");
    if (!isPhoneVerified) return toast.error("연락처 인증을 완료해주세요.");
    if (!bankName || !accountNumber || !applicantName) return toast.error("계좌 정보를 모두 입력해주세요.");
    if (files.length === 0) return toast.error("상품권 이미지를 첨부해주세요.");

    setIsSubmitting(true);
    try {
      const uploadedUrls = await Promise.all(
        files.map(file => db.uploadImage(file))
      );

      await addOrder({
        name: getVoucherName(voucherType),
        amount: 50000,
        status: '주문 확인중',
        phone: phoneNumber,
        applicant_name: applicantName,
        bank_name: bankName,
        account_number: accountNumber,
        type: 'instant',
        rate: currentRate,
        voucher_images: uploadedUrls,
        is_my_order: true,
      });

      // Send Confirmation SMS
      try {
        await sendSMS(phoneNumber, `안녕하세요, 고객님. 주문이 정상적으로 접수되었습니다.
검토 결과에 따라 매입이 반려될 수 있는 점 양해 부탁드립니다.
진행 상황은 [주문내역] 페이지에서 실시간으로 확인하실 수 있습니다.`);
      } catch (smsError) {
        console.error('Failed to send confirmation SMS:', smsError);
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto pb-20"
    >
      <PageHeader
        title="즉시 판매하기"
        description={`현재 ${currentRate}% 시세로 즉시 매입해드려요.`}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Voucher Type */}
        <div className="space-y-2">
          {/* ... (voucher type selectors remain same, skipping some lines in replace) ... */}
          <label className="text-[13px] font-semibold text-[#8B95A1] ml-1">상품권 종류</label>
          <div className="flex gap-2">
            {[
              { id: 'shinsegae', label: '신세계 지류' },
              { id: 'shinsegae_mobile', label: '신세계 모바일' },
              { id: 'lotte', label: '롯데 모바일' }
            ].map((item) => {
              const rate = getRate(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setVoucherType(item.id as any)}
                  className={cn(
                    "flex-1 h-12 rounded-[16px] font-medium text-[13px] transition-all border whitespace-nowrap flex flex-col items-center justify-center leading-none gap-1",
                    voucherType === item.id
                      ? "bg-[#E8F3FF] border-[#0064FF] text-[#0064FF]"
                      : "bg-white border-transparent text-[#4E5968] hover:bg-gray-50"
                  )}
                >
                  <span>{item.label}</span>
                  <span className={cn("text-[11px]", voucherType === item.id ? "text-[#0064FF]" : "text-[#8B95A1]")}>
                    {rate}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Input Fields */}
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
            placeholder="예금주"
            value={applicantName}
            onChange={(e) => setApplicantName(e.target.value)}
          />
          <PhoneVerificationInput
            value={phoneNumber}
            onChange={setPhoneNumber}
            onVerifiedChange={setIsPhoneVerified}
          />
        </Card>

        {/* File Upload */}
        <div className="space-y-2">
          <label className="text-[13px] font-semibold text-[#8B95A1] ml-1">상품권 이미지 <span className="text-[11px] font-normal">(복수 선택 가능)</span></label>
          <div className="flex flex-wrap gap-2">
            {files.map((file, i) => (
              <div key={i} className="relative w-20 h-20 rounded-[16px] overflow-hidden border border-gray-200">
                <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <label className="w-20 h-20 rounded-[16px] bg-[#F9FAFB] border border-dashed border-[#B0B8C1] flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors">
              <Plus className="text-[#B0B8C1]" />
              <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>
          </div>
        </div>

        {/* Legal */}
        <Card className="bg-[#F9FAFB] border-none p-5 space-y-4">
          <AgreementItem
            title={terms?.instant?.responsibilityTitle || "민형사상 책임 및 거래 약관 동의"}
            checked={agreed}
            onChange={setAgreed}
            content={terms?.instant?.responsibility}
          />
          <AgreementItem
            title={terms?.instant?.privacyTitle || "개인정보 수집 및 이용 동의"}
            checked={agreedPrivacy}
            onChange={setAgreedPrivacy}
            content={terms?.instant?.privacy}
          />
        </Card>

        <Button fullWidth size="lg" type="submit" disabled={!agreed || !agreedPrivacy || isSubmitting}>
          {isSubmitting ? "처리 중..." : "즉시판매 신청하기"}
        </Button>
      </form>
    </motion.div>
  );
};
