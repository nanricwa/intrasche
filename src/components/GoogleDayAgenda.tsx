import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { listEventsForDay, GoogleAuthError, type CalendarEvent } from '../lib/googleCalendar';

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

  const key = date ? format(date, 'yyyy-MM-dd') : null;

  useEffect(() => {
    if (!date || !key) {
      setState({ kind: 'idle' });
      return;
    }
    const cached = cacheRef.current.get(key);
    if (cached) {
      setState({ kind: 'ok', events: cached });
      return;
    }
    let cancelled = false;
    setState({ kind: 'loading' });
    listEventsForDay(date)
      .then(events => {
        if (cancelled) return;
        cacheRef.current.set(key, events);
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
  }, [key]); // key で dedupe (同じ日付の再指定は再フェッチしない)

  const retry = () => {
    if (!key) return;
    cacheRef.current.delete(key);
    setState({ kind: 'idle' });
    // 再実行は useEffect の依存が変わらないため手動で: フラグ切替の代わりに一度 idle → ロード再トリガー
    if (date) {
      setState({ kind: 'loading' });
      listEventsForDay(date)
        .then(events => {
          cacheRef.current.set(key, events);
          setState({ kind: 'ok', events });
        })
        .catch(err => {
          if (err instanceof GoogleAuthError) setState({ kind: 'auth' });
          else setState({ kind: 'error', message: err?.message ?? '取得に失敗しました' });
        });
    }
  };

  return (
    <div className="border-t border-slate-200 mt-3 pt-3">
      <div className="text-xs text-slate-500 mb-2">
        {date ? `${format(date, 'M/d(E)', { locale: ja })} の予定` : '予定'}
      </div>
      {state.kind === 'idle' && (
        <p className="text-xs text-slate-400">日付を選ぶとその日の予定が表示されます</p>
      )}
      {state.kind === 'loading' && <p className="text-xs text-slate-400">予定を取得中...</p>}
      {state.kind === 'ok' && state.events.length === 0 && (
        <p className="text-xs text-slate-400">この日は予定なし</p>
      )}
      {state.kind === 'ok' && state.events.length > 0 && (
        <ul className="space-y-1">
          {state.events.slice(0, 10).map(ev => {
            const { time, allDay } = formatEventTime(ev);
            return (
              <li key={ev.id} className="text-[11px] text-slate-600 truncate">
                {allDay ? (
                  <span className="inline-block bg-slate-100 text-slate-500 rounded px-1 mr-1">終日</span>
                ) : (
                  <span className="text-slate-400 mr-1">{time}</span>
                )}
                <span>{ev.summary || '(無題)'}</span>
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
            <button
              type="button"
              onClick={onReauth}
              className="text-red-700 underline hover:text-red-900"
            >
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
