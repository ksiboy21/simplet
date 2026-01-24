/**
 * SIMULATION Script for SimpleTicket SMS
 * Fixed Date: 2026-01-29 09:00:00 KST
 * Run with: node src/scripts/simulate-date.js
 */

// 1. Set Simulated Today (server time doesn't matter, we force this)
const SIMULATED_NOW_STRING = '2026-01-29T09:00:00+09:00';
const simulatedNow = new Date(SIMULATED_NOW_STRING);

// Calculate "Today Midnight" based on simulated now
const todayMidnight = new Date(simulatedNow);
todayMidnight.setHours(0, 0, 0, 0);

console.log(`[Simulation] Current Time set to: ${simulatedNow.toLocaleString()}`);
console.log(`[Simulation] Midnight (00:00) is: ${todayMidnight.toLocaleString()}`);
console.log("-".repeat(80));

// 2. Define Test Scenarios relative to this fixed date
const scenarios = [
    { name: "Reservation on Jan 30 (D-1)", date: "2026-01-30", expected: "SEND (D-1)" },
    { name: "Reservation on Jan 29 (D-Day)", date: "2026-01-29", expected: "SEND (D-Day)" },
    { name: "Reservation on Jan 28 (Overdue 1)", date: "2026-01-28", expected: "SEND (Overdue)" },
    { name: "Reservation on Jan 20 (Overdue > 7)", date: "2026-01-20", expected: "SKIP (Overdue 9d)" },
];

console.log(String("Scenario").padEnd(30) + String("Target Date").padEnd(15) + String("DiffDays").padEnd(10) + String("Result").padEnd(20));
console.log("-".repeat(80));

// 3. Run Logic
scenarios.forEach(sc => {
    // Parse target date (YYYY-MM-DD to Local Midnight)
    const [y, m, d] = sc.date.split('-').map(Number);
    const targetDate = new Date(y, m - 1, d); // Treated as local date (00:00)

    // Calculate Diff
    const diffTime = targetDate.getTime() - todayMidnight.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    // Determine Action
    let action = "SKIP";
    let desc = "";

    if (diffDays === 1) {
        action = "SEND SMS";
        desc = "D-1 (Tomorrow)";
    } else if (diffDays === 0) {
        action = "SEND SMS";
        desc = "D-Day (Today)";
    } else if (diffDays < 0) {
        const overdue = Math.abs(diffDays);
        if (overdue <= 7) {
            action = "SEND SMS";
            desc = `Overdue ${overdue}d (Daily)`;
        } else if (overdue % 7 === 0) {
            action = "SEND SMS";
            desc = `Overdue ${overdue}d (Weekly)`;
        } else {
            action = "SKIP";
            desc = `Overdue ${overdue}d (Wait)`;
        }
    } else {
        action = "SKIP";
        desc = `Future ${diffDays}d`;
    }

    console.log(
        `${sc.name.padEnd(30)} ${sc.date.padEnd(15)} ${String(diffDays).padEnd(10)} ${action.padEnd(10)} (${desc})`
    );
});
console.log("-".repeat(80));
