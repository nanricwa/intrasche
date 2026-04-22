import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Share2, Check } from 'lucide-react';
import { cn } from '../lib/utils';

type AvailabilityStatus = 'yes' | 'maybe' | 'no';

interface Event {
  id: string;
  title: string;
  description: string;
  host_name: string;
  slots: string[];
  responses: ResponseData[];
}

interface ResponseData {
  id: string;
  name: string;
  availabilities: Record<string, AvailabilityStatus>;
  comment: string;
}

export default function ViewEvent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState('');
  const [availabilities, setAvailabilities] = useState<Record<string, AvailabilityStatus>>({});
  const [comment, setComment] = useState('');

  useEffect(() => {
    fetchEvent();
  }, [id]);

  const fetchEvent = async () => {
    try {
      const res = await fetch(`/api/events/${id}`);
      if (res.ok) {
        const data = await res.json();

        const normalizedResponses = data.responses.map((r: any) => {
          const avails = r.availabilities;
          const normalized: Record<string, AvailabilityStatus> = {};
          Object.keys(avails).forEach(k => {
            if (typeof avails[k] === 'string') {
              normalized[k] = avails[k] as AvailabilityStatus;
            } else {
              normalized[k] = avails[k].status as AvailabilityStatus;
            }
          });
          return { ...r, availabilities: normalized };
        });

        setEvent({ ...data, responses: normalizedResponses });

        const initialAvails: Record<string, AvailabilityStatus> = {};
        data.slots.forEach((slot: string) => {
          initialAvails[slot] = 'yes';
        });
        setAvailabilities(initialAvails);
      } else {
        navigate('/');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !event) return;

    try {
      const res = await fetch(`/api/events/${id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: Math.random().toString(36).substring(2, 10),
          name,
          availabilities,
          comment
        })
      });

      if (res.ok) {
        setName('');
        setComment('');
        fetchEvent();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const statusIcon = (val: AvailabilityStatus) => {
    switch (val) {
      case 'yes': return <span className="text-green-600 font-bold text-lg">◯</span>;
      case 'maybe': return <span className="text-amber-500 font-bold text-lg">△</span>;
      case 'no': return <span className="text-red-400 font-bold text-lg">×</span>;
    }
  };

  if (loading) return <div className="text-center py-12 text-sm text-slate-400">読み込み中...</div>;
  if (!event) return <div className="text-center py-12 text-sm text-slate-400">イベントが見つかりません</div>;

  // Count yes per slot
  const yesCounts: Record<string, number> = {};
  event.slots.forEach(slot => {
    yesCounts[slot] = event.responses.filter(r => r.availabilities[slot] === 'yes').length;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex justify-between items-start mb-2">
          <h1 className="text-2xl font-semibold text-slate-800">{event.title}</h1>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Share2 className="w-3.5 h-3.5" />}
            {copied ? 'コピー済' : '共有'}
          </button>
        </div>
        <p className="text-sm text-slate-500">主催: {event.host_name}</p>
        {event.description && (
          <p className="text-sm text-slate-500 mt-1 whitespace-pre-wrap">{event.description}</p>
        )}
      </div>

      {/* 出欠表 */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-sm font-medium text-slate-700">
          出欠表
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-3 py-2 text-left text-slate-600 font-medium sticky left-0 bg-slate-50 min-w-[140px]">日程</th>
                {event.responses.map(r => (
                  <th key={r.id} className="px-3 py-2 text-center text-slate-600 font-medium min-w-[70px]">{r.name}</th>
                ))}
                <th className="px-3 py-2 text-center text-slate-600 font-medium min-w-[50px]">◯</th>
              </tr>
            </thead>
            <tbody>
              {event.slots.map(slot => {
                const yesCount = yesCounts[slot];
                const maxYes = Math.max(...Object.values(yesCounts), 0);
                const isBest = event.responses.length > 0 && yesCount === maxYes && yesCount > 0;

                return (
                  <tr key={slot} className={cn("border-b border-slate-100", isBest && "bg-green-50/60")}>
                    <td className={cn("px-3 py-2.5 text-slate-700 font-medium sticky left-0", isBest ? "bg-green-50/60" : "bg-white")}>
                      {slot}
                    </td>
                    {event.responses.map(r => (
                      <td key={r.id} className="px-3 py-2.5 text-center">
                        {statusIcon(r.availabilities[slot])}
                      </td>
                    ))}
                    <td className={cn("px-3 py-2.5 text-center font-bold", isBest ? "text-green-600" : "text-slate-500")}>
                      {yesCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {event.responses.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-400">まだ回答がありません</div>
        )}

        {/* コメント */}
        {event.responses.some(r => r.comment) && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 space-y-1.5">
            <div className="text-xs font-medium text-slate-500 mb-1">コメント</div>
            {event.responses.filter(r => r.comment).map(r => (
              <div key={r.id} className="text-xs text-slate-600">
                <span className="font-medium">{r.name}:</span> {r.comment}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 出欠入力フォーム */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-sm font-medium text-slate-700">
          出欠を入力する
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">お名前</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-slate-400 focus:border-slate-400 outline-none"
              placeholder="山田 太郎"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-2">日程の選択</label>
            <div className="space-y-1">
              {event.slots.map(slot => (
                <div key={slot} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                  <span className="text-sm">{slot}</span>
                  <div className="flex gap-1">
                    {(['yes', 'maybe', 'no'] as const).map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAvailabilities(prev => ({ ...prev, [slot]: val }))}
                        className={cn(
                          "w-9 h-9 rounded text-base font-bold transition-colors",
                          availabilities[slot] === val
                            ? (val === 'yes' ? 'bg-green-100 text-green-700' : val === 'maybe' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-500')
                            : "text-slate-300 hover:bg-slate-100"
                        )}
                      >
                        {val === 'yes' ? '◯' : val === 'maybe' ? '△' : '×'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1">コメント（任意）</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-slate-400 focus:border-slate-400 outline-none min-h-[60px]"
              placeholder="遅れて参加します等"
            />
          </div>

          <button
            type="submit"
            disabled={!name}
            className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors"
          >
            出欠を入力する
          </button>
        </form>
      </div>
    </div>
  );
}
