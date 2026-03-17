<?php
namespace App\Model\Table;

use Cake\ORM\Table;

class SuppliersTable extends Table
{
    public function initialize(array $config): void
    {
        parent::initialize($config);
        $this->setTable('suppliers');
        $this->setPrimaryKey('id');
        $this->addBehavior('Timestamp');
        $this->hasMany('MenuIngredients', [
            'foreignKey' => 'supplier_id',
        ]);
    }
}
