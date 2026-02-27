<?php
namespace App\Model\Table;

use Cake\ORM\Table;

class MenuIngredientsTable extends Table
{
    public function initialize(array $config): void
    {
        $this->setTable('menu_ingredients');
        $this->belongsTo('MenuMasters', ['foreignKey' => 'menu_master_id']);
        $this->addBehavior('Timestamp');
    }
}
