<?php
namespace App\Model\Table;

use Cake\ORM\Table;
use Cake\Validation\Validator;

class DailyOrderQuantitiesTable extends Table
{
    public function initialize(array $config): void
    {
        parent::initialize($config);

        $this->setTable('daily_order_quantities');
        $this->setPrimaryKey('id');

        $this->addBehavior('Timestamp');
    }

    public function validationDefault(Validator $validator): Validator
    {
        $validator
            ->date('order_date')
            ->requirePresence('order_date', 'create')
            ->notEmptyDate('order_date');

        $validator
            ->integer('meal_type')
            ->inList('meal_type', [1, 2, 3, 4], '食事種別は 1〜4 の整数で指定してください')
            ->requirePresence('meal_type', 'create');

        $validator
            ->integer('kamaho_count')
            ->allowEmptyString('kamaho_count');

        $validator
            ->integer('order_quantity')
            ->greaterThanOrEqual('order_quantity', 0)
            ->requirePresence('order_quantity', 'create');

        $validator
            ->scalar('notes')
            ->maxLength('notes', 255)
            ->allowEmptyString('notes');

        return $validator;
    }
}
