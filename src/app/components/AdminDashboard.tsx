import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { Button, Card, Input } from './ui/TossComponents';
import { Search, Calendar as CalendarIcon, BarChart3, ShoppingCart, FileText, Settings, LogOut, Save, ArrowLeft, Download, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useOrders, useRates, useTerms, Rate, Order } from '@/lib/useMockData';
import { Terms } from '@/lib/mockDb';
import { db } from '@/lib/supabase';
import { ContractModal } from './ContractModal';

interface AdminDashboardProps {
  currentDate: string;
  onDateChange: (date: string) => void;
  onExit: () => void;
}

const MENU_ITEMS = [
  { id: 'rates', label: '시세 관리', icon: BarChart3 },
  { id: 'orders', label: '주문 관리', icon: ShoppingCart },
  { id: 'terms', label: '약관 관리', icon: FileText },
];

const STATUS_COLORS = {
  '주문 확인중': 'bg-gray-100 text-gray-600',
  '예약일정 대기중': 'bg-yellow-100 text-yellow-600',
  '완료': 'bg-green-100 text-green-600',
  '반려': 'bg-red-100 text-red-600',
};

const TYPE_LABELS: Record<string, string> = {
  reserve: '예약 매입',
  instant: '즉시 매입',
  submission: '상품권 제출',
};

const TYPE_STYLES: Record<string, string> = {
  reserve: 'bg-blue-50 text-blue-600',
  instant: 'bg-orange-50 text-orange-600',
  submission: 'bg-slate-100 text-slate-600',
};

// --- Sub Components ---

const RateManagement = () => {
  const { rates, updateRate } = useRates();
  const [localRates, setLocalRates] = useState<Rate[]>([]);

  useEffect(() => {
    if (rates.length > 0) {
      setLocalRates(rates);
    }
  }, [rates]);

  const handleRateChange = (id: number, newRate: string) => {
    setLocalRates(prev => prev.map(r => r.id === id ? { ...r, rate: Number(newRate) } : r));
  };

  const handleSave = async () => {
    try {
      const updatePromises = localRates.map(rate => updateRate(rate.id, rate.rate));
      await Promise.all(updatePromises);
      toast.success('변경사항이 저장되었습니다.');
    } catch (error) {
      console.error('Failed to save rates:', error);
      toast.error('저장에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-[#191F28]">시세 관리</h2>
          <p className="text-[#8B95A1] text-sm mt-1">매입 시세와 판매 상태를 관리합니다.</p>
        </div>
        <Button className="bg-[#0064FF] hover:bg-[#0050CC]" onClick={handleSave}>변경사항 저장</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-0 overflow-hidden bg-white border-none shadow-sm">
          <div className="p-4 border-b border-gray-100 bg-blue-50/50">
            <h3 className="font-bold text-[#0064FF] flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" /> 예약 매입
            </h3>
          </div>
          <div className="p-4 space-y-4">
            {localRates.filter(r => r.type === 'reserve').map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="font-medium text-[#333D4B]">{item.name}</span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-white rounded-lg border border-gray-200 px-3 py-1.5">
                    <input
                      type="number"
                      value={item.rate}
                      onChange={(e) => handleRateChange(item.id, e.target.value)}
                      className="w-12 text-right font-bold text-[#191F28] outline-none"
                    />
                    <span className="text-[#8B95A1] ml-1">%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-0 overflow-hidden bg-white border-none shadow-sm">
          <div className="p-4 border-b border-gray-100 bg-yellow-50/50">
            <h3 className="font-bold text-[#FFB800] flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" /> 즉시 매입
            </h3>
          </div>
          <div className="p-4 space-y-4">
            {localRates.filter(r => r.type === 'instant' && !r.name.includes('컬쳐랜드')).map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="font-medium text-[#333D4B]">{item.name}</span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-white rounded-lg border border-gray-200 px-3 py-1.5">
                    <input
                      type="number"
                      value={item.rate}
                      onChange={(e) => handleRateChange(item.id, e.target.value)}
                      className="w-12 text-right font-bold text-[#191F28] outline-none"
                    />
                    <span className="text-[#8B95A1] ml-1">%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

const OrderManagement = ({ currentDate, onDateChange }: { currentDate: string, onDateChange: (d: string) => void }) => {
  const [dateInput, setDateInput] = useState(currentDate);

  // Sync state with prop
  useEffect(() => {
    setDateInput(currentDate);
  }, [currentDate]);
  const [activeFilter, setActiveFilter] = useState('전체'); // activeFilter is now query param status
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 10;

  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [showContractModal, setShowContractModal] = useState(false);
  const { terms } = useTerms();

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [activeFilter, searchTerm]);

  const { orders, totalCount, updateOrder, deleteOrder } = useOrders({
    page,
    limit: LIMIT,
    status: activeFilter,
    search: searchTerm
  });

  const handleDelete = async (id: string) => {
    if (window.confirm('정말 이 주문을 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.')) {
      await deleteOrder(id);
      setSelectedOrder(null);
      toast.success('주문이 삭제되었습니다.');
    }
  };



  const handleDateUpdate = async () => {
    try {
      await db.updateAdminSetting('reservation_date', dateInput);
      onDateChange(dateInput);
      toast.success(`예약일이 ${dateInput}로 변경되었습니다.`);
    } catch (error) {
      console.error('Date update failed:', error);
      toast.error('변경 중 오류가 발생했습니다.');
    }
  };

  const handleStatusChange = (id: string, newStatus: string) => {
    updateOrder(id, { status: newStatus as Order['status'] });
    if (selectedOrder && selectedOrder.id === id) {
      setSelectedOrder({ ...selectedOrder, status: newStatus });
    }
    toast.success('주문 상태가 변경되었습니다.');
  };

  const handleDownloadAllEvidence = async () => {
    if (!selectedOrder) return;

    const files: { url: string; name: string }[] = [];

    if (selectedOrder.id_card_image) {
      files.push({ url: selectedOrder.id_card_image, name: `id_card_${selectedOrder.applicant_name}_${selectedOrder.id}.jpg` });
    }
    if (selectedOrder.bank_book_image) {
      files.push({ url: selectedOrder.bank_book_image, name: `bank_book_${selectedOrder.applicant_name}_${selectedOrder.id}.jpg` });
    }
    if (selectedOrder.voucher_images && selectedOrder.voucher_images.length > 0) {
      selectedOrder.voucher_images.forEach((img: string, idx: number) => {
        files.push({ url: img, name: `voucher_${selectedOrder.id}_${idx}.jpg` });
      });
    }

    if (files.length === 0) {
      toast.error('다운로드할 증빙 파일이 없습니다.');
      return;
    }

    toast.info('증빙 파일을 압축중입니다...');

    try {
      const zip = new JSZip();

      // Fetch all files concurrently
      const downloadPromises = files.map(async (file) => {
        try {
          const response = await fetch(file.url);
          const blob = await response.blob();
          zip.file(file.name, blob);
        } catch (error) {
          console.error('Failed to add file to zip:', file.name, error);
        }
      });

      await Promise.all(downloadPromises);

      const content = await zip.generateAsync({ type: 'blob' });
      const zipUrl = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = zipUrl;
      link.download = `orders_evidence_${selectedOrder.id}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(zipUrl);

      toast.success('증빙 파일 압축 다운로드가 완료되었습니다.');
    } catch (error) {
      console.error('Zip creation failed:', error);
      toast.error('파일 압축 중 오류가 발생했습니다.');
    }
  };

  const handleDownloadSingle = async (url: string, name: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Download failed for:', name, error);
      window.open(url, '_blank');
    }
  };

  const getAvailableStatuses = (type: string) => {
    const common = ['주문 확인중', '완료', '반려'];
    if (type === 'reserve') {
      return ['주문 확인중', '예약일정 대기중', '완료', '반려'];
    }
    return common;
  };

  const filterTabs = ['전체', '주문 확인중', '예약일정 대기중', '완료', '반려'];

  const showVoucherStatus = activeFilter === '예약일정 대기중';

  const totalPages = Math.ceil(totalCount / LIMIT);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#191F28]">주문 관리</h2>
          <p className="text-[#8B95A1] text-sm mt-1">접수된 주문 내역을 확인하고 처리합니다.</p>
        </div>

        <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm shrink-0">
          <div className="pl-3 pr-2 text-sm font-medium text-[#4E5968] whitespace-nowrap">예약 기준일</div>
          <div className="h-4 w-[1px] bg-gray-200" />
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="bg-transparent text-sm font-bold text-[#191F28] outline-none hover:bg-gray-50 px-2 py-1 rounded transition-colors min-w-[100px] text-center whitespace-nowrap"
              >
                {dateInput ? format(new Date(dateInput), 'yyyy. MM. dd.') : '날짜 선택'}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={dateInput ? new Date(dateInput) : undefined}
                onSelect={(date) => date && setDateInput(format(date, 'yyyy-MM-dd'))}
                initialFocus
                locale={ko}
              />
            </PopoverContent>
          </Popover>
          <button
            onClick={handleDateUpdate}
            className="px-3 py-1.5 bg-[#0064FF] text-white text-xs font-bold rounded-lg hover:bg-[#0050CC] transition-colors whitespace-nowrap"
          >
            적용
          </button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden border-none shadow-sm bg-white">
        <div className="p-4 border-b border-gray-100 flex flex-wrap justify-between items-center gap-4">
          <div className="flex gap-2 flex-wrap">
            {filterTabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap",
                  activeFilter === tab
                    ? "bg-gray-100 text-[#333D4B]"
                    : "bg-white text-[#8B95A1] border border-gray-100 hover:bg-gray-50"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#F9FAFB] text-sm outline-none focus:bg-white focus:ring-1 ring-[#0064FF] transition-all"
              placeholder="이름, 연락처 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#F9FAFB] text-[#8B95A1] text-[13px] font-semibold border-b border-gray-100">
              <tr>
                <th className="p-4 pl-6 text-left">주문번호</th>
                <th className="p-4 text-left">유형</th>
                <th className="p-4 text-left">상품명</th>
                <th className="p-4 text-left">예약일</th>
                <th className="p-4 text-left">신청자</th>
                <th className="p-4 text-left">연락처</th>
                <th className="p-4 text-left">금액</th>
                {showVoucherStatus && <th className="p-4 text-left">상품권등록</th>}
                <th className="p-4 text-left">상태</th>
                <th className="p-4 pr-6 text-left">관리</th>
              </tr>
            </thead>
            <tbody className="text-left text-[14px] text-[#333D4B] divide-y divide-gray-50">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={showVoucherStatus ? 10 : 9} className="p-10 text-center text-gray-400">
                    주문 내역이 없습니다.
                  </td>
                </tr>
              ) : orders.map((order) => {
                return (
                  <tr key={order.id} className={cn("hover:bg-gray-50 transition-colors", order.is_my_order && "bg-blue-50/30")}>
                    <td className="p-4 pl-6 font-mono text-gray-400 text-left">#{order.id.slice(0, 8)}</td>
                    <td className="p-4 text-left">
                      <span className={cn("text-xs font-medium px-2 py-1 rounded-md whitespace-nowrap", TYPE_STYLES[order.type] || "bg-gray-100 text-gray-500")}>
                        {TYPE_LABELS[order.type] || "미지정"}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-[#333D4B] text-left">
                      {order.name}
                    </td>
                    <td className="p-4 text-left text-gray-600">
                      {order.expected_date ? (
                        <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs font-bold">
                          {order.expected_date}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="p-4 text-left">
                      {order.applicant_name || '-'}
                      {order.is_my_order && <span className="text-[10px] bg-blue-100 text-blue-600 px-1 rounded ml-1">My</span>}
                    </td>
                    <td className="p-4 text-gray-500 text-[13px] text-left">{order.phone || '-'}</td>
                    <td className="p-4 font-bold text-left">{order.amount.toLocaleString()}원</td>

                    {showVoucherStatus && (
                      <td className="p-4 text-left">
                        <span className={cn(
                          "font-bold text-xs",
                          order.voucher_images && order.voucher_images.length > 0 ? "text-blue-600" : "text-gray-300"
                        )}>
                          {order.voucher_images && order.voucher_images.length > 0 ? "O" : "X"}
                        </span>
                      </td>
                    )}
                    <td className="p-4 text-left">
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                        className={cn(
                          "px-2 py-1 rounded-md text-xs font-medium border-none outline-none cursor-pointer appearance-none text-center transition-colors w-[130px]",
                          STATUS_COLORS[order.status as keyof typeof STATUS_COLORS] || 'bg-gray-100 text-gray-600'
                        )}
                      >
                        {getAvailableStatuses(order.type).map((status) => (
                          <option key={status} value={status} className="bg-white text-black font-normal">
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4 pr-6 text-left">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="px-3 py-1.5 bg-white border border-gray-200 text-[#333D4B] text-xs font-medium rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all whitespace-nowrap"
                      >
                        상세보기
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalCount > 0 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-100">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1 text-sm font-medium disabled:opacity-30 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
            >
              이전
            </button>
            <span className="text-sm font-medium text-[#191F28] px-4">
              {page} / {totalPages || 1}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1 text-sm font-medium disabled:opacity-30 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
            >
              다음
            </button>
          </div>
        )}
      </Card>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-bold text-[#191F28]">주문 상세 정보</h3>
                <p className="text-sm text-[#8B95A1] mt-1">주문번호 #{selectedOrder.id.slice(0, 8)}</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={selectedOrder.status}
                  onChange={(e) => handleStatusChange(selectedOrder.id, e.target.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-bold border-none outline-none cursor-pointer appearance-none text-center transition-colors w-[130px]",
                    STATUS_COLORS[selectedOrder.status as keyof typeof STATUS_COLORS] || 'bg-gray-100 text-gray-600'
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  {getAvailableStatuses(selectedOrder.type).map((status) => (
                    <option key={status} value={status} className="bg-white text-black font-normal">
                      {status}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleDelete(selectedOrder.id)}
                  className="p-2 hover:bg-red-50 text-red-500 rounded-full transition-colors mr-2"
                  title="주문 삭제"
                >
                  <Trash2 size={20} />
                </button>
                <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <LogOut size={20} className="rotate-180" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-8">
              {/* Basic Info */}
              <section>
                <h4 className="text-sm font-bold text-[#191F28] mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-[#0064FF] rounded-full" /> 기본 정보
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#F9FAFB] p-4 rounded-xl">
                    <span className="text-xs text-[#8B95A1] block mb-1">상품명</span>
                    <span className="text-sm font-medium text-[#333D4B]">{selectedOrder.name}</span>
                  </div>
                  <div className="bg-[#F9FAFB] p-4 rounded-xl">
                    <span className="text-xs text-[#8B95A1] block mb-1">유형</span>
                    <span className={cn("text-xs font-bold px-2 py-1 rounded inline-block", TYPE_STYLES[selectedOrder.type])}>
                      {TYPE_LABELS[selectedOrder.type]}
                    </span>
                  </div>
                  <div className="bg-[#F9FAFB] p-4 rounded-xl">
                    <span className="text-xs text-[#8B95A1] block mb-1">신청 금액 (액면가)</span>
                    <span className="text-sm font-bold text-[#191F28]">{selectedOrder.amount.toLocaleString()}원</span>
                  </div>
                  <div className="bg-[#F9FAFB] p-4 rounded-xl">
                    <span className="text-xs text-[#8B95A1] block mb-1">적용 매입률</span>
                    <span className="text-sm font-bold text-[#0064FF]">{selectedOrder.rate}%</span>
                  </div>
                </div>
              </section>

              {/* Applicant Info */}
              <section>
                <h4 className="text-sm font-bold text-[#191F28] mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-[#0064FF] rounded-full" /> 신청자 정보
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#F9FAFB] p-4 rounded-xl">
                    <span className="text-xs text-[#8B95A1] block mb-1">신청자 성함</span>
                    <span className="text-sm font-medium text-[#333D4B]">{selectedOrder.applicant_name || '-'}</span>
                  </div>
                  <div className="bg-[#F9FAFB] p-4 rounded-xl">
                    <span className="text-xs text-[#8B95A1] block mb-1">연락처</span>
                    <span className="text-sm font-medium text-[#333D4B]">{selectedOrder.phone}</span>
                  </div>
                  {selectedOrder.type === 'reserve' && (
                    <div className="bg-[#F9FAFB] p-4 rounded-xl col-span-2">
                      <span className="text-xs text-[#8B95A1] block mb-1">이메일</span>
                      <span className="text-sm font-medium text-[#333D4B]">{selectedOrder.email || '-'}</span>
                    </div>
                  )}
                </div>
              </section>

              {/* Financial Info */}
              <section>
                <h4 className="text-sm font-bold text-[#191F28] mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-[#0064FF] rounded-full" /> 계좌 정보
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#F9FAFB] p-4 rounded-xl">
                    <span className="text-xs text-[#8B95A1] block mb-1">은행명</span>
                    <span className="text-sm font-medium text-[#333D4B]">{selectedOrder.bank_name || '-'}</span>
                  </div>
                  <div className="bg-[#F9FAFB] p-4 rounded-xl">
                    <span className="text-xs text-[#8B95A1] block mb-1">계좌번호</span>
                    <span className="text-sm font-medium text-[#333D4B]">{selectedOrder.account_number || '-'}</span>
                  </div>
                </div>
              </section>

              {/* Reserve Specific */}
              {selectedOrder.type === 'reserve' && (
                <section>
                  <h4 className="text-sm font-bold text-[#191F28] mb-3 flex items-center gap-2">
                    <span className="w-1 h-4 bg-[#0064FF] rounded-full" /> 예약 정보
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#F9FAFB] p-4 rounded-xl">
                      <span className="text-xs text-[#8B95A1] block mb-1">예약 희망일</span>
                      <span className="text-sm font-bold text-[#333D4B]">{selectedOrder.expected_date || '-'}</span>
                    </div>
                    <div className="bg-[#F9FAFB] p-4 rounded-xl">
                      <span className="text-xs text-[#8B95A1] block mb-1">물품대금지급 ({selectedOrder.rate || 0}%)</span>
                      <span className="text-sm font-bold text-[#0064FF]">{selectedOrder.deposit?.toLocaleString() || 0}원</span>
                    </div>
                  </div>
                </section>
              )}

              {/* Images */}
              <section>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-bold text-[#191F28] flex items-center gap-2">
                    <span className="w-1 h-4 bg-[#0064FF] rounded-full" /> 제출된 증빙
                  </h4>
                  {(selectedOrder.id_card_image || selectedOrder.bank_book_image || (selectedOrder.voucher_images && selectedOrder.voucher_images.length > 0)) && (
                    <button
                      onClick={handleDownloadAllEvidence}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                    >
                      <Download size={14} />
                      전체 다운로드
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* ID Card */}
                    {selectedOrder.id_card_image && (
                      <div>
                        <p className="text-xs font-semibold text-[#8B95A1] mb-2">신분증 사본</p>
                        <div className="w-full h-40 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 group relative">
                          <img src={selectedOrder.id_card_image} alt="id-card" className="w-full h-full object-contain" />
                          <button
                            onClick={() => handleDownloadSingle(selectedOrder.id_card_image!, `id_card_${selectedOrder.applicant_name}_${selectedOrder.id}.jpg`)}
                            className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer w-full h-full border-none outline-none p-0 m-0"
                          >
                            <div className="bg-white/90 p-2 rounded-full shadow-sm text-gray-700 font-medium text-xs flex items-center gap-1">
                              <span className="text-[10px]">다운로드</span>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Bank Book */}
                    {selectedOrder.bank_book_image && (
                      <div>
                        <p className="text-xs font-semibold text-[#8B95A1] mb-2">통장 사본</p>
                        <div className="w-full h-40 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 group relative">
                          <img src={selectedOrder.bank_book_image} alt="bank-book" className="w-full h-full object-contain" />
                          <button
                            onClick={() => handleDownloadSingle(selectedOrder.bank_book_image!, `bank_book_${selectedOrder.applicant_name}_${selectedOrder.id}.jpg`)}
                            className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer w-full h-full border-none outline-none p-0 m-0"
                          >
                            <div className="bg-white/90 p-2 rounded-full shadow-sm text-gray-700 font-medium text-xs flex items-center gap-1">
                              <span className="text-[10px]">다운로드</span>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Voucher Images */}
                  {/* Voucher Images */}
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-[#8B95A1] mb-2">상품권 이미지</p>
                    {selectedOrder.voucher_images && selectedOrder.voucher_images.length > 0 ? (
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {selectedOrder.voucher_images.map((img: string, idx: number) => (
                          <div key={idx} className="w-24 h-24 shrink-0 rounded-lg overflow-hidden border border-gray-200 group relative">
                            <img src={img} alt={`voucher-${idx}`} className="w-full h-full object-cover" />
                            <button
                              onClick={() => handleDownloadSingle(img, `voucher_${selectedOrder.id}_${idx}.jpg`)}
                              className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer w-full h-full border-none outline-none p-0 m-0"
                            >
                              <div className="bg-white/90 p-1.5 rounded-full shadow-sm text-gray-700">
                                <span className="text-[10px] font-bold">DOWN</span>
                              </div>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="w-full h-24 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-center text-xs text-gray-400">
                        등록된 상품권 이미지가 없습니다
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-between items-center">
              <div className="flex gap-2">
                {selectedOrder.type === 'reserve' && (
                  <Button
                    onClick={() => setShowContractModal(true)}
                    className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <FileText size={16} /> 계약서 보기
                  </Button>
                )}
              </div>
              <Button onClick={() => setSelectedOrder(null)} className="bg-[#333D4B]">닫기</Button>
            </div>
          </div>
        </div>
      )}

      {showContractModal && selectedOrder && (
        <ContractModal
          order={selectedOrder}
          terms={
            // Pass the current dynamic terms
            terms || {
              reserve: { privacy: '', privacyTitle: '', responsibility: '', responsibilityTitle: '', items: [] },
              instant: { privacy: '', privacyTitle: '', responsibility: '', responsibilityTitle: '' },
              submission: { privacy: '', privacyTitle: '', responsibility: '', responsibilityTitle: '' }
            }
          }
          onClose={() => setShowContractModal(false)}
        />
      )}
    </div>
  );
};

const TermsManagement = () => {
  const { terms, updateTerms } = useTerms();
  const [localTerms, setLocalTerms] = useState<Terms | null>(null);

  useEffect(() => {
    if (terms) {
      setLocalTerms(terms);
    }
  }, [terms]);

  const handleSave = () => {
    if (localTerms) {
      updateTerms(localTerms);
      toast.success('약관이 저장되었습니다.');
    }
  };

  const updateSection = (section: keyof Terms, key: string, value: string) => {
    if (!localTerms) return;
    setLocalTerms({
      ...localTerms,
      [section]: {
        ...localTerms[section],
        [key]: value
      }
    });
  };

  const addReserveItem = () => {
    if (!localTerms) return;
    const newItem = {
      id: `term_${Date.now()}`,
      title: '',
      content: '',
      required: true
    };
    setLocalTerms({
      ...localTerms,
      reserve: {
        ...localTerms.reserve,
        items: [...(localTerms.reserve.items || []), newItem]
      }
    });
  };

  const removeReserveItem = (id: string) => {
    if (!localTerms) return;
    setLocalTerms({
      ...localTerms,
      reserve: {
        ...localTerms.reserve,
        items: (localTerms.reserve.items || []).filter(item => item.id !== id)
      }
    });
  };

  const updateReserveItem = (id: string, key: 'title' | 'content', value: string) => {
    if (!localTerms) return;
    setLocalTerms({
      ...localTerms,
      reserve: {
        ...localTerms.reserve,
        items: (localTerms.reserve.items || []).map(item =>
          item.id === id ? { ...item, [key]: value } : item
        )
      }
    });
  };

  if (!localTerms) return <div>Loading...</div>;

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-[#191F28]">약관 관리</h2>
          <p className="text-[#8B95A1] text-sm mt-1">각 서비스별 이용약관 및 동의사항을 관리합니다.</p>
        </div>
        <Button className="bg-[#0064FF] flex items-center gap-2" onClick={handleSave}>
          <Save size={16} /> 전체 저장하기
        </Button>
      </div>

      <div className="space-y-12">
        {/* Reserve (Dynamic) */}
        <div className="space-y-4">
          <div className="flex justify-between items-center border-l-4 border-[#0064FF] pl-3">
            <h3 className="text-lg font-bold text-[#333D4B]">예약 판매</h3>
            <Button onClick={addReserveItem} className="flex items-center gap-1 text-[#0064FF] border border-[#0064FF] bg-white hover:bg-[#E8F3FF] h-9 px-3 text-sm rounded-lg">
              <Plus size={14} /> 약관 추가
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {localTerms.reserve.items?.map((item) => (
              <Card key={item.id} className="p-6 bg-white border-none shadow-sm space-y-4 relative group">
                <div className="flex justify-between items-center mb-2">
                  <Input
                    className="font-bold text-[#191F28] text-[15px] border-none bg-transparent hover:bg-gray-50 focus:bg-white px-0"
                    value={item.title}
                    onChange={(e) => updateReserveItem(item.id, 'title', e.target.value)}
                    placeholder="제목을 입력하세요"
                  />
                  <button
                    onClick={() => removeReserveItem(item.id)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    title="삭제"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <textarea
                  className="w-full h-[300px] p-4 rounded-xl bg-[#F9FAFB] border border-gray-200 text-sm leading-relaxed outline-none focus:border-[#0064FF] transition-colors resize-none"
                  value={item.content}
                  onChange={(e) => updateReserveItem(item.id, 'content', e.target.value)}
                />
              </Card>
            ))}
          </div>
        </div>

        {/* Instant */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-[#333D4B] border-l-4 border-[#FFB800] pl-3">즉시 판매</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6 bg-white border-none shadow-sm space-y-4">
              <div className="flex justify-between items-center mb-2">
                <Input
                  className="font-bold text-[#191F28] text-[15px] border-none bg-transparent hover:bg-gray-50 focus:bg-white px-0"
                  value={localTerms.instant.responsibilityTitle}
                  onChange={(e) => updateSection('instant', 'responsibilityTitle', e.target.value)}
                  placeholder="제목을 입력하세요"
                />
              </div>
              <textarea
                className="w-full h-[300px] p-4 rounded-xl bg-[#F9FAFB] border border-gray-200 text-sm leading-relaxed outline-none focus:border-[#0064FF] transition-colors resize-none"
                value={localTerms.instant.responsibility}
                onChange={(e) => updateSection('instant', 'responsibility', e.target.value)}
              />
            </Card>
            <Card className="p-6 bg-white border-none shadow-sm space-y-4">
              <div className="flex justify-between items-center mb-2">
                <Input
                  className="font-bold text-[#191F28] text-[15px] border-none bg-transparent hover:bg-gray-50 focus:bg-white px-0"
                  value={localTerms.instant.privacyTitle}
                  onChange={(e) => updateSection('instant', 'privacyTitle', e.target.value)}
                  placeholder="제목을 입력하세요"
                />
              </div>
              <textarea
                className="w-full h-[300px] p-4 rounded-xl bg-[#F9FAFB] border border-gray-200 text-sm leading-relaxed outline-none focus:border-[#0064FF] transition-colors resize-none"
                value={localTerms.instant.privacy}
                onChange={(e) => updateSection('instant', 'privacy', e.target.value)}
              />
            </Card>
          </div>
        </div>

        {/* Submission */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-[#333D4B] border-l-4 border-slate-500 pl-3">상품권 제출</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6 bg-white border-none shadow-sm space-y-4">
              <div className="flex justify-between items-center mb-2">
                <Input
                  className="font-bold text-[#191F28] text-[15px] border-none bg-transparent hover:bg-gray-50 focus:bg-white px-0"
                  value={localTerms.submission.responsibilityTitle}
                  onChange={(e) => updateSection('submission', 'responsibilityTitle', e.target.value)}
                  placeholder="제목을 입력하세요"
                />
              </div>
              <textarea
                className="w-full h-[300px] p-4 rounded-xl bg-[#F9FAFB] border border-gray-200 text-sm leading-relaxed outline-none focus:border-[#0064FF] transition-colors resize-none"
                value={localTerms.submission.responsibility}
                onChange={(e) => updateSection('submission', 'responsibility', e.target.value)}
              />
            </Card>
            <Card className="p-6 bg-white border-none shadow-sm space-y-4">
              <div className="flex justify-between items-center mb-2">
                <Input
                  className="font-bold text-[#191F28] text-[15px] border-none bg-transparent hover:bg-gray-50 focus:bg-white px-0"
                  value={localTerms.submission.privacyTitle}
                  onChange={(e) => updateSection('submission', 'privacyTitle', e.target.value)}
                  placeholder="제목을 입력하세요"
                />
              </div>
              <textarea
                className="w-full h-[300px] p-4 rounded-xl bg-[#F9FAFB] border border-gray-200 text-sm leading-relaxed outline-none focus:border-[#0064FF] transition-colors resize-none"
                value={localTerms.submission.privacy}
                onChange={(e) => updateSection('submission', 'privacy', e.target.value)}
              />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main Layout ---

export const AdminDashboard = ({ currentDate, onDateChange, onExit }: AdminDashboardProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeMenu, setActiveMenu] = useState('orders');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === 'ksiboy22@naver.com' && password === 'Djajeo21!!') {
      setIsAuthenticated(true);
      toast.success('관리자님 환영합니다.');
    } else {
      toast.error('아이디 또는 비밀번호를 확인해주세요.');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F2F4F6] p-4">
        <Card className="w-full max-w-[400px] p-8 space-y-8 bg-white shadow-lg border-none">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#0064FF]">
              <Settings size={24} />
            </div>
            <h1 className="text-2xl font-bold text-[#191F28]">관리자 로그인</h1>
            <p className="text-[#8B95A1] text-[15px]">서비스 관리를 위해 로그인해주세요.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1">
              <label className="text-[13px] font-semibold text-[#8B95A1] ml-1">이메일</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@simpleticket.com"
                className="h-12 text-[15px]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[13px] font-semibold text-[#8B95A1] ml-1">비밀번호</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력해주세요"
                className="h-12 text-[15px]"
              />
            </div>
            <Button fullWidth size="lg" type="submit" className="h-12 text-[16px] font-bold mt-2">
              로그인하기
            </Button>
          </form>

          <button
            onClick={onExit}
            className="w-full py-2 text-center text-[13px] text-[#8B95A1] hover:text-[#333D4B] transition-colors flex items-center justify-center gap-1"
          >
            <ArrowLeft size={14} /> 메인으로 돌아가기
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-64px)] bg-[#F2F4F6]">
      {/* Sidebar */}
      <aside className="w-[200px] bg-white border-r border-gray-100 flex flex-col z-10 shrink-0 transition-all">
        <div className="p-5 border-b border-gray-50">
          <h1 className="text-lg font-extrabold text-[#0064FF]">심플티켓</h1>
          <p className="text-[11px] text-gray-400 mt-1 font-medium">관리자 시스템</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeMenu === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveMenu(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm",
                  isActive
                    ? "bg-[#E8F3FF] text-[#0064FF] font-bold"
                    : "text-[#4E5968] font-medium hover:bg-gray-50 hover:text-[#333D4B]"
                )}
              >
                <Icon size={18} className={isActive ? "text-[#0064FF]" : "text-[#8B95A1]"} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-50">
          <button
            onClick={onExit}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-[#4E5968] font-medium text-xs hover:bg-gray-100 rounded-xl transition-colors"
          >
            <ArrowLeft size={16} />
            나가기
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="w-full px-6 py-6 mx-auto">
          {activeMenu === 'rates' && <RateManagement />}
          {activeMenu === 'orders' && <OrderManagement currentDate={currentDate} onDateChange={onDateChange} />}
          {activeMenu === 'terms' && <TermsManagement />}
        </div>
      </main>
    </div>
  );
};
