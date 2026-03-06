import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserOrders } from '@/lib/useMockData';
import { sendSMS } from '@/lib/solapi';
import { toast } from 'sonner';

export const PENDING_ORDER_KEY = 'pendingEsignonOrder';

export const useEsignonPolling = () => {
  const { addOrder } = useUserOrders();
  const checkIntervalRef = useRef<NodeJS.Timeout>();
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const saved = localStorage.getItem(PENDING_ORDER_KEY);
        if (!saved || isSubmittingRef.current) return;

        const { workflowId, orderData } = JSON.parse(saved);
        if (!workflowId || !orderData) return;

        const { data, error } = await supabase.functions.invoke('check-esignon-status', {
          body: { workflowId }
        });

        if (!error && data?.isComplete) {
          isSubmittingRef.current = true; // 중복 제출 방지
          // 서명 완료
          await submitOrder(orderData);
        }
      } catch (e) {
        console.error("Global esignon polling error:", e);
      }
    };

    // 3초마다 체크
    checkIntervalRef.current = setInterval(checkStatus, 3000);

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [addOrder]); // Added dependency

  const submitOrder = async (orderData: any) => {
    try {
      await addOrder(orderData);
      try {
        await sendSMS(
          orderData.phone,
          `안녕하세요, 고객님. 주문이 정상적으로 접수되었습니다.\n검토 결과에 따라 매입이 반려될 수 있는 점 양해 부탁드립니다.\n진행 상황은 [주문내역] 페이지에서 실시간으로 확인하실 수 있습니다.`
        );
      } catch (smsError) {
        console.error('SMS 발송 실패:', smsError);
      }

      toast.success('계약서 서명이 완료되어 주문이 접수되었습니다!');
      localStorage.removeItem(PENDING_ORDER_KEY);
      
      // 예약 매입 서명 완료 시뮬레이션 이벤트 디스패치 (App.tsx 등에서 감지하여 화면 전환 처리)
      window.dispatchEvent(new CustomEvent('esignon-completed', { detail: orderData }));
    } catch (error) {
      console.error('Order error:', error);
      toast.error("주문 처리 중 오류가 발생했습니다.");
    } finally {
      isSubmittingRef.current = false;
    }
  };
};
