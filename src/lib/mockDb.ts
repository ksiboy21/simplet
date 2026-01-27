import { toast } from 'sonner';

export interface Order {
  id: string | number;
  name: string;
  amount: number;
  offset: boolean;
  status: string;
  date: string;
  phone?: string;
  type: string;
  rate?: number;
  isMyOrder?: boolean; // Flag to identify user's own orders for the demo
}

export interface Rate {
  id: number;
  name: string;
  rate: number;
  type: string;
  active: boolean;
}

export interface TermItem {
  id: string;
  title: string;
  content: string;
  required: boolean;
}

export interface TermSection {
  privacy: string;
  privacyTitle: string;
  responsibility: string;
  responsibilityTitle: string;
  items?: TermItem[];
}

export interface Terms {
  reserve: TermSection;
  instant: TermSection;
  submission: TermSection;
}

// Initial Mock Data
let rates: Rate[] = [
  { id: 1, name: '롯데 모바일 상품권', rate: 80, type: 'reserve', active: true },
  { id: 2, name: '신세계 모바일 상품권', rate: 90, type: 'instant', active: true },
  { id: 3, name: '신세계 지류 상품권', rate: 91, type: 'instant', active: true },
  { id: 4, name: '롯데 모바일 상품권', rate: 90, type: 'instant', active: true },
  { id: 5, name: '컬쳐랜드 상품권', rate: 88, type: 'instant', active: false },
];

let orders: Order[] = [];

let terms: Terms = {
  reserve: {
    privacyTitle: '개인정보 수집 및 이용 동의',
    privacy: '예약 판매 서비스 이용을 위한 개인정보 수집 및 이용 동의 내용입니다.',
    responsibilityTitle: '민형사상 책임 및 거래 약관 동의',
    responsibility: '정해진 예약일에 상품권 전송이 되지 않을시 민형사상의 모든 절차에 동의합니다',
  },
  instant: {
    privacyTitle: '개인정보 수집 및 이용 동의',
    privacy: '즉시 판매 서비스 이용을 위한 개인정보 수집 및 이용 동의 내용입니다.',
    responsibilityTitle: '민형사상 책임 및 거래 약관 동의',
    responsibility: '이미 사용된 상품권 또는 장물이나 보이스피싱등 불법자금과 연루된 경우 모든 법적책임은 판매자에게 있습니다',
  },
  submission: {
    privacyTitle: '개인정보 수집 및 이용 동의',
    privacy: '상품권 제출 서비스 이용을 위한 개인정보 수집 및 이용 동의 내용입니다.',
    responsibilityTitle: '민형사상 책임 및 거래 약관 동의',
    responsibility: '제출된 상품권에 문제가 있을 시 모든 책임은 본인에게 있습니다.',
  }
};

type Listener = () => void;
const listeners: Set<Listener> = new Set();

const notify = () => {
  listeners.forEach(l => l());
};

export const mockDb = {
  getOrders: () => [...orders],
  getRates: () => [...rates],
  getTerms: () => ({ ...terms }),

  getUserOrders: () => orders.filter(o => o.isMyOrder),

  updateOrder: (id: string | number, updates: Partial<Order>) => {
    orders = orders.map(o => o.id == id ? { ...o, ...updates } : o);
    notify();
  },

  addOrder: (order: Order) => {
    orders = [order, ...orders];
    notify();
  },

  updateRate: (id: number, newRate: number) => {
    rates = rates.map(r => r.id === id ? { ...r, rate: newRate } : r);
    notify();
  },

  updateTerms: (newTerms: Terms) => {
    terms = newTerms;
    notify();
  },

  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};
