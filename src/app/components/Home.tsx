import React from 'react';
import { Card } from './ui/TossComponents';
import { ChevronRight, Settings, Zap, CalendarClock, Send, TrendingUp } from 'lucide-react';
import { useRates } from '@/lib/useMockData';

interface HomeProps {
  onNavigate: (tab: string) => void;
}

export const Home = ({ onNavigate }: HomeProps) => {
  const { rates } = useRates();

  const reserveRates = rates.filter(r => r.type === 'reserve' && r.active);
  // Manually add 'Shinsegae Emart' if not present (Frontend override)
  if (!reserveRates.find(r => r.name.includes('이마트') || r.name.includes('신세계'))) {
    reserveRates.push({ id: 9999, type: 'reserve', name: '신세계 이마트전용', rate: 80, active: true });
  }

  const instantRates = rates.filter(r => r.type === 'instant' && r.active);

  const formatName = (name: string) => name.replace(' 상품권', '');

  return (
    <div className="space-y-8 pb-20">
      {/* Header with Admin Button */}
      <header className="flex justify-between items-center pt-2 px-1">
        <h1 className="text-2xl font-extrabold text-[#0064FF] tracking-tight">
          심플티켓
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('admin')}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={() => onNavigate('history')}
            className="px-3.5 py-1.5 rounded-full bg-[#E8F3FF] text-[#0064FF] text-[12px] font-bold hover:bg-[#D6E6FF] transition-colors"
          >
            주문내역
          </button>
        </div>
      </header>

      {/* Market Rates Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <TrendingUp className="text-[#0064FF]" size={18} />
          <h2 className="text-[17px] font-bold text-[#191F28]">오늘의 매입 시세</h2>
        </div>

        <Card className="bg-white border-none shadow-[0_2px_16px_rgba(0,0,0,0.04)] p-5">
          {/* Reserve Buyback Section */}
          <div className="mb-6">
            <div className="flex items-center gap-1.5 mb-3">
              <CalendarClock size={15} className="text-[#0064FF]" />
              <span className="text-[13px] font-semibold text-[#6B7684]">예약 매입</span>
            </div>
            <div className="space-y-3">
              {reserveRates.length > 0 ? reserveRates.map(rate => (
                <div key={rate.id} className="flex justify-between items-center">
                  <span className="text-[#333D4B] font-medium text-[15px]">{formatName(rate.name)}</span>
                  <span className="text-[17px] font-bold text-[#191F28]">{rate.rate}%</span>
                </div>
              )) : (
                <div className="text-sm text-gray-400 text-center py-2">시세 정보가 없습니다.</div>
              )}
            </div>
          </div>

          {/* Instant Buyback Section */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Zap size={15} className="text-[#FFB800]" />
              <span className="text-[13px] font-semibold text-[#6B7684]">즉시 매입</span>
            </div>

            <div className="space-y-3">
              {instantRates.length > 0 ? instantRates.map(rate => (
                <div key={rate.id} className="flex justify-between items-center">
                  <span className="text-[#333D4B] font-medium text-[15px]">{formatName(rate.name)}</span>
                  <span className="text-[17px] font-bold text-[#191F28]">{rate.rate}%</span>
                </div>
              )) : (
                <div className="text-sm text-gray-400 text-center py-2">시세 정보가 없습니다.</div>
              )}
            </div>
          </div>
        </Card>
      </section>

      {/* Quick Actions */}
      <section className="space-y-4">
        <h2 className="text-[17px] font-bold text-[#191F28] px-1">바로가기</h2>
        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={() => onNavigate('quick')}
            className="group flex items-center justify-between p-5 bg-white rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] active:scale-[0.98] transition-all hover:shadow-md border border-transparent hover:border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="w-[46px] h-[46px] rounded-[18px] bg-[#FFF8E1] flex items-center justify-center text-[#FFB800]">
                <Zap size={22} />
              </div>
              <div className="text-left space-y-0.5">
                <div className="font-bold text-[#191F28] text-[16px]">즉시 판매하기</div>
                <div className="text-[13px] text-[#8B95A1]">기다림 없이 바로 입금받아요</div>
              </div>
            </div>
            <ChevronRight size={20} className="text-[#D1D6DB] group-hover:text-[#B0B8C1] group-hover:translate-x-1 transition-all" />
          </button>

          <button
            onClick={() => onNavigate('reserve')}
            className="group flex items-center justify-between p-5 bg-white rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] active:scale-[0.98] transition-all hover:shadow-md border border-transparent hover:border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="w-[46px] h-[46px] rounded-[18px] bg-[#E8F3FF] flex items-center justify-center text-[#0064FF]">
                <CalendarClock size={22} />
              </div>
              <div className="text-left space-y-0.5">
                <div className="font-bold text-[#191F28] text-[16px]">예약 판매하기</div>
                <div className="text-[13px] text-[#8B95A1]">선지급50% + 잔금30%</div>
              </div>
            </div>
            <ChevronRight size={20} className="text-[#D1D6DB] group-hover:text-[#B0B8C1] group-hover:translate-x-1 transition-all" />
          </button>

          <button
            onClick={() => onNavigate('submit')}
            className="group flex items-center justify-between p-5 bg-white rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] active:scale-[0.98] transition-all hover:shadow-md border border-transparent hover:border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="w-[46px] h-[46px] rounded-[18px] bg-[#F2F4F6] flex items-center justify-center text-[#4E5968]">
                <Send size={20} className="ml-0.5 mt-0.5" />
              </div>
              <div className="text-left space-y-0.5">
                <div className="font-bold text-[#191F28] text-[16px]">상품권 보내기</div>
                <div className="text-[13px] text-[#8B95A1]">약속된 상품권을 전송합니다</div>
              </div>
            </div>
            <ChevronRight size={20} className="text-[#D1D6DB] group-hover:text-[#B0B8C1] group-hover:translate-x-1 transition-all" />
          </button>
        </div>
      </section>

      {/* Contact Info Footer */}
      <footer className="py-8 text-center space-y-3 pb-12">
        <h3 className="text-[#8B95A1] text-sm font-bold">고객센터</h3>
        <div className="text-[#8B95A1] text-sm font-medium space-y-1.5">
          <p>연락처: 010-7393-1157</p>
          <div className="flex justify-center gap-3">
            <span>라인: knn900</span>
            <span className="w-[1px] h-3 bg-gray-300 my-auto"></span>
            <span>카톡: knn900</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
