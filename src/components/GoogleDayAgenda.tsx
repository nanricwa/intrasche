import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { listEventsForDay, GoogleAuthError, type CalendarEvent } from '../lib/googleCalendar';
import { useCalendarList } from '../lib/useCalendarList';

interface Props {
  date: Date | null;
  onReauth?: () => void;
}

type DayState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; events: CalendarEvent[] }
  | { kind: 'auth' }
  | { kind: 'error'; message: string };

function formatEventTime(ev: CalendarEvent): { time: string; allDay: boolean } {
  if (ev.start?.date) return { time: '終日', allDay: true };
  const s = ev.start?.dateTime;
  const e = ev.end?.dateTime;
  if (!s) return { time: '', allDay: false };
  const sDate = new Date(s);
  const eDate = e ? new Date(e) : null;
  const fmt = (d: Date) => format(d, 'HH:mm');
  return { time: eDate ? `${fmt(sDate)}–${fmt(eDate)}` : fmt(sDate), allDay: false };
}

export default function GoogleDayAgenda({ date, onReauth }: Props) {
  const cacheRef = useRef<Map<string, CalendarEvent[]>>(new Map());
  const [state, setState] = useState<DayState>({ kind: 'idle' });
  const [showPicker, setShowPicker] = useState(false);

  const calList = useCalendarList(true);

  // 選択中のカレンダー(id+color) 配列
  const selectedCalendars = useMemo(() => {
    if (calList.state.kind !== 'ok') return [] as Array<{ id: string; color?: string }>;
    const byId = new Map(calList.state.calendars.map(c => [c.id, c]));
    return calList.readIds
      .map(id => byId.get(id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map(c => ({ id: c.id, color: c.backgroundColor }));
  }, [calList.state, calList.readIds]);

  // キャッシュキー: 日付 + 選択カレンダー IDs
  const cacheKey = date
    ? `${format(date, 'yyyy-MM-dd')}|${calList.readIds.slice().sort().join(',')}`
    : null;

  useEffect(() => {
    if (!date || !cacheKey) {
      setState({ kind: 'idle' });
      return;
    }
    if (selectedCalendars.length === 0) {
      setState({ kind: 'ok', events: [] });
      return;
    }
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setState({ kind: 'ok', events: cached });
      return;
    }
    let cancelled = false;
    setState({ kind: 'loading' });
    listEventsForDay(date, selectedCalendars)
      .then(events => {
        if (cancelled) return;
        cacheRef.current.set(cacheKey, events);
        setState({ kind: 'ok', events });
      })
      .catch(err => {
        if (cancelled) return;
        if (err instanceof GoogleAuthError) setState({ kind: 'auth' });
        else setState({ kind: 'error', message: err?.message ?? '取得に失敗しました' });
      });
    return () => {
      cancelled = true;
    };
  }, [cacheKey]);

  const retry = () => {
    if (!cacheKey || !date) return;
    cacheRef.current.delete(cacheKey);
    setState({ kind: 'loading' });
    listEventsForDay(date, selectedCalendars)
      .then(events => {
        cacheRef.current.set(cacheKey, events);
        setState({ kind: 'ok', events });
      })
      .catch(err => {
        if (err instanceof GoogleAuthError) setState({ kind: 'auth' });
        else setState({ kind: 'error', message: err?.message ?? '取得に失敗しました' });
      });
  };

  const togglePick = (id: string) => {
    const next = calList.readIds.includes(id)
      ? calList.readIds.filter(x => x !== id)
      : [...calList.readIds, id];
    calList.setReadIds(next);
    // 選択変更で再フェッチさせるためキャッシュクリア (ID 配列が cacheKey に含まれるので古いキーは残るが問題なし)
  };

  const selectedCount = calList.readIds.length;
  const totalCount = calList.state.kind === 'ok' ? calList.state.calendars.length : 0;

  return (
    <div className="border-t border-slate-200 mt-3 pt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-slate-500">
          {date ? `${format(date, 'M/d(E)', { locale: ja })} の予定` : '予定'}
        </div>
        {calList.state.kind === 'ok' && (
          <button
            type="button"
            onClick={() => setShowPicker(v => !v)}
            className="text-[11px] text-slate-400 hover:text-slate-700 underline"
          >
            {showPicker ? '閉じる' : `カレンダー (${selectedCount}/${totalCount})`}
          </button>
        )}
      </div>

      {showPicker && calList.state.kind === 'ok' && (
        <div className="mb-2 max-h-40 overflow-y-auto border border-slate-100 rounded p-1 space-y-0.5">
          {calList.state.calendars.length === 0 ? (
            <p className="text-[11px] text-slate-400 px-1">カレンダーがありません</p>
          ) : (
            calList.state.calendars.map(c => (
              <label key={c.id} className="flex items-center gap-1.5 text-[11px] text-slate-700 hover:bg-slate-50 rounded px-1 py-0.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={calList.readIds.includes(c.id)}
                  onChange={() => togglePick(c.id)}
                  className="w-3 h-3"
                />
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: c.backgroundColor || '#94a3b8' }}
                  aria-hidden
                />
                <span className="truncate">{c.summary}{c.primary ? ' (メイン)' : ''}</span>
              </label>
            ))
          )}
        </div>
      )}

      {calList.state.kind === 'loading' && (
        <p className="text-xs text-slate-400">カレンダー一覧を取得中...</p>
      )}
      {calList.state.kind === 'auth' && (
        <div className="border border-red-200 bg-red-50 text-red-700 text-xs rounded p-2 space-y-1">
          <p>再ログインが必要です</p>
          {onReauth && (
            <button type="button" onClick={onReauth} className="text-red-700 underline hover:text-red-900">
              再ログイン
            </button>
          )}
        </div>
      )}

      {calList.state.kind === 'ok' && selectedCount === 0 && (
        <p className="text-[11px] text-slate-400">
          カレンダーが選択されていません。上の「カレンダー」から選択してください。
        </p>
      )}

      {state.kind === 'idle' && selectedCount > 0 && (
        <p className="text-xs text-slate-400">日付を選ぶとその日の予定が表示されます</p>
      )}
      {state.kind === 'loading' && <p className="text-xs text-slate-400">予定を取得中...</p>}
      {state.kind === 'ok' && selectedCount > 0 && state.events.length === 0 && (
        <p className="text-xs text-slate-400">この日は予定なし</p>
      )}
      {state.kind === 'ok' && state.events.length > 0 && (
        <ul className="space-y-1">
          {state.events.slice(0, 10).map(ev => {
            const { time, allDay } = formatEventTime(ev);
            return (
              <li key={`${ev.calendarId}-${ev.id}`} className="text-[11px] text-slate-600 truncate flex items-center gap-1">
                {ev.calendarColor && (
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: ev.calendarColor }}
                    aria-hidden
                  />
                )}
                {allDay ? (
                  <span className="inline-block bg-slate-100 text-slate-500 rounded px-1">終日</span>
                ) : (
                  <span className="text-slate-400">{time}</span>
                )}
                <span className="truncate">{ev.summary || '(無題)'}</span>
              </li>
            );
          })}
          {state.events.length > 10 && (
            <li className="text-[11px] text-slate-400">他 {state.events.length - 10} 件</li>
          )}
        </ul>
      )}
      {state.kind === 'auth' && (
        <div className="border border-red-200 bg-red-50 text-red-700 text-xs rounded p-2 space-y-1">
          <p>再ログインが必要です</p>
          {onReauth && (
            <button type="button" onClick={onReauth} className="text-red-700 underline hover:text-red-900">
              再ログイン
            </button>
          )}
        </div>
      )}
      {state.kind === 'error' && (
        <div className="border border-red-200 bg-red-50 text-red-700 text-xs rounded p-2 space-y-1">
          <p>取得に失敗しました</p>
          <button type="button" onClick={retry} className="text-red-700 underline hover:text-red-900">
            再試行
          </button>
        </div>
      )}
    </div>
  );
}
