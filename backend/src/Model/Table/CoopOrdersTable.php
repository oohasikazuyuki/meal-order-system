<?php
namespace App\Model\Table;

use Cake\ORM\Table;

class CoopOrdersTable extends Table
{
    public function initialize(array $config): void
    {
        parent::initialize($config);
        $this->setTable('coop_orders');
        $this->setPrimaryKey('id');
        $this->addBehavior('Timestamp');
    }
}
