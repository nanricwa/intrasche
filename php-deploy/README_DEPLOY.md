# Xserver デプロイ手順

デプロイ先: **https://sche.ctw-hd.com**
サーバーパス: `/ctw-hd.com/public_html/sche.ctw-hd.com/`
FTPホスト: `sv14397.xserver.jp`

## 1. 事前準備（Xserverサーバーパネル）

### 1-1. MySQLデータベース（作成済み）
- DB名: `ctwasia2_intrasche`
- ユーザー: `ctwasia2_nan`
- ホスト: `localhost`
- MariaDB 10.5.x
- `schema.sql` は実行済み

### 1-2. サブドメイン（作成済み）
- `sche.ctw-hd.com`
- **SSL設定**: サーバーパネル →「SSL設定」で無料独自SSLを追加（反映まで30分〜1時間）

## 2. フロントエンドをビルド

```bash
cd /Users/teru/Dropbox/claudecode/intrasche/Scheduler
npm install     # 初回のみ
npm run build
```
→ `dist/` に `index.html` と `assets/` が生成される。

## 3. アップロードするファイル構成

サーバー側の `/ctw-hd.com/public_html/sche.ctw-hd.com/` に以下を配置:

```
sche.ctw-hd.com/
├── index.html            ← dist/index.html
├── assets/               ← dist/assets/
│   ├── index-xxxx.js
│   └── index-xxxx.css
├── .htaccess             ← php-deploy/.htaccess
└── api/
    ├── config.php        ← ★サーバー上で作成（sample をコピー）
    ├── db.php            ← php-deploy/api/db.php
    ├── events.php        ← php-deploy/api/events.php
    ├── event.php         ← php-deploy/api/event.php
    └── responses.php     ← php-deploy/api/responses.php
```

## 4. FTPアップロード（FileZilla推奨）

### 接続設定
- ホスト: `sv14397.xserver.jp`
- ユーザー名: Xserver契約時のFTPユーザー名
- パスワード: FTPパスワード
- ポート: 21（または22 for SFTP）

### アップロード
1. 接続後、`/ctw-hd.com/public_html/sche.ctw-hd.com/` に移動
2. ローカルの `Scheduler/dist/` の中身（`index.html`, `assets/`）を全部アップロード
3. ローカルの `Scheduler/php-deploy/.htaccess` をアップロード
4. ローカルの `Scheduler/php-deploy/api/` フォルダごとアップロード

## 5. config.php をサーバー上で作成

方法A: FTPクライアントで `api/config.sample.php` をダウンロード → 編集 → `config.php` として再アップロード

方法B: XserverのWebファイルマネージャーで直接編集

内容:
```php
<?php
return [
    'db_host' => 'localhost',
    'db_name' => 'ctwasia2_intrasche',
    'db_user' => 'ctwasia2_nan',
    'db_pass' => 'ここに実際のDBパスワード',
    'db_charset' => 'utf8mb4',
];
```

## 6. 動作確認

1. **https://sche.ctw-hd.com** にアクセス → 名前入力画面
2. 名前を入れて「はじめる」→ イベント作成画面
3. イベント作成 → `/events/xxxxxxxx` で出欠表示
4. 「作成済みイベントを確認」→ `/my-events` リスト
5. 別ブラウザ/シークレットモードで URLを開いて回答してみる

## トラブルシュート

| 症状 | 原因 | 対処 |
|---|---|---|
| 500エラー | `api/config.php` 未作成 または PHPエラー | サーバーパネル「エラーログ」を確認 |
| API 404 | `.htaccess` 未アップロード | `sche.ctw-hd.com/` 直下に `.htaccess` があるか |
| DB接続失敗 | `config.php` の情報違い | DB名・ユーザー名・パスワード再確認 |
| SSL証明書エラー | 反映前 | 30分〜1時間待つ |
| 白画面 | JSファイルパスずれ | ブラウザのNetworkタブで404確認、`assets/` が正しい位置にあるか |

## 再デプロイ（更新時）

1. ローカルで `npm run build`
2. `dist/index.html` と `dist/assets/` を再アップロード（上書き）
3. PHPファイルを変更した場合は `api/*.php` も再アップロード
4. `config.php` は触らない

## ローカル開発

```bash
cd Scheduler
npm run dev   # http://localhost:3000
```
Node.js版（`server.ts` + SQLite）はローカル開発用として引き続き使用可能。
