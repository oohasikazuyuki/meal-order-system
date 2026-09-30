<?php
declare(strict_types=1);

use Migrations\AbstractMigration;

/**
 * login_id に一意制約を付ける。
 *
 * 制約が無いため同じ login_id のユーザーを複数作れてしまう。
 * その状態でログインすると先に登録されている方が返るので、
 * 後から作った人は自分のパスワードでログインできない。
 * アカウントは作れたのに使えない、という気づきにくい壊れ方をする。
 */
class AddUniqueLoginIdToUsers extends AbstractMigration
{
    public function up(): void
    {
        // 既に重複していると制約を張れない。後から作られた方に印を付けて退避する
        $rows = $this->fetchAll(
            'SELECT id, login_id FROM users WHERE login_id IN
             (SELECT login_id FROM (SELECT login_id FROM users GROUP BY login_id HAVING COUNT(*) > 1) t)
             ORDER BY login_id, id'
        );
        $seen = [];
        foreach ($rows as $row) {
            $lid = $row['login_id'];
            if (!isset($seen[$lid])) {
                $seen[$lid] = true;
                continue;
            }
            $this->execute(sprintf(
                "UPDATE users SET login_id = %s WHERE id = %d",
                $this->getAdapter()->quoteValue($lid . '_dup' . $row['id']),
                (int)$row['id']
            ));
        }

        $this->table('users')->addIndex(['login_id'], ['unique' => true, 'name' => 'idx_users_login_id'])->update();
    }

    public function down(): void
    {
        $this->table('users')->removeIndexByName('idx_users_login_id')->update();
    }
}
