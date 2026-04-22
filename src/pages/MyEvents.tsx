import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

interface EventSummary {
  id: string;
  title: string;
  duration: number;
  slots: string[];
  response_count: number;
  created_at: string;
}

export default function MyEvents() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const hostId = localStorage.getItem('scheduler_user_id');
  const hostName = localStorage.getItem('scheduler_user_name');

  useEffect(() => {
    if (!hostId) {
      navigate('/');
      return;
    }
    fetch(`/api/events?host_id=${encodeURIComponent(hostId)}`)
      .then(res => res.json())
      .then(data => setEvents(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [hostId]);

  if (loading) return <div className="text-center py-12 text-sm text-slate-400">読み込み中...</div>;

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">{hostName} さんのイベント</h2>
        <Link to="/" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
          新規作成
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-slate-400 mb-4">作成済みのイベントはありません</p>
          <Link
            to="/"
            className="inline-block bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors"
          >
            イベントを作成
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {events.map(event => (
            <li key={event.id}>
              <Link
                to={`/events/${event.id}`}
                className="block border border-slate-100 rounded-lg p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-800">{event.title}</span>
                  <span className="text-xs text-slate-400">
                    {event.response_count}人回答済
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  {event.slots.length}件の候補日程
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
