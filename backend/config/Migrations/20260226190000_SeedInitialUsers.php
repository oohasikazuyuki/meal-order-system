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
        $exists = $this->table('users')->select(['id'])->where(['id' => 1])->execute()->fetch();
        if (!$exists) {
            $this->table('users')->insert([
                'id' => 1,
                'name' => '管理者',
                'email' => 'admin@example.com',
                'password' => '$2y$12$Fw6GZRMneZZYFxR3M3mQpOI/ss1ogRTte7elNWxYUYeEgDCufAqWi',
                'role' => 'admin',
                'api_token' => null,
                'created' => date('Y-m-d H:i:s'),
                'modified' => date('Y-m-d H:i:s'),
            ])->save();
        }

        // 初期一般ユーザー (ID: 2 / password: user1234)
        $exists = $this->table('users')->select(['id'])->where(['id' => 2])->execute()->fetch();
        if (!$exists) {
            $this->table('users')->insert([
                'id' => 2,
                'name' => '一般ユーザー',
                'email' => 'user@example.com',
                'password' => '$2y$12$BeJHKMHChb5WRcuuXM1tteyxphZ5/SxHr5FkMKv44HC5nB8FgAd5u',
                'role' => 'user',
                'api_token' => null,
                'created' => date('Y-m-d H:i:s'),
                'modified' => date('Y-m-d H:i:s'),
            ])->save();
        }
    }

    public function down(): void
    {
        // 既存ユーザー誤削除を防ぐため、データのロールバックは行わない。
    }
}