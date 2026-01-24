/**
 * Logic Verification Script for SimpleTicket SMS
 * Run with: node src/scripts/verify-sms-logic.js
 */

// Use KST (UTC+9) for Today
const now = new Date();
const kstOffset = 9 * 60; // 9 hours in minutes
const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
const today = new Date(utc + (kstOffset * 60000));
today.setHours(0, 0, 0, 0);

console.log(`[Test] Today (KST) is: ${today.toLocaleString()}`);

// Helper to create a date N days from today
function getDateFromToday(diffDays) {
    const d = new Date(today);
    d.setDate(today.getDate() + diffDays);

    // safe format to YYYY-MM-DD
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Mock Orders with various scenarios
const testCases = [
    { label: "D-1 (Tomorrow)", offset: 1, expected: true },
    { label: "D-0 (Today)", offset: 0, expected: true },
    { label: "Overdue 1 Day", offset: -1, expected: true },
    { label: "Overdue 6 Days", offset: -6, expected: true },
    { label: "Overdue 7 Days", offset: -7, expected: true },
    { label: "Overdue 8 Days", offset: -8, expected: false }, // Week interval not hit (hit @ 7, next @ 14)
    { label: "Overdue 13 Days", offset: -13, expected: false },
    { label: "Overdue 14 Days", offset: -14, expected: true }, // 7 * 2
    { label: "Overdue 15 Days", offset: -15, expected: false },
    { label: "Future 2 Days", offset: 2, expected: false },
];

console.log("-".repeat(80));
console.log(String("Scenario").padEnd(20) + String("Date").padEnd(15) + String("DiffDays").padEnd(10) + String("Result").padEnd(10));
console.log("-".repeat(80));

testCases.forEach(test => {
    const reserveDateStr = getDateFromToday(test.offset);

    // --- Logic Component (Should match send-reminders.js) ---
    const [y, m, d] = reserveDateStr.split('-').map(Number);
    const reserveDate = new Date(y, m - 1, d);

    const diffTime = reserveDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    // --------------------------------------------------------

    let shouldSend = false;
    let logicDescription = "";

    if (diffDays === 1) {
        shouldSend = true;
        logicDescription = "D-1 (Tomorrow)";
    } else if (diffDays === 0) {
        shouldSend = true;
        logicDescription = "D-Day (Today)";
    } else if (diffDays < 0) {
        const overdueDays = Math.abs(diffDays);
        if (overdueDays <= 7) {
            shouldSend = true;
            logicDescription = `Overdue ${overdueDays}d (Daily)`;
        } else if (overdueDays % 7 === 0) {
            shouldSend = true;
            logicDescription = `Overdue ${overdueDays}d (Weekly)`;
        } else {
            logicDescription = `Overdue ${overdueDays}d (Skip)`;
        }
    } else {
        logicDescription = `Future ${diffDays}d (Wait)`;
    }

    const pass = shouldSend === test.expected;
    const resultIcon = pass ? "✅ PASS" : "❌ FAIL";
    const action = shouldSend ? "SEND SMS" : "SKIP";

    console.log(
        `${test.label.padEnd(20)} ${reserveDateStr.padEnd(15)} ${String(diffDays).padEnd(10)} ${action.padEnd(10)} ${resultIcon}  (${logicDescription})`
    );
});

console.log("-".repeat(80));
