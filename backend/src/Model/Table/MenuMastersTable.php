<?php
namespace App\Model\Table;

use Cake\ORM\Table;

class MenuMastersTable extends Table
{
    public function initialize(array $config): void
    {
        $this->setTable('menu_masters');
        $this->hasMany('MenuIngredients', ['foreignKey' => 'menu_master_id', 'dependent' => true]);
        $this->addBehavior('Timestamp');
    }
}
