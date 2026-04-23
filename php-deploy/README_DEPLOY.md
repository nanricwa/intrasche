# Xserver デプロイ手順

## 1. 事前準備（Xserverサーバーパネル）

### 1-1. MySQL データベース作成
Xserverサーバーパネル → 「MySQL設定」
- **MySQLデータベース追加**: DB名 `xxxx_scheduler`（`xxxx`はサーバーID）
- **MySQLユーザー追加**: ユーザー名 `xxxx_sched` + 任意のパスワード
- **アクセス権限所有ユーザーの追加**: 作成したユーザーをDBに紐付け

### 1-2. スキーマ読み込み
サーバーパネル → 「phpMyAdmin」 → 作成したDBを選択 → 「SQL」タブ
`schema.sql` の内容を貼り付けて実行。

## 2. フロントエンドをビルド（ローカル）

```bash
cd /Users/teru/Dropbox/claudecode/intrasche/Scheduler
npm install
npm run build
```
→ `dist/` に `index.html` と `assets/` が生成される。

## 3. サーバーにアップロード

公開ディレクトリ（例: `public_html/scheduler/` または独自サブドメイン）に以下を配置:

```
public_html/scheduler/
├── index.html            ← dist/ から
├── assets/               ← dist/ から
├── .htaccess             ← php-deploy/ から
└── api/                  ← php-deploy/api/ から
    ├── config.php        ← config.sample.php をコピーして編集
    ├── db.php
    ├── events.php
    ├── event.php
    └── responses.php
```

**アップロード方法:**
- **FTP (FileZilla 等)** または **SSH/SFTP**
- **SSH の場合（既にセットアップ済み）:**

```bash
# dist をビルド後
cd /Users/teru/Dropbox/claudecode/intrasche/Scheduler
rsync -avz --delete dist/ xserver:~/[ドメイン]/public_html/scheduler/
rsync -avz php-deploy/.htaccess php-deploy/api xserver:~/[ドメイン]/public_html/scheduler/
```

## 4. config.php を作成

サーバー上の `api/config.sample.php` を `api/config.php` にコピーして、
先ほど作成したMySQLの情報を入力:

```php
<?php
return [
    'db_host' => 'localhost',
    'db_name' => 'xxxx_scheduler',
    'db_user' => 'xxxx_sched',
    'db_pass' => '作成したパスワード',
    'db_charset' => 'utf8mb4',
];
```

**注意**: `config.sample.php` と `config.php` は `.htaccess` でアクセス禁止設定済み。

## 5. 動作確認

1. `https://あなたのドメイン/scheduler/` にアクセス
2. 名前を入力してイベント作成
3. `/scheduler/events/:id` で出欠表示
4. `/scheduler/my-events` で自分の作成一覧

## トラブルシュート

- **500エラー**: `api/config.php` が存在するか、PHPエラーログを確認（サーバーパネル → エラーログ）
- **API 404**: `.htaccess` がアップロードされているか、`mod_rewrite` が有効か
- **DB接続エラー**: ホスト名が `localhost` でなく `mysqlXXXX.xserver.jp` の可能性 → Xserver側で確認
- **JSON型エラー**: XserverのMySQL 5.7+ なら JSON型対応。それ以前なら `TEXT` に変更

## ローカル開発（引き続き Node.js で動かす場合）

```bash
npm run dev   # http://localhost:3000
```

PHP版は本番用、Node.js版（`server.ts`）はローカル開発用として両方維持可能。
