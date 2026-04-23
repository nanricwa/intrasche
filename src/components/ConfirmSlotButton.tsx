import { useState } from 'react';
import { parseSlot } from '../lib/slotParser';
import { buildEventTimes } from '../lib/googleTime';
import { insertEvent, GoogleAuthError } from '../lib/googleCalendar';

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
  | { kind: 'success'; htmlLink?: string }
  | { kind: 'auth' }
  | { kind: 'error'; message: string };

export default function ConfirmSlotButton({ slot, eventTitle, description, onReauth }: Props) {
  const parsed = parseSlot(slot);
  const [state, setState] = useState<ButtonState>({ kind: 'idle' });

  if (!parsed) return null;

  const submit = async () => {
    setState({ kind: 'submitting' });
    try {
      const times = buildEventTimes(parsed);
      const inserted = await insertEvent({
        summary: eventTitle,
        description,
        start: times.start,
        end: times.end,
      });
      setState({ kind: 'success', htmlLink: inserted.htmlLink });
      setTimeout(() => setState({ kind: 'idle' }), 5000);
    } catch (err: any) {
      if (err instanceof GoogleAuthError) {
        setState({ kind: 'auth' });
      } else {
        setState({ kind: 'error', message: err?.message ?? 'Google Calendar への登録に失敗しました' });
      }
    }
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
        Googleカレンダーに追加しました
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
