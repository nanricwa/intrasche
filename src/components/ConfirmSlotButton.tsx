import { useCallback, useEffect, useState } from 'react';
import { parseSlot } from '../lib/slotParser';
import { buildEventTimes } from '../lib/googleTime';
import {
  insertEvent,
  listCalendars,
  GoogleAuthError,
  type CalendarListEntry,
} from '../lib/googleCalendar';
import { loadWriteCalendarId, saveWriteCalendarId } from '../lib/useCalendarList';
import { onAuthRefreshed } from '../lib/googleAuth';

interface Props {
  slot: string;
  eventTitle: string;
  description?: string;
  onReauth?: () => void;
}

type ButtonState =
  | { kind: 'idle' }
  | { kind: 'confirming' }
  | { kind: 'submitting' }
  | { kind: 'success'; htmlLink?: string; calendarSummary?: string }
  | { kind: 'auth' }
  | { kind: 'error'; message: string };

// 書き込み可能なカレンダーのみ (reader/freeBusyReader は除外)
function isWritable(c: CalendarListEntry): boolean {
  return c.accessRole === 'owner' || c.accessRole === 'writer';
}

export default function ConfirmSlotButton({ slot, eventTitle, description, onReauth }: Props) {
  const parsed = parseSlot(slot);
  const [state, setState] = useState<ButtonState>({ kind: 'idle' });
  const [calendars, setCalendars] = useState<CalendarListEntry[] | null>(null);
  const [targetId, setTargetId] = useState<string>(() => loadWriteCalendarId());

  const fetchCalendars = useCallback(() => {
    let cancelled = false;
    listCalendars()
      .then(cals => {
        if (cancelled) return;
        const writable = cals.filter(isWritable);
        setCalendars(writable);
        if (!writable.find(c => c.id === targetId)) {
          setTargetId('primary');
          saveWriteCalendarId('primary');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setCalendars([]); // セレクト非表示 (primary 固定)
      });
    return () => {
      cancelled = true;
    };
  // targetId を依存に入れるとループするので無視
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // 初回ロード (UX 優先でマウント時に取得、失敗時は primary のみにフォールバック)
    const cancel = fetchCalendars();
    return cancel;
  }, [fetchCalendars]);

  // 再ログインに成功したら auth 状態を抜けつつカレンダー一覧を再取得
  useEffect(() => {
    return onAuthRefreshed(() => {
      setState(prev => (prev.kind === 'auth' || prev.kind === 'error') ? { kind: 'idle' } : prev);
      fetchCalendars();
    });
  }, [fetchCalendars]);

  if (!parsed) return null;

  const submit = async () => {
    setState({ kind: 'submitting' });
    try {
      const times = buildEventTimes(parsed);
      const inserted = await insertEvent(
        { summary: eventTitle, description, start: times.start, end: times.end },
        targetId
      );
      const targetSummary = calendars?.find(c => c.id === targetId)?.summary;
      setState({
        kind: 'success',
        htmlLink: inserted.htmlLink,
        calendarSummary: targetId === 'primary' ? 'メイン' : targetSummary,
      });
      setTimeout(() => setState({ kind: 'idle' }), 5000);
    } catch (err: any) {
      if (err instanceof GoogleAuthError) {
        setState({ kind: 'auth' });
      } else {
        setState({ kind: 'error', message: err?.message ?? 'Google Calendar への登録に失敗しました' });
      }
    }
  };

  const onChangeTarget = (id: string) => {
    setTargetId(id);
    saveWriteCalendarId(id);
  };

  if (state.kind === 'idle') {
    return (
      <button
        type="button"
        onClick={() => setState({ kind: 'confirming' })}
        className="mt-1 text-[11px] text-slate-500 hover:text-slate-700 underline"
      >
        この日程で確定
      </button>
    );
  }

  if (state.kind === 'confirming') {
    return (
      <div className="mt-1 text-[11px] text-slate-600 space-y-1">
        <p>Googleカレンダーに追加しますか？</p>
        <p className="text-slate-400">(複数回押すと重複登録されます)</p>
        {calendars && calendars.length > 1 && (
          <label className="flex items-center gap-1">
            <span className="text-slate-500">登録先:</span>
            <select
              value={targetId}
              onChange={e => onChangeTarget(e.target.value)}
              className="border border-slate-200 rounded px-1 py-0.5 text-[11px] bg-white"
            >
              {calendars.map(c => (
                <option key={c.id} value={c.id}>
                  {c.summary}{c.primary ? ' (メイン)' : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={submit} className="text-slate-800 underline hover:text-slate-600">
            追加
          </button>
          <button
            type="button"
            onClick={() => setState({ kind: 'idle' })}
            className="text-slate-400 underline hover:text-slate-600"
          >
            キャンセル
          </button>
        </div>
      </div>
    );
  }

  if (state.kind === 'submitting') {
    return <span className="mt-1 block text-[11px] text-slate-400">追加中...</span>;
  }

  if (state.kind === 'success') {
    return (
      <div className="mt-1 text-[11px] text-green-700">
        {state.calendarSummary ? `「${state.calendarSummary}」に追加しました` : 'Googleカレンダーに追加しました'}
        {state.htmlLink && (
          <>
            {' — '}
            <a
              href={state.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-green-900"
            >
              開く
            </a>
          </>
        )}
      </div>
    );
  }

  if (state.kind === 'auth') {
    return (
      <div className="mt-1 text-[11px] text-red-700 space-y-1">
        <p>再ログインが必要です</p>
        {onReauth && (
          <button type="button" onClick={onReauth} className="underline hover:text-red-900">
            再ログイン
          </button>
        )}
        <button
          type="button"
          onClick={() => setState({ kind: 'idle' })}
          className="underline text-slate-400 hover:text-slate-600 ml-2"
        >
          閉じる
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1 text-[11px] text-red-700 space-y-1">
      <p>{state.message}</p>
      <button
        type="button"
        onClick={() => setState({ kind: 'idle' })}
        className="underline hover:text-red-900"
      >
        閉じる
      </button>
    </div>
  );
}
