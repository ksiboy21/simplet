import React from 'react';
import { motion } from 'motion/react';
import { Button } from './ui/TossComponents';
import { Check } from 'lucide-react';

interface VoucherSubmissionSuccessProps {
  onHome: () => void;
  onHistory: () => void;
  title?: string;
  description?: React.ReactNode;
}

export const VoucherSubmissionSuccess = ({ 
  onHome, 
  onHistory,
  title = "판매 신청이 완료되었습니다",
  description = (
    <>
      담당자가 확인 후 입금해드릴 예정입니다.<br/>
      입금 진행상황은 신청내역에서 확인할 수 있습니다.
    </>
  )
}: VoucherSubmissionSuccessProps) => {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 pt-10"
    >
      <div className="w-24 h-24 rounded-full bg-[#E8F3FF] flex items-center justify-center mb-8 text-[#0064FF]">
        <Check size={48} strokeWidth={3} />
      </div>
      
      <h2 className="text-[26px] font-bold text-[#191F28] mb-3">
        {title}
      </h2>
      
      <div className="text-[#6B7684] text-[17px] leading-relaxed mb-12">
        {description}
      </div>
      
      <div className="w-full space-y-3">
        <Button fullWidth size="lg" onClick={onHistory}>
          신청내역 확인하기
        </Button>
        <Button fullWidth variant="ghost" size="lg" onClick={onHome} className="bg-transparent hover:bg-gray-100">
          홈으로 돌아가기
        </Button>
      </div>
    </motion.div>
  );
};
