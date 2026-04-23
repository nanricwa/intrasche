// Google アクセストークンの保存と、認証更新のアプリ内通知を一元化する。
//
// 問題: @react-oauth/google の useGoogleLogin は onSuccess で新トークンを
// 返すが、それを localStorage に書いても、各コンポーネントが useState で
// 抱えた auth エラー状態 (kind: 'auth') は React の再レンダーだけでは
// 解消されない。ここでカスタムイベントを配信し、受け手側で再試行させる。

export const TOKEN_KEY = 'scheduler_google_token';
export const AUTH_REFRESHED_EVENT = 'scheduler:auth-refreshed';

export function saveGoogleToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  // 同一タブの購読者に通知。StorageEvent は他タブ用なのでカスタムイベントを使う
  window.dispatchEvent(new CustomEvent(AUTH_REFRESHED_EVENT));
}

export function onAuthRefreshed(handler: () => void): () => void {
  window.addEventListener(AUTH_REFRESHED_EVENT, handler);
  return () => window.removeEventListener(AUTH_REFRESHED_EVENT, handler);
}
