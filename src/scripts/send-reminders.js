import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SOLAPI_API_KEY = process.env.VITE_SOLAPI_API_KEY;
const SOLAPI_API_SECRET = process.env.VITE_SOLAPI_API_SECRET;
const SENDER_NUMBER = process.env.VITE_SOLAPI_SENDER_NUMBER;

if (!SUPABASE_URL || !SUPABASE_KEY || !SOLAPI_API_KEY || !SOLAPI_API_SECRET) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Solapi Helper (Node.js version) ---
async function sendSMS(to, text) {
    const date = new Date().toISOString().split('.')[0] + 'Z';
    const salt = crypto.randomBytes(16).toString('hex');
    const message = date + salt;

    const signature = crypto
        .createHmac('sha256', SOLAPI_API_SECRET)
        .update(message)
        .digest('hex');

    const authHeader = `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;

    try {
        const response = await fetch('https://api.solapi.com/messages/v4/send', {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: {
                    to,
                    from: SENDER_NUMBER || '01000000000',
                    text,
                },
                agent: {
                    sdkVersion: 'js/node-script',
                    osPlatform: 'node',
                }
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            console.error(`SMS Failed to ${to}:`, err);
            return false;
        }

        console.log(`SMS Sent to ${to}`);
        return true;
    } catch (error) {
        console.error(`SMS Error to ${to}:`, error);
        return false;
    }
}

// --- Main Logic ---
async function main() {
    console.log('Checking reservations...', new Date().toLocaleString());

    // 1. Get orders waiting for reservation
    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('status', '예약일정 대기중');

    if (error) {
        console.error('Supabase Error:', error);
        return;
    }

    console.log(`Found ${orders.length} waiting orders.`);

    // 2. Check dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const order of orders) {
        if (!order.expected_date) continue;

        const reserveDate = new Date(order.expected_date);
        reserveDate.setHours(0, 0, 0, 0);

        // Diff in days: (reserve - today) / msPerDay
        // D-1: reserve > today by 1 day
        // D-Day: reserve == today
        // Overdue: reserve < today
        const diffTime = reserveDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let message = '';

        if (diffDays === 1) {
            // D-1
            message = `[심플티켓] 내일(${order.expected_date})은 예약하신 상품권 판매일입니다. 잊지말고 준비해주세요!`;
        } else if (diffDays === 0) {
            // D-Day
            message = `[심플티켓] 오늘(${order.expected_date})은 예약하신 상품권 판매일입니다. 판매신청을 완료해주세요.`;
        } else if (diffDays < 0) {
            // Overdue
            const overdueDays = Math.abs(diffDays);
            message = `[심플티켓] 예약일이 ${overdueDays}일 지났습니다. 아직 판매하지 않으셨다면 서둘러주세요!`;
        }

        if (message) {
            console.log(`Sending reminder to ${order.name} (${order.phone}) - D${diffDays >= 0 ? '-' + diffDays : '+' + Math.abs(diffDays)}`);
            await sendSMS(order.phone, message);
        }
    }
}

main();
