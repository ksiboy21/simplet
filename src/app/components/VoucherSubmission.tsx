import React, { useState } from 'react';
import { motion } from 'motion/react';
import { PageHeader, Input, Button, Card, Checkbox } from './ui/TossComponents';
import { PhoneVerificationInput } from './ui/PhoneVerificationInput';
import { AgreementItem } from './ui/AgreementItem';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTerms, useUserOrders } from '@/lib/useMockData';
import { db } from '@/lib/supabase';

interface VoucherSubmissionProps {
  onSuccess?: () => void;
}

export const VoucherSubmission = ({ onSuccess }: VoucherSubmissionProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [voucherType, setVoucherType] = useState('shinsegae');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [applicantName, setApplicantName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data Hooks
  const { terms } = useTerms();
  const { addOrder } = useUserOrders();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files || [])]);
    }
  };

  const getVoucherName = (typeKey: string) => {
    const map: Record<string, string> = {
      'shinsegae': '신세계 지류',
      'shinsegae_mobile': '신세계 모바일',
      'lotte': '롯데 모바일'
    };
    return map[typeKey] || '상품권';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!agreed || !agreedPrivacy) return toast.error("모든 약관��� 동의해주세요.");
    if (!isPhoneVerified) return toast.error("연락처 인증을 완료해주세요.");
    if (files.length === 0) return toast.error("상품권을 업로드해주세요.");

    if (!applicantName) return toast.error("신청자 성함을 입력해주세요.");

    setIsSubmitting(true);
    try {
      const uploadedUrls = await Promise.all(
        files.map(file => db.uploadImage(file))
      );

      await addOrder({
        name: getVoucherName(voucherType),
        status: '주문 확인중',
        phone: phoneNumber,
        applicant_name: applicantName,
        bank_name: bankName,
        account_number: accountNumber,
        type: 'submission',
        amount: 0,
        rate: 0,
        voucher_images: uploadedUrls,
        is_my_order: true,
      });

      if (onSuccess) {
        onSuccess();
      } else {
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Submission error:', error);
      toast.error("상품권 전송 중 오류가 발생했습니다.");
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
        title="상품권 보내기"
        description="약속한 상품권을 보내주세요."
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Voucher Type Selection */}
        <div className="space-y-2">
          <label className="text-[13px] font-semibold text-[#8B95A1] ml-1">상품권 종류</label>
          <div className="flex gap-2">
            {[
              { id: 'shinsegae', label: '신세계 지류' },
              { id: 'shinsegae_mobile', label: '신세계 모바일' },
              { id: 'lotte', label: '롯데 모바일' }
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setVoucherType(item.id)}
                className={cn(
                  "flex-1 h-12 rounded-[16px] font-medium text-[13px] transition-all border whitespace-nowrap",
                  voucherType === item.id
                    ? "bg-[#E8F3FF] border-[#0064FF] text-[#0064FF]"
                    : "bg-white border-transparent text-[#4E5968] hover:bg-gray-50"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <Card className="space-y-4">
          <Input
            placeholder="신청자 성함"
            value={applicantName}
            onChange={(e) => setApplicantName(e.target.value)}
          />
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
          <PhoneVerificationInput
            value={phoneNumber}
            onChange={setPhoneNumber}
            onVerifiedChange={setIsPhoneVerified}
          />
        </Card>

        <div className="space-y-2">
          <label className="text-[13px] font-semibold text-[#8B95A1] ml-1">상품권 이미지 <span className="text-[11px] font-normal">(복수 선택 가능)</span></label>
          <div className="flex flex-wrap gap-2">
            {files.map((file, i) => (
              <div key={i} className="relative w-20 h-20 rounded-[16px] overflow-hidden border border-gray-200">
                <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
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

        <Card className="bg-[#F9FAFB] border-none p-5 space-y-4">
          <AgreementItem
            title="민형사상 책임 및 거래 약관 동의"
            checked={agreed}
            onChange={setAgreed}
            content={terms?.submission?.responsibility}
          />
          <AgreementItem
            title="개인정보 수집 및 이용 동의"
            checked={agreedPrivacy}
            onChange={setAgreedPrivacy}
            content={terms?.submission?.privacy}
          />
        </Card>

        <Button fullWidth size="lg" type="submit" disabled={!agreed || !agreedPrivacy || isSubmitting}>
          {isSubmitting ? "처리 중..." : "상품권 전송하기"}
        </Button>
      </form>
    </motion.div>
  );
};
