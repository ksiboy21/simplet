
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function listOrders() {
    const { data, error } = await supabase
        .from('orders')
        .select('id, applicant_name, phone, expected_date, status')
        .eq('status', '예약일정 대기중')
        .eq('type', 'reserve');

    if (error) {
        console.error(error);
        return;
    }

    console.log('Active Reservations:', data);
}

listOrders();
