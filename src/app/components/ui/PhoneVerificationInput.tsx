import React, { useState } from 'react';
import { Input, Button } from './TossComponents';
import { toast } from 'sonner';

interface PhoneVerificationInputProps {
  value: string;
  onChange: (value: string) => void;
  onVerifiedChange: (isVerified: boolean) => void;
  label?: string;
}

export const PhoneVerificationInput = ({ value, onChange, onVerifiedChange, label }: PhoneVerificationInputProps) => {
  const [isSent, setIsSent] = useState(false);
  const [code, setCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  const handleSend = () => {
    if (!value || value.length < 10) return toast.error("올바른 연락처를 입력해주세요.");
    
    // Simulate sending logic
    setIsSent(true);
    // In a real app, generate random code. Here simple "123456" or random
    const mockCode = "123456"; 
    setCode(mockCode);
    
    // Reset verification if re-sending (though usually re-sending keeps state until verified)
    setIsVerified(false);
    onVerifiedChange(false);
    setInputCode('');
    
    toast.success(`인증번호가 발송되었습니다. (테스트: ${mockCode})`);
  };

  const handleVerify = () => {
    if (inputCode === code) {
      setIsVerified(true);
      onVerifiedChange(true);
      toast.success("인증이 완료되었습니다.");
    } else {
      toast.error("인증번호가 일치하지 않습니다.");
    }
  };

  return (
    <div className="space-y-2">
      {label && <label className="text-[13px] font-semibold text-[#8B95A1] ml-1">{label}</label>}
      <div className="flex gap-2">
        <div className="flex-1">
          <Input 
            placeholder="연락처" 
            type="tel" 
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={isVerified}
            className={isVerified ? "bg-gray-50 text-gray-500" : ""}
          />
        </div>
        <Button 
          type="button" 
          variant={isVerified ? "secondary" : "primary"} 
          className={`shrink-0 h-[52px] px-4 whitespace-nowrap min-w-[96px] ${isVerified ? "bg-gray-100 text-gray-400" : ""}`}
          onClick={handleSend}
          disabled={isVerified || !value}
        >
          {isVerified ? "완료" : (isSent ? "재전송" : "인증요청")}
        </Button>
      </div>
      
      {isSent && !isVerified && (
        <div className="flex gap-2 animate-in fade-in slide-in-from-top-1">
          <div className="flex-1">
            <Input 
              placeholder="인증번호 6자리" 
              type="text" 
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
            />
          </div>
          <Button 
            type="button" 
            variant="secondary"
            className="w-24 shrink-0 h-[52px]"
            onClick={handleVerify}
          >
            확인
          </Button>
        </div>
      )}
    </div>
  );
};
