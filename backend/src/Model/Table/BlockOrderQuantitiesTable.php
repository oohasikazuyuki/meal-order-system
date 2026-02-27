<?php
namespace App\Model\Table;

use Cake\ORM\Table;
use Cake\Validation\Validator;

class BlockOrderQuantitiesTable extends Table
{
    public function initialize(array $config): void
    {
        parent::initialize($config);
        $this->setTable('block_order_quantities');
        $this->belongsTo('Blocks', ['foreignKey' => 'block_id']);
        $this->addBehavior('Timestamp');
    }

    public function validationDefault(Validator $validator): Validator
    {
        $validator
            ->requirePresence('order_date', 'create')
            ->requirePresence('block_id', 'create')
            ->requirePresence('meal_type', 'create');
        return $validator;
    }
}
