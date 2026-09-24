<?php
declare(strict_types=1);

use Migrations\AbstractMigration;

/**
 * 生協品目に注文コードを持たせる。
 *
 * eふれんずは「注文コードでご注文」で、注文コードと数量を並べて入力すれば
 * まとめて注文できる。品名だけ持っていても人がカタログを引き直すことになるため、
 * システム側にコードを持たせて、そのまま貼れる形で出せるようにする。
 */
class AddOrderCodeToCoopItems extends AbstractMigration
{
    public function change(): void
    {
        $table = $this->table('coop_items');

        if (!$table->hasColumn('order_code')) {
            $table->addColumn('order_code', 'string', [
                'limit'   => 32,
                'null'    => true,
                'default' => null,
                'after'   => 'name',
                'comment' => 'eふれんずの注文コード。未設定なら発注リストに品名で出す',
            ])->update();
        }
    }
}
