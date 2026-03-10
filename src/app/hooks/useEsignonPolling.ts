import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export const PENDING_ORDER_KEY = 'pendingEsignonOrder';

export const useEsignonPolling = () => {
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const saved = localStorage.getItem(PENDING_ORDER_KEY);
        if (!saved) return;

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
          localStorage.removeItem(PENDING_ORDER_KEY);
          window.dispatchEvent(new CustomEvent('esignon-completed'));
        }
      } catch (e) {
        console.error("Global esignon polling error:", e);
      }
    };

    checkIntervalRef.current = setInterval(checkStatus, 3000);

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, []);
};
