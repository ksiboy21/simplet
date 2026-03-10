import { useEffect, useRef } from 'react';
import { db, supabase } from '@/lib/supabase';
import { sendSMS } from '@/lib/solapi';
import { toast } from 'sonner';

export const PENDING_ORDER_KEY = 'pendingEsignonOrder';

export const useEsignonPolling = () => {
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
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

        if (error) {
          console.error("Global esignon polling error:", error);
          return;
        }

        if (data?.isCanceled) {
          toast.error("전자서명이 취소 또는 거절되었습니다.");
          localStorage.removeItem(PENDING_ORDER_KEY);
          window.dispatchEvent(new CustomEvent('esignon-canceled'));
          return;
        }

        if (data?.isComplete) {
          isSubmittingRef.current = true;
          await submitOrder(orderData);
        }
      } catch (e) {
        console.error("Global esignon polling error:", e);
      }
    };

    checkIntervalRef.current = setInterval(checkStatus, 3000);

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, []); // 마운트 한 번만 실행 — addOrder 의존성 제거로 인터벌 리셋 방지

  const submitOrder = async (orderData: any) => {
    try {
      await db.addOrder(orderData); // useUserOrders 대신 db 직접 호출
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
      window.dispatchEvent(new CustomEvent('esignon-completed', { detail: orderData }));
    } catch (error) {
      console.error('Order error:', error);
      toast.error("주문 처리 중 오류가 발생했습니다.");
    } finally {
      isSubmittingRef.current = false;
    }
  };
};
