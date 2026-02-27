<?php
use Migrations\AbstractMigration;

class SeedInitialUsers extends AbstractMigration
{
    public function up(): void
    {
        $users = $this->table('users');

        if (!$users->hasColumn('api_token')) {
            $users->addColumn('api_token', 'string', [
                'limit' => 64,
                'null' => true,
                'default' => null,
                'after' => 'role',
            ])->update();
        }

        // 初期管理者 (ID: 1 / password: admin1234)
        $this->execute(
            "INSERT INTO users (id, name, email, password, role, api_token, created, modified)
             SELECT 1, '管理者', 'admin@example.com',
             '$2y$12$Fw6GZRMneZZYFxR3M3mQpOI/ss1ogRTte7elNWxYUYeEgDCufAqWi',
             'admin', NULL, NOW(), NOW()
             WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = 1)"
        );

        // 初期一般ユーザー (ID: 2 / password: user1234)
        $this->execute(
            "INSERT INTO users (id, name, email, password, role, api_token, created, modified)
             SELECT 2, '一般ユーザー', 'user@example.com',
             '$2y$12$BeJHKMHChb5WRcuuXM1tteyxphZ5/SxHr5FkMKv44HC5nB8FgAd5u',
             'user', NULL, NOW(), NOW()
             WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = 2)"
        );
    }

    public function down(): void
    {
        // 既存ユーザー誤削除を防ぐため、データのロールバックは行わない。
    }
}
