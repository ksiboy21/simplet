import React, { useState } from 'react';
import { Card, Button, Input } from './ui/TossComponents';
import { ArrowLeft, MessageCircle, ChevronRight, Upload, X } from 'lucide-react';
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

  const [step, setStep] = useState<'input' | 'list'>('input');

  // Unused logic removed: code, cooldown, sendSMS
  const [filesMap, setFilesMap] = useState<Record<string, File[]>>({});
  const [submittedStates, setSubmittedStates] = useState<Record<string, boolean>>({});
  const [isSubmittingMap, setIsSubmittingMap] = useState<Record<string, boolean>>({});
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const handleLookup = () => {
    if (phone.length < 10) {
      toast.error('올바른 휴대폰 번호를 입력해주세요.');
      return;
    }
    setVerifiedPhone(phone);
    setStep('list');
    toast.success('주문 내역을 조회합니다.');
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
              휴대폰 번호를 입력해주세요
            </h2>
            <p className="text-[#8B95A1] text-sm">
              주문 시 입력한 번호로 조회합니다.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#8B95A1] ml-1">휴대폰 번호</label>
              <Input
                placeholder="01012345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                maxLength={11}
              />
            </div>
            <Button className="w-full py-4 text-[16px]" onClick={handleLookup}>
              조회하기
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Order Detail View
  if (selectedOrder) {
    return (
      <div className="space-y-6 pb-20">
        <header className="flex items-center gap-3">
          <button onClick={() => setSelectedOrder(null)} className="p-1 -ml-1">
            <ArrowLeft size={24} className="text-[#191F28]" />
          </button>
          <h1 className="text-xl font-bold text-[#191F28]">주문 상세 정보</h1>
        </header>

        <Card className="p-6 bg-white border-none shadow-sm space-y-8">
          {/* Header Info */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={cn(
                "text-[11px] font-bold px-1.5 py-0.5 rounded",
                selectedOrder.type === 'reserve' ? 'bg-blue-50 text-blue-600' :
                  selectedOrder.type === 'submission' ? 'bg-slate-100 text-slate-600' : 'bg-yellow-50 text-yellow-600'
              )}>
                {selectedOrder.type === 'reserve' ? '예약판매' : selectedOrder.type === 'submission' ? '상품권 보내기' : '즉시판매'}
              </span>
              <span className="text-sm text-gray-500">
                {new Date(selectedOrder.created_at).toLocaleDateString()}
              </span>
            </div>
            <h2 className="text-xl font-bold text-[#191F28] mb-1">{selectedOrder.name}</h2>
            <div className="text-sm text-gray-500">주문번호 #{selectedOrder.id.slice(0, 8)}</div>
          </div>

          {/* Basic Info */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-[#191F28] border-b border-gray-100 pb-2">기본 정보</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-[#8B95A1] block mb-1">신청자명</span>
                <span className="text-sm font-medium text-[#333D4B]">{selectedOrder.applicant_name || '-'}</span>
              </div>
              <div>
                <span className="text-xs text-[#8B95A1] block mb-1">연락처</span>
                <span className="text-sm font-medium text-[#333D4B]">{selectedOrder.phone || '-'}</span>
              </div>
              <div>
                <span className="text-xs text-[#8B95A1] block mb-1">매입가</span>
                <span className="text-sm font-medium text-[#333D4B]">{selectedOrder.rate}%</span>
              </div>
              <div>
                <span className="text-xs text-[#8B95A1] block mb-1">총 금액</span>
                <span className="text-sm font-bold text-[#0064FF]">{selectedOrder.amount.toLocaleString()}원</span>
              </div>
            </div>
          </section>

          {/* Financial Info */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-[#191F28] border-b border-gray-100 pb-2">정산 계좌 정보</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-[#8B95A1] block mb-1">은행명</span>
                <span className="text-sm font-medium text-[#333D4B]">{selectedOrder.bank_name || '-'}</span>
              </div>
              <div>
                <span className="text-xs text-[#8B95A1] block mb-1">계좌번호</span>
                <span className="text-sm font-medium text-[#333D4B]">{selectedOrder.account_number || '-'}</span>
              </div>
            </div>
          </section>

          {/* Reserve Specific Info */}
          {selectedOrder.type === 'reserve' && (
            <section className="space-y-4">
              <h3 className="text-sm font-bold text-[#191F28] border-b border-gray-100 pb-2">예약 정보</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-[#8B95A1] block mb-1">예약 희망일</span>
                  <span className="text-sm font-medium text-[#333D4B]">{selectedOrder.expected_date || '-'}</span>
                </div>
                <div>
                  <span className="text-xs text-[#8B95A1] block mb-1">선지급금</span>
                  <span className="text-sm font-bold text-[#0064FF]">{selectedOrder.deposit?.toLocaleString() || 0}원</span>
                </div>
              </div>
            </section>
          )}

          {/* Evidence Images */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-[#191F28] border-b border-gray-100 pb-2">제출된 증빙</h3>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {/* ID Card */}
                {selectedOrder.id_card_image && (
                  <div>
                    <p className="text-xs font-semibold text-[#8B95A1] mb-2">신분증 사본</p>
                    <div className="w-full aspect-[4/3] rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                      <img src={selectedOrder.id_card_image} alt="id-card" className="w-full h-full object-contain" />
                    </div>
                  </div>
                )}

                {/* Bank Book */}
                {selectedOrder.bank_book_image && (
                  <div>
                    <p className="text-xs font-semibold text-[#8B95A1] mb-2">통장 사본</p>
                    <div className="w-full aspect-[4/3] rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                      <img src={selectedOrder.bank_book_image} alt="bank-book" className="w-full h-full object-contain" />
                    </div>
                  </div>
                )}
              </div>

              {/* Voucher Images */}
              <div>
                <p className="text-xs font-semibold text-[#8B95A1] mb-2">상품권 이미지</p>
                {selectedOrder.voucher_images && selectedOrder.voucher_images.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {selectedOrder.voucher_images.map((img: string, idx: number) => (
                      <div key={idx} className="w-24 h-24 shrink-0 rounded-lg overflow-hidden border border-gray-200">
                        <img src={img} alt={`voucher-${idx}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="w-full h-20 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-center text-xs text-gray-400">
                    등록된 상품권 이미지가 없습니다
                  </div>
                )}
              </div>
            </div>
          </section>
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

          // Determine display date and check if arrived
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          let isReservationArrived = false;
          let displayDate = new Date(order.created_at).toISOString().split('T')[0];

          if (order.type === 'reserve' && order.expected_date) {
            displayDate = order.expected_date;
            const [y, m, d] = order.expected_date.split('-').map(Number);
            const reservedDate = new Date(y, m - 1, d);
            // Check if today >= reservedDate
            if (today >= reservedDate) {
              isReservationArrived = true;
            }
          }

          return (
            <Card
              key={order.id}
              className="p-5 bg-white border-none shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
              onClick={() => setSelectedOrder(order)}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${order.type === 'reserve' ? 'bg-blue-50 text-blue-600' :
                    order.type === 'submission' ? 'bg-slate-100 text-slate-600' : 'bg-yellow-50 text-yellow-600'
                    }`}>
                    {order.type === 'reserve' ? '예약판매' : order.type === 'submission' ? '상품권 보내기' : '즉시판매'}
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
                  <div className={cn(
                    "bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-4",
                    isSubmitted && "bg-gray-50 border-gray-200"
                  )}>
                    <div className={cn(
                      "flex flex-col text-sm font-medium",
                      (isSubmitted) ? "text-gray-600" : "text-blue-700"
                    )}>
                      <span className={cn(
                        "text-[11px] mb-0.5 font-bold",
                        (isSubmitted) ? "text-gray-500" : "text-blue-500"
                      )}>
                        {isReservationArrived ? `예약일 도래 (${displayDate})` : `예약일 (${displayDate})`}
                      </span>
                      {isSubmitted ? (
                        "상품권 전송이 완료되었습니다."
                      ) : order.is_offset
                        ? `상계 처리된 ${calculateOffsetAmount(order.amount, order.rate).toLocaleString()}원의 상품권을 첨부해주세요`
                        : `판매하신 ${order.amount.toLocaleString()}원의 상품권을 첨부해주세요`
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
                    ) : isSubmitted ? (
                      <div className="w-full bg-gray-200 text-gray-500 text-xs font-bold py-3 rounded-lg flex items-center justify-center">
                        전송 완료
                      </div>
                    ) : null}
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
