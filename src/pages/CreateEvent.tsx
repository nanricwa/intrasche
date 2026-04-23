import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isToday, isBefore, startOfToday } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useGoogleLogin } from '@react-oauth/google';

const googleClientId = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID || '';
const isGoogleEnabled = !!googleClientId;

function getOrCreateUserId(): string {
  let id = localStorage.getItem('scheduler_user_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('scheduler_user_id', id);
  }
  return id;
}

export default function CreateEvent() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [memo, setMemo] = useState('');
  const [candidatesText, setCandidatesText] = useState('');
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [startTime, setStartTime] = useState('19:00');
  const [duration, setDuration] = useState(60);

  const [hostName, setHostName] = useState('');
  const [userId, setUserId] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const savedName = localStorage.getItem('scheduler_user_name');
    const savedId = localStorage.getItem('scheduler_user_id');
    if (savedName && savedId) {
      setHostName(savedName);
      setUserId(savedId);
      setLoggedIn(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostName.trim()) return;
    const id = getOrCreateUserId();
    localStorage.setItem('scheduler_user_name', hostName.trim());
    setUserId(id);
    setLoggedIn(true);
  };

  // Googleログイン（Client ID設定時のみ有効）
  const googleLogin = isGoogleEnabled
    ? useGoogleLogin({
        scope: 'openid email profile https://www.googleapis.com/auth/calendar.readonly',
        onSuccess: async (tokenResponse) => {
          try {
            const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
            }).then(res => res.json());
            // Google の sub（永続的なユーザーID）を使う
            localStorage.setItem('scheduler_user_id', userInfo.sub);
            localStorage.setItem('scheduler_user_name', userInfo.name);
            localStorage.setItem('scheduler_user_email', userInfo.email);
            localStorage.setItem('scheduler_google_token', tokenResponse.access_token);
            setUserId(userInfo.sub);
            setHostName(userInfo.name);
            setLoggedIn(true);
          } catch (err) {
            console.error('Failed to fetch user info', err);
          }
        },
        onError: (err) => console.error('Google Login Failed:', err),
      })
    : null;

  const computeEndTime = (start: string, minutes: number): string => {
    const match = start.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return '';
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const total = h * 60 + m + minutes;
    const endH = Math.floor(total / 60) % 24;
    const endM = total % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  };

  const handleCalendarClick = (date: Date) => {
    const dateStr = format(date, 'M/d(E)', { locale: ja });
    let line = dateStr;
    if (startTime.trim()) {
      const end = computeEndTime(startTime.trim(), duration);
      line = end ? `${dateStr} ${startTime.trim()}〜${end}` : `${dateStr} ${startTime.trim()}`;
    }
    setCandidatesText(prev => prev ? `${prev}\n${line}` : line);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const slots = candidatesText.split('\n').map(s => s.trim()).filter(Boolean);
    if (!title || slots.length === 0 || !hostName || !userId) return;

    const eventId = Math.random().toString(36).substring(2, 10);

    setSubmitError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: eventId,
          title,
          description: memo,
          host_name: hostName,
          host_id: userId,
          slots
        })
      });

      if (res.ok) {
        navigate(`/events/${eventId}`);
        return;
      }
      setSubmitError(`送信に失敗しました (HTTP ${res.status})。時間をおいて再度お試しください。`);
    } catch (e) {
      console.error('Failed to create event', e);
      setSubmitError('ネットワークエラーが発生しました。接続を確認して再度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  // Calendar rendering
  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const today = startOfToday();

    const weeks: Date[][] = [];
    let day = calStart;
    while (day <= calEnd) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(day);
        day = addDays(day, 1);
      }
      weeks.push(week);
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 hover:bg-slate-100 rounded">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <span className="text-sm font-medium">{format(currentMonth, 'yyyy年M月')}</span>
          <button type="button" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:bg-slate-100 rounded">
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0 text-center text-xs">
          {['日', '月', '火', '水', '木', '金', '土'].map(d => (
            <div key={d} className={`py-1 font-medium ${d === '日' ? 'text-red-400' : d === '土' ? 'text-blue-400' : 'text-slate-500'}`}>{d}</div>
          ))}
          {weeks.flat().map((d, i) => {
            const inMonth = isSameMonth(d, currentMonth);
            const past = isBefore(d, today);
            const dayOfWeek = d.getDay();
            return (
              <button
                key={i}
                type="button"
                disabled={past || !inMonth}
                onClick={() => handleCalendarClick(d)}
                className={`py-1.5 text-xs rounded transition-colors ${
                  !inMonth ? 'text-slate-200' :
                  past ? 'text-slate-300 cursor-not-allowed' :
                  isToday(d) ? 'bg-slate-800 text-white font-bold' :
                  dayOfWeek === 0 ? 'text-red-500 hover:bg-red-50' :
                  dayOfWeek === 6 ? 'text-blue-500 hover:bg-blue-50' :
                  'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {format(d, 'd')}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  if (!loggedIn) {
    return (
      <div className="max-w-sm mx-auto mt-16 text-center">
        <h2 className="text-xl font-semibold mb-3">日程調整を作成</h2>
        <p className="text-sm text-slate-500 mb-8">
          {isGoogleEnabled
            ? 'Googleアカウントでログインしてください。'
            : 'お名前を入力して日程調整を始めましょう。'}
        </p>

        {isGoogleEnabled ? (
          <button
            type="button"
            onClick={() => googleLogin && googleLogin()}
            className="w-full flex items-center justify-center gap-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium py-2.5 px-4 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Googleでログイン
          </button>
        ) : (
          <>
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="text"
                required
                value={hostName}
                onChange={e => setHostName(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-slate-400 focus:border-slate-400 outline-none"
                placeholder="あなたのお名前"
              />
              <button
                type="submit"
                className="w-full bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors"
              >
                はじめる
              </button>
            </form>
            <p className="text-xs text-slate-400 mt-4">
              ※ 本番環境ではGoogleアカウントでのログインが有効になります
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">出欠表をつくる</h2>
        <Link to="/my-events" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
          作成済みイベントを確認
        </Link>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* イベント名 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">イベント名</label>
          <input
            type="text"
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-slate-400 focus:border-slate-400 outline-none"
            placeholder="飲み会、ミーティングなど"
          />
        </div>

        {/* 候補日程 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">候補日程</label>
          <p className="text-xs text-slate-500 mb-3">カレンダーの日付をクリックするか、直接入力してください（改行で区切り）</p>
          <div className="grid md:grid-cols-[1fr_260px] gap-4">
            <div>
              <textarea
                value={candidatesText}
                onChange={e => setCandidatesText(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-slate-400 focus:border-slate-400 outline-none min-h-[200px] font-mono"
                placeholder={"4/12(土) 19:00〜20:00\n4/13(日) 14:00〜15:00\n4/15(火) 19:00〜20:00"}
              />
            </div>
            <div className="border border-slate-200 rounded-lg p-3">
              <div className="mb-3">
                <label className="text-xs text-slate-500 block mb-1">開始時刻</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-slate-400 outline-none"
                />
              </div>
              <div className="mb-3">
                <label className="text-xs text-slate-500 block mb-1">ミーティング時間</label>
                <div className="grid grid-cols-4 gap-1">
                  {[30, 60, 90, 120].map(min => (
                    <button
                      key={min}
                      type="button"
                      onClick={() => setDuration(min)}
                      className={`py-1 rounded text-xs transition-colors ${
                        duration === min
                          ? 'bg-slate-800 text-white'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {min}分
                    </button>
                  ))}
                </div>
                {startTime && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    {startTime}〜{computeEndTime(startTime, duration)}
                  </p>
                )}
              </div>
              {renderCalendar()}
            </div>
          </div>
        </div>

        {/* メモ */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">メモ（任意）</label>
          <textarea
            value={memo}
            onChange={e => setMemo(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-slate-400 focus:border-slate-400 outline-none min-h-[80px]"
            placeholder="場所や目的、参加メンバーへのメッセージなど"
          />
        </div>

        {submitError && (
          <div role="alert" className="border border-red-200 bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">
            {submitError}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !title || !candidatesText.trim()}
          className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-sm font-medium py-3 px-4 rounded-lg transition-colors"
        >
          {submitting ? '送信中…' : '出欠表をつくる'}
        </button>
      </form>
    </div>
  );
}
