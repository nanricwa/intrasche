import { useCallback, useEffect, useState } from 'react';
import { listCalendars, GoogleAuthError, type CalendarListEntry } from './googleCalendar';

export const READ_CALENDARS_KEY = 'scheduler_calendar_read_ids';
export const WRITE_CALENDAR_KEY = 'scheduler_calendar_write_id';

function loadReadSelection(): string[] | null {
  try {
    const raw = localStorage.getItem(READ_CALENDARS_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(v => typeof v === 'string') : null;
  } catch {
    return null;
  }
}

export function saveReadSelection(ids: string[]): void {
  localStorage.setItem(READ_CALENDARS_KEY, JSON.stringify(ids));
}

export function loadWriteCalendarId(): string {
  return localStorage.getItem(WRITE_CALENDAR_KEY) || 'primary';
}

export function saveWriteCalendarId(id: string): void {
  localStorage.setItem(WRITE_CALENDAR_KEY, id);
}

export type ListState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; calendars: CalendarListEntry[] }
  | { kind: 'auth' }
  | { kind: 'error'; message: string };

/**
 * カレンダーリスト取得とデフォルト選択補正。
 * - readIds が未保存なら、サーバが selected:true を返したカレンダー (既定) を初期値にする
 * - どれも selected でないなら primary だけ
 */
export function useCalendarList(enabled: boolean): {
  state: ListState;
  reload: () => void;
  readIds: string[];
  setReadIds: (ids: string[]) => void;
} {
  const [state, setState] = useState<ListState>({ kind: 'idle' });
  const [readIds, setReadIdsState] = useState<string[]>(() => loadReadSelection() ?? []);

  const load = useCallback(() => {
    if (!enabled) {
      setState({ kind: 'idle' });
      return;
    }
    setState({ kind: 'loading' });
    listCalendars()
      .then(cals => {
        setState({ kind: 'ok', calendars: cals });
        // 初回 (ユーザーが未選択) の場合のみデフォルト設定
        if (loadReadSelection() === null) {
          const defaults = cals.filter(c => c.selected || c.primary).map(c => c.id);
          const fallback = defaults.length > 0 ? defaults : (cals.find(c => c.primary) ? ['primary'] : []);
          setReadIdsState(fallback);
          saveReadSelection(fallback);
        }
      })
      .catch(err => {
        if (err instanceof GoogleAuthError) setState({ kind: 'auth' });
        else setState({ kind: 'error', message: err?.message ?? 'カレンダー一覧の取得に失敗しました' });
      });
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const setReadIds = useCallback((ids: string[]) => {
    setReadIdsState(ids);
    saveReadSelection(ids);
  }, []);

  return { state, reload: load, readIds, setReadIds };
}
