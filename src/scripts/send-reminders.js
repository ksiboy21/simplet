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
const SITE_URL = "https://simpleticket.co.kr"; // Update with actual domain

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
    let kstTime;
    const dateArg = process.argv[2]; // Expecting YYYY-MM-DD

    if (dateArg) {
        // override mode
        console.log(`[OVERRIDE] ⚠️ Simulating date: ${dateArg} (Real SMS will be sent)`);
        // Assume 9AM KST on that day
        kstTime = new Date(`${dateArg}T09:00:00+09:00`);
    } else {
        // Use KST (UTC+9) for Today
        const now = new Date();
        const kstOffset = 9 * 60; // 9 hours in minutes
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        kstTime = new Date(utc + (kstOffset * 60000));
    }

    console.log('Checking reservations (KST)...', kstTime.toLocaleString());

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

    // 2. Check dates (KST)
    const today = new Date(kstTime);
    today.setHours(0, 0, 0, 0);

    for (const order of orders) {
        if (!order.expected_date) continue;

        // Parse YYYY-MM-DD string to Local Midnight Date object
        const [y, m, d] = order.expected_date.split('-').map(Number);
        const reserveDate = new Date(y, m - 1, d);

        // Diff in days: (reserve - today) / msPerDay
        // D-1: reserve > today by 1 day
        // D-Day: reserve == today
        // Overdue: reserve < today

        // Use Math.round to handle potential DST minor offsets, though setHours(0) minimizes this.
        const diffTime = reserveDate.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        let message = '';

        if (diffDays === 1) {
            // D-1
            message = `안녕하세요, ${order.applicant_name}님. 내일은 약정하신 날입니다.\n원활한 진행을 위해 신청 내역을 미리 확인해 주세요.\n${SITE_URL}`;
        } else if (diffDays === 0) {
            // D-Day
            message = `안녕하세요, ${order.applicant_name}님. 오늘은 약정하신 날입니다.\n아래 링크를 통해 약정하신 상품권을 첨부해 주시면 신속히 처리해 드리겠습니다. 감사합니다.\n${SITE_URL}`;
        } else if (diffDays < 0) {
            // Overdue
            const overdueDays = Math.abs(diffDays);

            // Logic: Daily for first 7 days, then Weekly
            let shouldSend = false;
            if (overdueDays <= 7) {
                shouldSend = true;
                message = `안녕하세요, ${order.applicant_name}님. 약정하신 상품권이 아직 첨부되지 않았습니다.\n지속적인 미이행 시, 이용 약관에 따라 더치트 등록 및 민·형사상 법적 절차가 진행될 수 있음을 엄중히 안내드립니다. 조속한 이행 부탁드립니다.`;
            } else if (overdueDays % 7 === 0) {
                shouldSend = true;
                message = `안녕하세요, ${order.applicant_name}님. 현재 귀하의 계약 불이행으로 인해 법적 조치 중입니다.\n형사 고소와 별개로, 본 계약 의무 불이행으로 발생하는 채권추심 및 민사 소송 비용(송달료, 인지대, 변호사 보수 등) 일체는 판매자인 귀하의 전액 부담으로 청구됩니다. 더 큰 불이익이 발생하기 전에 해결하시기 바랍니다.`;
            }
        }


        if (message) {
            console.log(`Sending reminder to ${order.name} (${order.phone}) - D${diffDays >= 0 ? '-' + diffDays : '+' + Math.abs(diffDays)}`);
            await sendSMS(order.phone, message);
        }
    }
}

main();
