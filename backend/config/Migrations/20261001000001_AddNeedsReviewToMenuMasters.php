<?php
declare(strict_types=1);

use Migrations\AbstractMigration;

/**
 * AIが作ったメニューマスタに「未確認」の印を付ける。
 *
 * 材料と数量は、そのまま発注書になって仕入先に渡る。
 * いままでマスタ登録は人の手だったので、そこが実質的なチェックだった。
 * AIに作らせると、その最後の砦が無くなる。
 *
 * 効いてくるのは数量で、発注量は 1人あたりの分量 × 食数 で決まる。
 * AIが味噌汁を「1人500g」と言えばその通り発注される（40食なら20kg）。
 *
 * そこで、AIが作ったものには印を残し、発注書を出す前に知らせる。
 * 人が内容を見て保存すれば印は消える。
 */
class AddNeedsReviewToMenuMasters extends AbstractMigration
{
    public function up(): void
    {
        $this->table('menu_masters')
            ->addColumn('needs_review', 'boolean', [
                'default' => false,
                'null'    => false,
                'comment' => 'AIが作って、まだ人が確認していない',
                'after'   => 'memo',
            ])
            ->update();
    }

    public function down(): void
    {
        $this->table('menu_masters')->removeColumn('needs_review')->update();
    }
}
