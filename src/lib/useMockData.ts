import { useState, useEffect, useCallback } from 'react';
import { db, Order, Rate, GetOrdersParams, TermItem } from './supabase';

// Helper type for Terms object structure used in frontend
export interface TermsState {
  reserve: { privacy: string; privacyTitle: string; responsibility: string; responsibilityTitle: string; items?: TermItem[] };
  instant: { privacy: string; privacyTitle: string; responsibility: string; responsibilityTitle: string; };
  submission: { privacy: string; privacyTitle: string; responsibility: string; responsibilityTitle: string; };
}

export const useOrders = (params: GetOrdersParams = {}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // params가 객체이므로 JSON.stringify 등으로 비교하거나, 
  // 컴포넌트에서 useMemo로 감싸서 전달한다고 가정.
  // 여기서는 params의 개별 필드를 의존성에 넣거나, params 자체가 바뀔 때마다 fetch.

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data, count } = await db.getOrders(params);
      setOrders(data);
      setTotalCount(count);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }, [params.page, params.limit, params.status, params.search]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const updateOrder = async (id: string, updates: Partial<Order>) => {
    try {
      await db.updateOrder(id, updates);
      await fetchOrders();
    } catch (error) {
      console.error('Error updating order:', error);
      toastError('주문 상태 변경 실패');
    }
  };

  return { orders, totalCount, updateOrder, loading, refetch: fetchOrders };
};

export const useUserOrders = (phone?: string) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    if (!phone) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      const data = await db.getUserOrders(phone);

      setOrders(data);
    } catch (error) {
      console.error('Error fetching user orders:', error);
    } finally {
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const updateOrder = async (id: string, updates: Partial<Order>) => {
    try {
      await db.updateOrder(id, updates);
      await fetchOrders();
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  const addOrder = async (order: Partial<Order>) => {
    try {
      await db.addOrder(order);
      await fetchOrders();
    } catch (error) {
      console.error('Error adding order:', error);
      throw error;
    }
  };

  return { orders, updateOrder, addOrder, loading, refetch: fetchOrders };
};

export const useRates = () => {
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRates = useCallback(async () => {
    try {
      const data = await db.getRates();
      setRates(data);
    } catch (error) {
      console.error('Error fetching rates:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  const updateRate = async (id: number, newRate: number) => {
    try {
      await db.updateRate(id, newRate);
      await fetchRates();
    } catch (error) {
      console.error('Error updating rate:', error);
    }
  };

  return { rates, updateRate, loading, refetch: fetchRates };
};

export const useTerms = () => {
  const [terms, setTerms] = useState<TermsState>({
    reserve: { privacy: '', privacyTitle: '', responsibility: '', responsibilityTitle: '', items: [] },
    instant: { privacy: '', privacyTitle: '', responsibility: '', responsibilityTitle: '' },
    submission: { privacy: '', privacyTitle: '', responsibility: '', responsibilityTitle: '' },
  });
  const [loading, setLoading] = useState(true);

  const fetchTerms = useCallback(async () => {
    try {
      const data = await db.getTerms();
      setTerms(prev => ({ ...prev, ...data }));
    } catch (error) {
      console.error('Error fetching terms:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTerms();
  }, [fetchTerms]);

  const updateTerms = async (newTerms: TermsState) => {
    try {
      await Promise.all([
        db.updateTerms('reserve', newTerms.reserve),
        db.updateTerms('instant', newTerms.instant),
        db.updateTerms('submission', newTerms.submission),
      ]);
      await fetchTerms();
    } catch (error) {
      console.error('Error updating terms:', error);
    }
  };

  return { terms, updateTerms, loading, refetch: fetchTerms };
};

function toastError(msg: string) {
  console.error(msg);
}

export type { Order, Rate } from './supabase';
export type { TermsState as Terms };
