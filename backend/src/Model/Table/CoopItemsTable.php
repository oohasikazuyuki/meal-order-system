<?php
namespace App\Model\Table;

use Cake\ORM\Table;

class CoopItemsTable extends Table
{
    public function initialize(array $config): void
    {
        parent::initialize($config);
        $this->setTable('coop_items');
        $this->setPrimaryKey('id');
    }
}
