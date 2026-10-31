<?php
declare(strict_types=1);

use Migrations\AbstractMigration;

/**
 * ログイントークンに期限を付ける。
 *
 * これまでトークンはログアウトしない限り永久に使えたので、
 * 共用端末に残ったり漏れたりすると、いつまでも操作できてしまう。
 * 既存のトークンは期限が空のまま＝無効扱いになり、全員一度ログインし直す。
 */
class AddApiTokenExpiresAtToUsers extends AbstractMigration
{
    public function change(): void
    {
        $this->table('users')
            ->addColumn('api_token_expires_at', 'datetime', ['null' => true, 'default' => null, 'after' => 'api_token'])
            ->update();
    }
}
