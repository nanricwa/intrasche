<?php
// このファイルを config.php にコピーして、Xserver の MySQL 情報を書き込んでください
// config.php は .gitignore で除外されています

return [
    'db_host' => 'localhost',
    'db_name' => 'xxxx_scheduler',   // Xserver で作成した DB 名
    'db_user' => 'xxxx_scheduler',   // Xserver で作成した DB ユーザー
    'db_pass' => 'YOUR_PASSWORD',    // DB パスワード
    'db_charset' => 'utf8mb4',
];
