// Google Calendar API 用の時間値生成ヘルパー
// TimeZone は Asia/Tokyo 固定 (本プロダクトの想定ユーザー向け)

import type { ParsedSlot } from './slotParser';

const TIME_ZONE = 'Asia/Tokyo';

// "YYYY-MM-DD" を JST ローカル日付として生成 (Date#getFullYear 等を使用)
function formatDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// JST のローカル時刻を表す ISO8601 (タイムゾーンオフセット +09:00)
function formatDateTimeJST(d: Date, hh: number, mm: number): string {
  const dateStr = formatDateOnly(d);
  const hhs = String(hh).padStart(2, '0');
  const mms = String(mm).padStart(2, '0');
  return `${dateStr}T${hhs}:${mms}:00+09:00`;
}

function parseHM(s: string): { h: number; m: number } {
  const [h, m] = s.split(':').map(v => parseInt(v, 10));
  return { h, m };
}

export interface EventTimes {
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
}

export function buildEventTimes(
  parsed: ParsedSlot,
  opts: { defaultDurationMin?: number } = {}
): EventTimes {
  const defaultDuration = opts.defaultDurationMin ?? 60;

  // 時刻なし → 終日イベント (Calendar API は end.date が翌日)
  if (!parsed.startTime) {
    const next = new Date(parsed.date);
    next.setDate(next.getDate() + 1);
    return {
      start: { date: formatDateOnly(parsed.date) },
      end: { date: formatDateOnly(next) },
    };
  }

  const start = parseHM(parsed.startTime);
  let endH: number;
  let endM: number;
  if (parsed.endTime) {
    const e = parseHM(parsed.endTime);
    endH = e.h;
    endM = e.m;
  } else {
    const total = start.h * 60 + start.m + defaultDuration;
    endH = Math.floor(total / 60);
    endM = total % 60;
  }

  return {
    start: { dateTime: formatDateTimeJST(parsed.date, start.h, start.m), timeZone: TIME_ZONE },
    end: { dateTime: formatDateTimeJST(parsed.date, endH, endM), timeZone: TIME_ZONE },
  };
}

export function dayBounds(date: Date): { timeMin: string; timeMax: string } {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return {
    timeMin: formatDateTimeJST(date, 0, 0),
    timeMax: formatDateTimeJST(next, 0, 0),
  };
}

export const CAL_TIME_ZONE = TIME_ZONE;
