<?php
declare(strict_types=1);

use Migrations\AbstractMigration;

/**
 * 部屋を食数管理システム（kamaho）の部屋IDで対応付ける。
 *
 * いままでは部屋名の文字列一致だけで結んでいたので、
 * kamaho 側で部屋名を変えると食数が黙って0になっていた。
 */
class AddKamahoRoomIdToRooms extends AbstractMigration
{
    public function up(): void
    {
        $this->table('rooms')
            ->addColumn('kamaho_room_id', 'integer', [
                'default' => null,
                'null'    => true,
                'comment' => '食数管理システムの部屋ID（m_room_info.i_id_room）',
                'after'   => 'name',
            ])
            ->addIndex(['kamaho_room_id'], ['unique' => true])
            ->update();
    }

    public function down(): void
    {
        $this->table('rooms')
            ->removeIndex(['kamaho_room_id'])
            ->removeColumn('kamaho_room_id')
            ->update();
    }
}
