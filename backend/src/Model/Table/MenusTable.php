<?php
namespace App\Model\Table;

use Cake\ORM\Table;
use Cake\Validation\Validator;

class MenusTable extends Table
{
    public function initialize(array $config): void
    {
        parent::initialize($config);
        $this->setTable('menus');
        $this->addBehavior('Timestamp');
    }

    public function validationDefault(Validator $validator): Validator
    {
        $validator
            ->notEmptyString('name')
            ->date('menu_date')
            ->integer('meal_type')
            ->inList('meal_type', [1, 2, 3, 4])
            ->integer('block_id')
            ->decimal('grams_per_person');
        return $validator;
    }
}
