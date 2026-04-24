# Google 連携の本番反映 手順書

sche.ctw-hd.com で Google ログイン / Calendar 連携を有効化するための管理者向け runbook。

## やるべきこと (TL;DR)

1. **Google Cloud Console で OAuth Client ID を発行**
2. **ローカルで `.env.production.local` に Client ID を書き、`npm run build`**
3. **生成された `dist/` を Xserver にアップロード**
4. **動作確認 (ログイン → カレンダー連携)**

`api/*.php` と `.htaccess` は既に本番配置済みのため今回は触りません。変更するのは `index.html` と `assets/` のみです。

---

## 1. Google Cloud Console で OAuth Client ID 発行

Client ID を既にお持ちならこのステップは飛ばして OK。

1. https://console.cloud.google.com → プロジェクト選択 or 新規作成
2. **APIs & Services → Library → Google Calendar API** を有効化
3. **APIs & Services → OAuth consent screen**
   - User Type: **External**
   - アプリ名、サポートメール、開発者メール を記入
   - Scopes で以下を追加:
     - `openid`
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `https://www.googleapis.com/auth/calendar.events`
   - Testing モード中は自分 (および社内利用者) のメールアドレスを **Test users** に追加
4. **APIs & Services → Credentials → + Create credentials → OAuth client ID**
   - Application type: **Web application**
   - **Authorized JavaScript origins**:
     - `https://sche.ctw-hd.com`
     - `http://localhost:3000` (ローカル開発用)
   - Authorized redirect URIs: **空のまま** (token flow では不要)
5. 発行された `<数字>-<英数字>.apps.googleusercontent.com` をコピー

## 2. ローカルでビルド

リポジトリのルートで:

```bash
git pull origin main

# gitignore 対象のファイル。実値は絶対にコミットしない
cat > .env.production.local <<'EOF'
VITE_GOOGLE_CLIENT_ID=<上で発行した Client ID>
EOF

npm install   # 初回 or 依存変更時のみ
npm run build
```

`dist/` に成果物が生成されます。想定出力:

```
dist/
├── index.html
└── assets/
    ├── index-<hash>.css
    └── index-<hash>.js
```

### ビルド検証 (推奨)

```bash
# Client ID が bundle に埋め込まれているか確認
grep -c "$(awk -F= '{print $2}' .env.production.local)" dist/assets/index-*.js
# 1 以上なら OK。0 なら .env.production.local が読まれていない
```

## 3. Xserver にアップロード

アップロード先: `/ctw-hd.com/public_html/sche.ctw-hd.com/`

### 上書きするファイル

- `dist/index.html` → `sche.ctw-hd.com/index.html`
- `dist/assets/index-<hash>.css` → `sche.ctw-hd.com/assets/index-<hash>.css`
- `dist/assets/index-<hash>.js` → `sche.ctw-hd.com/assets/index-<hash>.js`

hash 部分は毎回変わります。古い `index-<旧hash>.{js,css}` は削除しておくと容量節約 (残しておいても index.html からは新 hash だけ参照されるので動作影響はなし)。

### 触らないファイル

- `.htaccess` (ルーティングは既に正しい)
- `api/*.php` (PHP API は既に配置済み)
- `api/config.php` (DB 接続情報、触ると壊れる)

### ミス防止: 簡易チェックリスト

- [ ] アップ後にブラウザで https://sche.ctw-hd.com/ を開くとランディング (名前入力ではなく) **「Googleでログイン」ボタン** が出る
- [ ] 開発者ツールの Network タブで `index-<新hash>.js` が 200 で読まれている
- [ ] 旧 `index-<旧hash>.js` は参照されていない (残っていても 404 ではない)

## 4. 動作確認

### 4-1. Bundle に Client ID が inline されているか (本番側)

```bash
curl -s https://sche.ctw-hd.com/assets/index-*.js 2>/dev/null | grep -c 'apps.googleusercontent.com'
# 1 以上なら OK
```

※ ハッシュ付きファイル名は毎ビルド変わるので、index.html からリンクを拾って curl しても OK:

```bash
JS=$(curl -s https://sche.ctw-hd.com/ | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)
curl -s "https://sche.ctw-hd.com${JS}" | grep -c 'apps.googleusercontent.com'
```

### 4-2. ログインフロー

1. https://sche.ctw-hd.com をクリーンなブラウザプロファイル (or プライベートウィンドウ) で開く
2. 「Googleでログイン」をクリック → Google 同意画面が開く
3. スコープに **「Google カレンダーのイベントの表示、作成、変更、削除」** が列挙されることを確認
4. 承認 → 元のページに戻り、「出欠表をつくる」画面に遷移
5. カレンダーから日付をクリック → 右サイドに **その日の予定一覧** が表示 (予定がなければ「この日は予定なし」)
6. 右上の「カレンダー (n/m)」ボタン → チェックボックスで複数カレンダー切替できるか確認
7. イベントを作成 → `/events/:id` へ
8. パース可能な slot 行に **「この日程で確定」** リンク → 確認 → 追加 → Google Calendar 側で作成されていることを確認

### 4-3. 再ログインの復帰確認

1. 上記でログイン後、DevTools → Application → Local Storage → `scheduler_google_token` を手動で書き換え (ダミー値にする)
2. ページリロード → カレンダー予定取得時に「再ログインが必要です」表示
3. 「再ログイン」リンクをクリック → 同意スキップで成功 → **メッセージが自動で消え、予定が再取得される** ことを確認 (壊れていれば何度ログインしても消えない)

---

## トラブルシュート

| 症状 | 原因 | 対処 |
|---|---|---|
| ランディングが「お名前入力」のまま (Google ログインボタンが出ない) | Build 時に env が効いていない | `.env.production.local` の名前と位置、`npm run build` を再実行。`grep apps.googleusercontent.com dist/assets/*.js` が 0 なら env 未適用 |
| 同意画面で `Error 400: redirect_uri_mismatch` | Authorized JavaScript origins に `https://sche.ctw-hd.com` が入っていない | Google Cloud Console → Credentials → OAuth client → Authorized JavaScript origins を見直し |
| 同意画面で `Error 403: access_denied` | Testing モードで Test users に入っていない、または scope 未許可 | OAuth consent screen → Test users に追加、もしくは公開ステータスを Production へ |
| ログインはできるが Calendar 予定が 403 | 旧スコープ (`calendar.readonly`) のトークン保持のまま | 「再ログイン」で `calendar.events` スコープを再取得させる (このPRで自動復帰する修正も入っています) |
| 何度ログインしても「再ログインが必要です」が消えない | `saveGoogleToken` + `scheduler:auth-refreshed` イベントが発火していない | このPRで修正済み。本番ビルドに含まれているか確認 (`grep -c 'scheduler:auth-refreshed' dist/assets/*.js` が 1 以上) |
| 画面真っ白 | asset のハッシュずれ (index.html だけ更新 / js を忘れた 等) | dist/assets/ 配下を全部上書き |

---

## セキュリティ/運用メモ

- **`.env.production.local` は絶対にコミットしない** (`.gitignore` で `.env*` → `!.env.example` により保護)
- Client ID はブラウザに露出する値なので秘密ではないが、ローテーションする場合はリビルド + 再アップロードが必須 (ビルド時にインライン展開される)
- アクセストークンは localStorage に保存され、**約 1 時間で期限切れ** → 再ログインの導線で自動復帰
- リフレッシュトークンは implicit token flow のため発行されない (サーバサイドが必要な場合は別途設計)
