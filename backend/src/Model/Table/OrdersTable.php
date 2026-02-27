<?php
namespace App\Model\Table;

use Cake\ORM\Table;
use Cake\Validation\Validator;

class OrdersTable extends Table
{
    public function initialize(array $config): void
    {
        parent::initialize($config);
        $this->setTable('orders');
        $this->belongsTo('Users');
        $this->belongsTo('Menus');
        $this->addBehavior('Timestamp');
    }

    public function validationDefault(Validator $validator): Validator
    {
        $validator
            ->notEmptyString('user_id')
            ->notEmptyString('menu_id')
            ->integer('quantity')->greaterThan('quantity', 0)
            ->date('order_date');
        return $validator;
    }
}
