import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import CreateEvent from './pages/CreateEvent';
import ViewEvent from './pages/ViewEvent';
import MyEvents from './pages/MyEvents';

const clientId = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID || '';

export default function App() {
  const content = (
    <BrowserRouter>
      <div className="min-h-screen bg-white text-slate-800 font-sans">
        <header className="border-b border-slate-100 px-6 py-4">
          <h1 className="text-lg font-semibold text-slate-800">ミーティング日程調整</h1>
        </header>
        <main className="max-w-3xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<CreateEvent />} />
            <Route path="/events/:id" element={<ViewEvent />} />
            <Route path="/my-events" element={<MyEvents />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );

  // Google Client IDが設定されている場合のみProviderで包む
  if (clientId) {
    return <GoogleOAuthProvider clientId={clientId}>{content}</GoogleOAuthProvider>;
  }
  return content;
}
