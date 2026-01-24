import React, { useState } from 'react';
import { Card, Button, Input } from './ui/TossComponents';
import { ArrowLeft, MessageCircle, RefreshCw, CheckCircle2, Clock, XCircle, ChevronRight, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useUserOrders } from '@/lib/useMockData';
import { db } from '@/lib/supabase';

interface UserOrderHistoryProps {
  onBack: () => void;
}

export const UserOrderHistory = ({ onBack }: UserOrderHistoryProps) => {
  const [phone, setPhone] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const { orders, updateOrder } = useUserOrders(verifiedPhone);

  const [step, setStep] = useState<'input' | 'verify' | 'list'>('input');
  const [code, setCode] = useState('');
  const [offsetStates, setOffsetStates] = useState<Record<string, boolean>>({});
  const [filesMap, setFilesMap] = useState<Record<string, File[]>>({});
  const [submittedStates, setSubmittedStates] = useState<Record<string, boolean>>({});
  const [isSubmittingMap, setIsSubmittingMap] = useState<Record<string, boolean>>({});

  const handleSendCode = () => {
    if (phone.length < 10) {
      toast.error('올바른 휴대폰 번호를 입력해주세요.');
      return;
    }
    toast.success('인증번호가 발송되었습니다. (1234)');
    setStep('verify');
  };

  const handleVerify = () => {
    if (code === '1234') {
      toast.success('인증되었습니다.');
      setVerifiedPhone(phone);
      setStep('list');
    } else {
      toast.error('인증번호가 올바르지 않습니다.');
    }
  };

  const handleAddFiles = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFilesMap(prev => ({
        ...prev,
        [id]: [...(prev[id] || []), ...newFiles]
      }));
      toast.success('파일이 추가되었습니다.');
    }
  };

  const removeFile = (id: string, index: number) => {
    setFilesMap(prev => ({
      ...prev,
      [id]: prev[id].filter((_, i) => i !== index)
    }));
  };

  const handleSend = async (id: string) => {
    if (isSubmittingMap[id]) return;

    if (window.confirm("전송 후에는 수정할 수 없습니다.\n전송하시겠습니까?")) {
      setIsSubmittingMap(prev => ({ ...prev, [id]: true }));
      try {
        const files = filesMap[id] || [];
        const uploadedUrls = await Promise.all(
          files.map(file => db.uploadImage(file))
        );

        await updateOrder(id, {
          voucher_images: uploadedUrls
        });

        setSubmittedStates(prev => ({ ...prev, [id]: true }));
        toast.success("상품권이 전송되었습니다. 관리자가 확인 후 처리됩니다.");
      } catch (error) {
        console.error("Upload error", error);
        toast.error("전송 중 오류가 발생했습니다.");
      } finally {
        setIsSubmittingMap(prev => ({ ...prev, [id]: false }));
      }
    }
  };

  const toggleOffset = (id: string) => {
    setOffsetStates(prev => {
      const newState = { ...prev, [id]: !prev[id] };
      toast.success(newState[id] ? '상계 요청이 선택되었습니다.' : '상계 요청이 취소되었습니다.');
      return newState;
    });
  };

  const calculateOffsetAmount = (amount: number, rate: number = 80) => {
    return Math.floor(amount * (1.5 - (rate / 100)));
  };

  if (step !== 'list') {
    return (
      <div className="space-y-6">
        <header className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="p-1 -ml-1">
            <ArrowLeft size={24} className="text-[#191F28]" />
          </button>
          <h1 className="text-xl font-bold text-[#191F28]">주문 내역 조회</h1>
        </header>

        <Card className="p-6 bg-white border-none shadow-sm space-y-6">
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3 text-[#0064FF]">
              <MessageCircle size={24} />
            </div>
            <h2 className="text-lg font-bold text-[#191F28] mb-1">
              {step === 'input' ? '휴대폰 번호를 입력해주세요' : '인증번호를 입력해주세요'}
            </h2>
            <p className="text-[#8B95A1] text-sm">
              {step === 'input' ? '주문 시 입력한 번호로 조회합니다.' : `문자로 발송된 인증번호 4자리를 입력해주세요.`}
            </p>
          </div>

          <div className="space-y-4">
            {step === 'input' ? (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#8B95A1] ml-1">휴대폰 번호</label>
                  <Input
                    placeholder="01012345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    maxLength={11}
                  />
                </div>
                <Button className="w-full py-4 text-[16px]" onClick={handleSendCode}>
                  인증번호 받기
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#8B95A1] ml-1">인증번호</label>
                  <Input
                    placeholder="1234"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                    maxLength={4}
                  />
                </div>
                <Button className="w-full py-4 text-[16px]" onClick={handleVerify}>
                  인증하기
                </Button>
                <button
                  onClick={() => setStep('input')}
                  className="w-full text-center text-sm text-[#8B95A1] underline mt-2"
                >
                  번호 다시 입력하기
                </button>
              </>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center gap-3">
        <button onClick={onBack} className="p-1 -ml-1">
          <ArrowLeft size={24} className="text-[#191F28]" />
        </button>
        <h1 className="text-xl font-bold text-[#191F28]">나의 주문 내역</h1>
      </header>

      <div className="space-y-4">
        {orders.map((order) => {
          const isSubmitted = submittedStates[order.id];
          const displayStatus = isSubmitted ? '주문 확인중' : order.status;

          // Determine display date
          const displayDate = order.type === 'reserve' && order.expected_date
            ? order.expected_date
            : new Date(order.created_at).toISOString().split('T')[0];

          return (
            <Card key={order.id} className="p-5 bg-white border-none shadow-sm active:scale-[0.98] transition-transform">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${order.type === 'reserve' ? 'bg-blue-50 text-blue-600' : 'bg-yellow-50 text-yellow-600'
                    }`}>
                    {order.type === 'reserve' ? '예약판매' : '즉시판매'}
                  </span>
                  <span className="text-xs text-[#8B95A1]">{displayDate}</span>
                </div>
                <ChevronRight size={18} className="text-[#D1D6DB]" />
              </div>

              <div className="flex justify-between items-center mb-1">
                <h3 className="font-bold text-[#191F28] text-[16px]">{order.name}</h3>
              </div>

              <div className="flex justify-between items-end">
                <div>
                  <div className="text-sm text-[#4E5968] mb-0.5">매입가 {order.rate}%</div>
                  <div className="text-lg font-bold text-[#191F28]">{order.amount.toLocaleString()}원</div>
                </div>
                <div className={`px-2.5 py-1 rounded-full text-xs font-bold ${displayStatus === '완료' ? 'bg-green-50 text-green-600' :
                  displayStatus === '반려' ? 'bg-red-50 text-red-600' :
                    (displayStatus === '예약일정 대기중' || displayStatus === '주문 확인중') ? 'bg-blue-50 text-blue-600' :
                      'bg-gray-100 text-gray-600'
                  }`}>
                  {displayStatus}
                </div>
              </div>

              {order.type === 'reserve' && order.status === '예약일정 대기중' && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                  {!isSubmitted && (
                    <div className="flex justify-end h-8">
                      {!offsetStates[order.id] && !order.is_offset && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm("상계요청 시 되돌릴 수 없습니다.\n그래도 진행하시겠습니까?")) {
                              toggleOffset(order.id);
                            }
                          }}
                          className="text-[11px] font-bold px-2 py-1 rounded border transition-colors bg-gray-50 text-[#4E5968] border-gray-200 hover:bg-gray-100"
                        >
                          상계요청
                        </button>
                      )}
                    </div>
                  )}

                  <div className={cn(
                    "bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-4",
                    isSubmitted && "bg-gray-50 border-gray-200"
                  )}>
                    <div className={cn(
                      "flex flex-col text-sm font-medium",
                      isSubmitted ? "text-gray-600" : "text-blue-700"
                    )}>
                      <span className={cn(
                        "text-[11px] mb-0.5 font-bold",
                        isSubmitted ? "text-gray-500" : "text-blue-500"
                      )}>
                        예약일 도래 ({displayDate})
                      </span>
                      {isSubmitted ? (
                        "상품권 전송이 완료되었습니다."
                      ) : (offsetStates[order.id] || order.is_offset)
                        ? `상계 처리된 ${calculateOffsetAmount(order.amount, order.rate).toLocaleString()}원의 상품권을 첨부해주세요`
                        : `매입가만큼 ${order.amount.toLocaleString()}원의 상품권을 첨부해주세요`
                      }
                    </div>

                    {filesMap[order.id]?.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {filesMap[order.id].map((file, idx) => (
                          <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-blue-200 bg-white">
                            <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="attachment" />
                            {!isSubmitted && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFile(order.id, idx);
                                }}
                                className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 hover:bg-black/70 transition-colors"
                              >
                                <X size={10} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {!isSubmitted ? (
                      <div className="flex gap-2">
                        <label
                          className="flex-1 bg-white border border-blue-200 text-blue-600 text-xs font-bold py-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer hover:bg-blue-50 transition-colors shadow-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Upload size={14} />
                          {filesMap[order.id]?.length > 0 ? '추가 첨부' : '파일 첨부'}
                          <input
                            type="file"
                            className="hidden"
                            multiple
                            accept="image/*"
                            onChange={(e) => handleAddFiles(order.id, e)}
                          />
                        </label>

                        {filesMap[order.id]?.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSend(order.id);
                            }}
                            disabled={isSubmittingMap[order.id]}
                            className="flex-1 bg-[#0064FF] text-white text-xs font-bold py-3 rounded-lg hover:bg-[#0050CC] transition-colors shadow-sm disabled:opacity-50"
                          >
                            {isSubmittingMap[order.id] ? '전송중...' : '전송하기'}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="w-full bg-gray-200 text-gray-500 text-xs font-bold py-3 rounded-lg flex items-center justify-center">
                        전송 완료
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })}

        <div className="text-center py-6">
          <p className="text-[#8B95A1] text-sm">최근 3개월 내역만 조회됩니다.</p>
        </div>
      </div>
    </div>
  );
};
