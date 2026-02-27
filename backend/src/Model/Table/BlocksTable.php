<?php
namespace App\Model\Table;

use Cake\ORM\Table;
use Cake\Validation\Validator;

class BlocksTable extends Table
{
    public function initialize(array $config): void
    {
        parent::initialize($config);
        $this->setTable('blocks');
        $this->belongsTo('Room1', ['className' => 'Rooms', 'foreignKey' => 'room1_id']);
        $this->belongsTo('Room2', ['className' => 'Rooms', 'foreignKey' => 'room2_id']);
        $this->hasMany('BlockOrderQuantities', ['foreignKey' => 'block_id']);
        $this->addBehavior('Timestamp');
    }

    public function validationDefault(Validator $validator): Validator
    {
        $validator
            ->notEmptyString('name')
            ->requirePresence('room1_id', 'create')
            ->requirePresence('room2_id', 'create');
        return $validator;
    }
}
