<?php
namespace App\Model\Table;

use Cake\ORM\Table;
use Cake\Validation\Validator;

class RoomsTable extends Table
{
    public function initialize(array $config): void
    {
        parent::initialize($config);
        $this->setTable('rooms');
        $this->addBehavior('Timestamp');
    }

    public function validationDefault(Validator $validator): Validator
    {
        $validator->notEmptyString('name');
        return $validator;
    }

    /**
     * kamaho の部屋一覧を取り込む。
     *
     * 部屋IDで対応付け、まだIDを持たない部屋は最初の1回だけ部屋名で結んでIDを記録する。
     * 以降は kamaho 側で名前が変わっても同じ部屋のまま（名前は kamaho に合わせる）。
     *
     * @param array<int, string> $kamahoRooms kamaho の部屋ID => 部屋名
     * @return list<string> 新しく追加した部屋名
     */
    public function syncKamahoRooms(array $kamahoRooms): array
    {
        $rooms = $this->find()->all()->toList();
        $byKamahoId = [];
        $unlinkedByName = [];
        foreach ($rooms as $room) {
            if ($room->kamaho_room_id !== null) {
                $byKamahoId[(int)$room->kamaho_room_id] = $room;
            } else {
                $unlinkedByName[$room->name] = $room;
            }
        }

        $added = [];
        $sortOrder = count($rooms);
        foreach ($kamahoRooms as $kamahoId => $name) {
            $room = $byKamahoId[$kamahoId] ?? $unlinkedByName[$name] ?? null;
            if ($room === null) {
                $room = $this->newEntity(['name' => $name, 'sort_order' => $sortOrder++]);
                $added[] = $name;
            }
            unset($unlinkedByName[$room->name]);
            $room->set(['kamaho_room_id' => $kamahoId, 'name' => $name]);
            if ($room->isDirty()) {
                $this->saveOrFail($room);
            }
        }

        return $added;
    }
}
