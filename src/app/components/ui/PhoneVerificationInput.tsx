import React, { useState, useRef, useEffect } from 'react';
import { sendSMS } from '@/lib/solapi';
import { Input, Button } from './TossComponents';
import { toast } from 'sonner';

interface PhoneVerificationInputProps {
  value: string;
  onChange: (value: string) => void;
  onVerifiedChange: (isVerified: boolean) => void;
  label?: string;
  onBeforeSend?: () => Promise<boolean>;
}

export const PhoneVerificationInput = ({ value, onChange, onVerifiedChange, label, onBeforeSend }: PhoneVerificationInputProps) => {
  const [isSent, setIsSent] = useState(false);
  const [code, setCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Persist cooldown using sessionStorage
  useEffect(() => {
    const savedEnd = sessionStorage.getItem('phone_cooldown_end');
    if (savedEnd) {
      const remaining = Math.ceil((parseInt(savedEnd) - Date.now()) / 1000);
      if (remaining > 0) {
        setCooldown(remaining);
        setIsSent(true);
        startTimer();
      } else {
        sessionStorage.removeItem('phone_cooldown_end');
      }
    }

    const savedCode = sessionStorage.getItem('phone_verify_code');
    if (savedCode) {
      setCode(savedCode);
      setIsSent(true);
    }
  }, []);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          sessionStorage.removeItem('phone_cooldown_end');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSend = async () => {
    if (!value || value.length < 10) return toast.error("올바른 연락처를 입력해주세요.");

    if (onBeforeSend) {
      const canProceed = await onBeforeSend();
      if (!canProceed) return;
    }

    // Bypass for test numbers
    if (value === '01000000000') {
      setCode('123456');
      sessionStorage.setItem('phone_verify_code', '123456');
      setIsSent(true);
      setIsVerified(false);
      onVerifiedChange(false);
      setInputCode('');

      toast.success("테스트 모드: 인증번호 123456");
      return;
    }

    const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    setCode(generatedCode);
    sessionStorage.setItem('phone_verify_code', generatedCode);

    try {
      await sendSMS(value, `[SimpleTicket] 인증번호 [${generatedCode}]를 입력해주세요.`);
      setIsSent(true);
      setIsVerified(false);
      onVerifiedChange(false);
      setInputCode('');

      toast.success("인증번호가 발송되었습니다.");

      // Start cooldown with sessionStorage persistence
      const endTime = Date.now() + 60 * 1000;
      sessionStorage.setItem('phone_cooldown_end', endTime.toString());
      setCooldown(60);
      startTimer();
    } catch (error: any) {
      console.error("SMS Send Failed:", error);
      toast.error(`문자 발송 실패: ${error.message || "알 수 없는 오류"}`);
    }
  };

  const handleVerify = async () => {
    if (inputCode.trim() === code.toString()) {
      setIsVerified(true);
      onVerifiedChange(true);
      sessionStorage.removeItem('phone_verify_code');
      sessionStorage.removeItem('phone_cooldown_end');
      if (timerRef.current) clearInterval(timerRef.current);
      setCooldown(0);
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
            onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))}
            disabled={isVerified}
            className={isVerified ? "bg-gray-50 text-gray-500" : ""}
            maxLength={11}
          />
        </div>
        <Button
          type="button"
          variant={isVerified ? "secondary" : "primary"}
          className={`shrink-0 h-[52px] px-4 whitespace-nowrap min-w-[96px] ${isVerified ? "bg-gray-100 text-gray-400" : ""}`}
          onClick={handleSend}
          disabled={isVerified || !value || cooldown > 0}
        >
          {isVerified ? "완료" : (cooldown > 0 ? `${Math.floor(cooldown / 60)}:${(cooldown % 60).toString().padStart(2, '0')}` : (isSent ? "재전송" : "인증요청"))}
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
