// Google Calendar API ラッパー

import { dayBounds, CAL_TIME_ZONE } from './googleTime';

const API_ROOT = 'https://www.googleapis.com/calendar/v3';
const eventsEndpoint = (calendarId: string) =>
  `${API_ROOT}/calendars/${encodeURIComponent(calendarId)}/events`;

export class GoogleAuthError extends Error {
  constructor(message = '認証が切れています') {
    super(message);
    this.name = 'GoogleAuthError';
  }
}

export interface CalendarEvent {
  id: string;
  summary?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  htmlLink?: string;
  calendarId?: string;    // どのカレンダーから取得したか (集計時の識別用)
  calendarColor?: string; // カレンダー色 (UI 上のドット)
}

export interface CalendarListEntry {
  id: string;
  summary: string;
  primary?: boolean;
  accessRole: 'owner' | 'writer' | 'reader' | 'freeBusyReader';
  backgroundColor?: string;
  foregroundColor?: string;
  selected?: boolean;
}

function getToken(): string {
  const t = localStorage.getItem('scheduler_google_token');
  if (!t) throw new GoogleAuthError('ログインが必要です');
  return t;
}

async function checkAuth(res: Response): Promise<void> {
  if (res.status === 401 || res.status === 403) {
    throw new GoogleAuthError();
  }
}

export async function listCalendars(): Promise<CalendarListEntry[]> {
  const token = getToken();
  const res = await fetch(`${API_ROOT}/users/me/calendarList?minAccessRole=reader`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await checkAuth(res);
  if (!res.ok) throw new Error(`Calendar API error (HTTP ${res.status})`);
  const data = await res.json();
  return (data.items ?? []) as CalendarListEntry[];
}

async function listEventsForCalendar(
  calendarId: string,
  date: Date,
  color?: string
): Promise<CalendarEvent[]> {
  const token = getToken();
  const { timeMin, timeMax } = dayBounds(date);
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });
  const res = await fetch(`${eventsEndpoint(calendarId)}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await checkAuth(res);
  if (!res.ok) throw new Error(`Calendar API error (HTTP ${res.status})`);
  const data = await res.json();
  return ((data.items ?? []) as CalendarEvent[]).map(ev => ({
    ...ev,
    calendarId,
    calendarColor: color,
  }));
}

export async function listEventsForDay(
  date: Date,
  calendars: Array<{ id: string; color?: string }> = [{ id: 'primary' }]
): Promise<CalendarEvent[]> {
  if (calendars.length === 0) return [];
  // 各カレンダーは並列取得。1 つでも GoogleAuthError なら全体を投げる
  const results = await Promise.all(
    calendars.map(cal => listEventsForCalendar(cal.id, date, cal.color))
  );
  const all = results.flat();
  // 開始時刻昇順に並び替え (終日は先頭)
  return all.sort((a, b) => {
    const ak = a.start?.date ?? a.start?.dateTime ?? '';
    const bk = b.start?.date ?? b.start?.dateTime ?? '';
    return ak.localeCompare(bk);
  });
}

export interface InsertEventInput {
  summary: string;
  description?: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
}

export async function insertEvent(
  input: InsertEventInput,
  calendarId: string = 'primary'
): Promise<CalendarEvent> {
  const token = getToken();
  const body = {
    summary: input.summary,
    description: input.description,
    start: input.start.dateTime
      ? { ...input.start, timeZone: input.start.timeZone ?? CAL_TIME_ZONE }
      : input.start,
    end: input.end.dateTime
      ? { ...input.end, timeZone: input.end.timeZone ?? CAL_TIME_ZONE }
      : input.end,
  };
  const res = await fetch(eventsEndpoint(calendarId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  await checkAuth(res);
  if (!res.ok) throw new Error(`Calendar API error (HTTP ${res.status})`);
  return (await res.json()) as CalendarEvent;
}
