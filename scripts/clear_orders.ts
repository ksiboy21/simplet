
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://azrkfvmvlqodeovktvyw.supabase.co';
const supabaseAnonKey = 'sb_publishable_kLx07AKgvmwHMlNVMdNvHw_M9t2kp25';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function clearOrders() {
    console.log('Clearing orders...');
    const { error } = await supabase
        .from('orders')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Valid UUID format to match all not-null IDs

    if (error) {
        console.error('Error clearing orders:', error);
    } else {
        console.log('All orders cleared successfully.');
    }
}

clearOrders();
