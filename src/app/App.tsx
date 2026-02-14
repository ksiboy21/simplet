import React, { useState } from 'react';
import { Toaster } from 'sonner';
import { Home } from './components/Home';
import { QuickBuyback } from './components/QuickBuyback';
import { ReserveBuyback } from './components/ReserveBuyback';
import { VoucherSubmission } from './components/VoucherSubmission';
import { VoucherSubmissionSuccess } from './components/VoucherSubmissionSuccess';
import { AdminDashboard } from './components/AdminDashboard';
import { UserOrderHistory } from './components/UserOrderHistory';
import { ErrorBoundary } from './components/ErrorBoundary';
import { cn } from '@/lib/utils';
import { Zap, CalendarClock, Send, Home as HomeIcon } from 'lucide-react';
import { db } from '@/lib/supabase';

const TABS = [
  { id: 'home', label: '홈', icon: HomeIcon },
  { id: 'quick', label: '즉시판매', icon: Zap },
  { id: 'reserve', label: '예약판매', icon: CalendarClock },
  { id: 'submit', label: '보내기', icon: Send },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  // Fetch global admin date from Supabase
  const [adminDate, setAdminDate] = useState('2026-01-30'); // Fallback default

  React.useEffect(() => {
    const fetchAdminDate = async () => {
      try {
        const date = await db.getAdminSetting('reservation_date');
        if (date) setAdminDate(date);
      } catch (error) {
        console.error('Failed to fetch admin date:', error);
      }
    };
    fetchAdminDate();
  }, []);

  const handleNavigate = (tab: string) => {
    setActiveTab(tab);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <Home onNavigate={handleNavigate} />;
      case 'quick':
        return <QuickBuyback onSuccess={() => setActiveTab('success')} />;
      case 'reserve':
        return <ReserveBuyback availableDate={adminDate} onSuccess={() => setActiveTab('reserveSuccess')} />;
      case 'submit':
        return <VoucherSubmission onSuccess={() => setActiveTab('submitSuccess')} />;
      case 'success':
        return <VoucherSubmissionSuccess onHome={() => setActiveTab('home')} onHistory={() => setActiveTab('history')} />;
      case 'submitSuccess':
        return (
          <VoucherSubmissionSuccess
            onHome={() => setActiveTab('home')}
            onHistory={() => setActiveTab('history')}
            title="상품권 전송이 완료되었습니다"
          />
        );
      case 'reserveSuccess':
        return (
          <VoucherSubmissionSuccess
            onHome={() => setActiveTab('home')}
            onHistory={() => setActiveTab('history')}
            title="예약 신청이 완료되었습니다"
            description={
              <div className="space-y-6 w-full">
                <div className="space-y-2">
                  <p className="break-keep">
                    예약 확인 후 선금이 지급되며,<br />
                    예약한 날짜에 상품권을 보내주시면 잔금이 입금됩니다.
                  </p>
                  <p className="text-[#6B7684] text-[14px] break-keep">
                    * 상품권 발송은 <span className="font-bold text-[#191F28]">신청내역</span> 페이지에서 하실 수 있습니다.
                  </p>
                </div>

                <div className="bg-[#F9FAFB] p-4 rounded-[20px] text-[15px] space-y-3 text-left w-full border border-gray-100">
                  <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                    <span className="text-[#8B95A1] font-medium">예약일</span>
                    <span className="font-bold text-[#191F28] text-lg whitespace-nowrap">{adminDate}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[#F04452] font-bold text-[13px] block mb-1">미전송 시 안내</span>
                    <p className="text-[#4E5968] text-[12px] leading-snug tracking-tight break-keep">
                      정해진 예약일에 상품권 전송이 되지 않을시 <span className="font-bold">민형사상 조치</span>가 진행될 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>
            }
          />
        );
      case 'history':
        return <UserOrderHistory onBack={() => setActiveTab('home')} />;
      case 'admin':
        return <AdminDashboard currentDate={adminDate} onDateChange={setAdminDate} onExit={() => setActiveTab('home')} />;
      default:
        return <Home onNavigate={handleNavigate} />;
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F2F4F6] font-sans text-[#191F28] flex flex-col items-center">
        {/* Mobile/Desktop Wrapper */}
        <div className={cn(
          "min-h-screen bg-white shadow-xl relative flex flex-col transition-all duration-300",
          activeTab === 'admin' ? "w-full max-w-[1600px] my-0 md:my-8 md:rounded-[20px] md:h-[calc(100vh-64px)]" : "w-full max-w-lg"
        )}>

          {/* Main Content Area */}
          <main className={cn(
            "flex-1 overflow-y-auto scrollbar-hide",
            activeTab === 'admin' ? "p-0" : "p-6 pt-10 pb-24"
          )}>
            <ErrorBoundary>
              {renderContent()}
            </ErrorBoundary>
          </main>

          {/* Bottom Navigation */}
          {activeTab !== 'admin' && activeTab !== 'history' && activeTab !== 'success' && activeTab !== 'reserveSuccess' && activeTab !== 'submitSuccess' && (
            <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white border-t border-gray-100 px-6 py-2 flex justify-between items-center z-50 rounded-t-[20px] shadow-[0_-5px_20px_rgba(0,0,0,0.03)]">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="flex flex-col items-center justify-center w-16 h-14 gap-1 active:scale-95 transition-transform"
                  >
                    <Icon
                      size={24}
                      className={cn(
                        "transition-colors duration-200",
                        isActive ? "text-[#0064FF]" : "text-[#B0B8C1]"
                      )}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    <span className={cn(
                      "text-[10px] font-medium transition-colors duration-200",
                      isActive ? "text-[#0064FF]" : "text-[#B0B8C1]"
                    )}>
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          )}
        </div>

        <Toaster position="top-center" richColors />
      </div>
    </ErrorBoundary>
  );
}
