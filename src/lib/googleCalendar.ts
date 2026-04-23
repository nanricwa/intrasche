// Google Calendar API ラッパー (primary カレンダーのみ対象)

import { dayBounds, CAL_TIME_ZONE } from './googleTime';

const BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

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

export async function listEventsForDay(date: Date): Promise<CalendarEvent[]> {
  const token = getToken();
  const { timeMin, timeMax } = dayBounds(date);
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });
  const res = await fetch(`${BASE}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await checkAuth(res);
  if (!res.ok) throw new Error(`Calendar API error (HTTP ${res.status})`);
  const data = await res.json();
  return (data.items ?? []) as CalendarEvent[];
}

export interface InsertEventInput {
  summary: string;
  description?: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
}

export async function insertEvent(input: InsertEventInput): Promise<CalendarEvent> {
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
  const res = await fetch(BASE, {
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
