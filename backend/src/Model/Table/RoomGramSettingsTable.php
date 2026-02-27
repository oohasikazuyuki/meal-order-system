<?php
namespace App\Model\Table;

use Cake\ORM\Table;
use Cake\Validation\Validator;

class RoomGramSettingsTable extends Table
{
    public function initialize(array $config): void
    {
        parent::initialize($config);
        $this->setTable('room_gram_settings');
        $this->belongsTo('Rooms', ['foreignKey' => 'room_id']);
        $this->addBehavior('Timestamp');
    }

    public function validationDefault(Validator $validator): Validator
    {
        $validator
            ->requirePresence('room_id', 'create')
            ->requirePresence('meal_type', 'create')
            ->decimal('grams_per_person');
        return $validator;
    }
}
