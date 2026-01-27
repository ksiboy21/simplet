import { createClient } from '@supabase/supabase-js';
import { compressImage } from './imageCompression';

const supabaseUrl = 'https://azrkfvmvlqodeovktvyw.supabase.co';
const supabaseAnonKey = 'sb_publishable_kLx07AKgvmwHMlNVMdNvHw_M9t2kp25';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- Database Types (Matching SQL Schema) ---

export type OrderType = 'instant' | 'reserve' | 'submission';
export type OrderStatus = '주문 확인중' | '예약일정 대기중' | '완료' | '반려';

export interface Order {
    id: string; // UUID
    type: OrderType;
    status: OrderStatus;
    name: string;
    amount: number;
    rate: number;

    // Applicant Info
    phone: string;
    applicant_name?: string;
    email?: string;

    // Financial Info
    bank_name?: string;
    account_number?: string;

    // Reserve specific
    deposit?: number;
    expected_date?: string; // YYYY-MM-DD
    is_offset?: boolean;

    // Images (Paths)
    voucher_images?: string[];
    id_card_image?: string;
    bank_book_image?: string;

    // Agreements
    term_agreements?: { id: string; title: string; agreedAt: string }[];

    created_at: string;
    updated_at: string;

    // Virtual field for frontend convenience (optional)
    is_my_order?: boolean;
}

export interface Rate {
    id: number;
    type: 'instant' | 'reserve';
    name: string;
    rate: number;
    active: boolean;
}

export interface TermItem {
    id: string;
    title: string;
    content: string;
    required: boolean;
}

export interface Terms {
    type: string;
    privacy: string;
    privacy_title: string;
    responsibility: string;
    responsibility_title: string;
    items?: TermItem[];
}

// --- Helper Functions ---

export interface GetOrdersParams {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
}

export const db = {
    // Orders
    async getOrders({ page = 1, limit = 10, status, search }: GetOrdersParams = {}) {
        let query = supabase
            .from('orders')
            .select('*', { count: 'exact' });

        // Filter by Status
        if (status && status !== '전체') {
            query = query.eq('status', status);
        }

        // Search (Name or Phone)
        if (search) {
            // Using ilike for case-insensitive search
            query = query.or(`applicant_name.ilike.%${search}%,phone.ilike.%${search}%,name.ilike.%${search}%`);
        }

        // Pagination
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;
        return { data: data as Order[], count: count || 0 };
    },

    async getUserOrders(phone?: string) {
        let query = supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (phone) {
            query = query.eq('phone', phone);
        }

        const { data, error } = await query;
        if (error) throw error;

        return (data as Order[]).map(o => ({ ...o, is_my_order: true }));
    },

    async addOrder(order: Partial<Order>) {
        const { is_my_order, id, created_at, updated_at, ...payload } = order;

        const { data, error } = await supabase
            .from('orders')
            .insert([payload])
            .select()
            .single();

        if (error) throw error;
        return data as Order;
    },

    async updateOrder(id: string, updates: Partial<Order>) {
        const { data, error } = await supabase
            .from('orders')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Order;
    },

    async deleteOrder(id: string) {
        const { error } = await supabase
            .from('orders')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async hasActiveReservations() {
        const { count, error } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('type', 'reserve')
            .in('status', ['주문 확인중', '예약일정 대기중']);

        if (error) throw error;
        return (count || 0) > 0;
    },

    // Rates
    async getRates() {
        const { data, error } = await supabase
            .from('rates')
            .select('*')
            .order('id', { ascending: true });
        if (error) throw error;
        return data as Rate[];
    },

    async updateRate(id: number, newRate: number) {
        const { data, error } = await supabase
            .from('rates')
            .update({ rate: newRate, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as Rate;
    },

    // Terms
    async getTerms() {
        const { data, error } = await supabase.from('terms').select('*');
        if (error) throw error;

        const termsObj: any = {};
        data.forEach((t: any) => {
            termsObj[t.type] = {
                privacy: t.privacy,
                privacyTitle: t.privacy_title,
                responsibility: t.responsibility,
                responsibilityTitle: t.responsibility_title,
                items: t.items || [] // Map the JSONB column
            };
        });
        return termsObj;
    },

    async updateTerms(type: string, updates: { privacy?: string; privacyTitle?: string; responsibility?: string; responsibilityTitle?: string; items?: TermItem[] }) {
        // Map camelCase to snake_case for DB
        const dbUpdates: any = {};
        if (updates.privacy !== undefined) dbUpdates.privacy = updates.privacy;
        if (updates.privacyTitle !== undefined) dbUpdates.privacy_title = updates.privacyTitle;
        if (updates.responsibility !== undefined) dbUpdates.responsibility = updates.responsibility;
        if (updates.responsibilityTitle !== undefined) dbUpdates.responsibility_title = updates.responsibilityTitle;
        if (updates.items !== undefined) dbUpdates.items = updates.items; // New: handle items

        const { data, error } = await supabase
            .from('terms')
            .upsert({ type, ...dbUpdates, updated_at: new Date().toISOString() }, { onConflict: 'type' })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // Admin Settings
    async getAdminSetting(key: string) {
        const { data, error } = await supabase
            .from('admin_settings')
            .select('value')
            .eq('key', key)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // Allow not found
        return data?.value || null;
    },

    async updateAdminSetting(key: string, value: string) {
        const { data, error } = await supabase
            .from('admin_settings')
            .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async uploadImage(file: File) {
        // Compress Image
        const compressedFile = await compressImage(file);

        const fileExt = compressedFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

        const { error } = await supabase.storage
            .from('attachments')
            .upload(fileName, compressedFile);

        if (error) throw error;

        const { data } = supabase.storage
            .from('attachments')
            .getPublicUrl(fileName);

        return data.publicUrl;
    }
};
