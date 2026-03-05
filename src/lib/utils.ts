import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 오늘 날짜 기반으로 6자리 확인코드 생성 (매일 자동 변경)
export function generateDailyCode(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const seed = y * 10000 + m * 100 + d;
  const code = ((seed * 1234567 + 7654321) % 1000000 + 1000000) % 1000000;
  return String(code).padStart(6, '0');
}
