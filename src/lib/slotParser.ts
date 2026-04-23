// スロット文字列 ("4/25(金) 19:00〜20:00" など) を日時成分にパースする

export interface ParsedSlot {
  date: Date;
  startTime?: string; // "HH:MM"
  endTime?: string;   // "HH:MM"
}

const SLOT_RE = /^(\d{1,2})\/(\d{1,2})(?:\([^)]*\))?(?:\s+(\d{1,2}:\d{2})(?:\s*[〜~\-–]\s*(\d{1,2}:\d{2}))?)?$/;

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseSlot(raw: string): ParsedSlot | null {
  const s = raw.trim();
  const m = s.match(SLOT_RE);
  if (!m) return null;

  const month = parseInt(m[1], 10);
  const day = parseInt(m[2], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // 年は未記載なので推定: 今日以降 (-30 日より前は翌年)
  const today = new Date();
  const thisYear = today.getFullYear();
  let candidate = new Date(thisYear, month - 1, day);
  const threshold = today.getTime() - 30 * DAY_MS;
  if (candidate.getTime() < threshold) {
    candidate = new Date(thisYear + 1, month - 1, day);
  }

  return {
    date: candidate,
    startTime: m[3],
    endTime: m[4],
  };
}
