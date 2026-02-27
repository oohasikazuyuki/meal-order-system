<?php
use Migrations\AbstractMigration;

class CreateDailyOrderQuantities extends AbstractMigration
{
    public function change(): void
    {
        $table = $this->table('daily_order_quantities');

        $table->addColumn('order_date', 'date', ['null' => false])
              ->addColumn('meal_type', 'integer', ['null' => false, 'comment' => '1=朝食,2=昼食,3=夕食,4=弁当'])
              ->addColumn('kamaho_count', 'integer', ['null' => true, 'default' => null, 'comment' => 'kamahoから取得した食数'])
              ->addColumn('order_quantity', 'integer', ['null' => false, 'default' => 0, 'comment' => '発注数量'])
              ->addColumn('notes', 'string', ['null' => true, 'default' => null, 'limit' => 255])
              ->addColumn('created', 'datetime', ['null' => false])
              ->addColumn('modified', 'datetime', ['null' => false])
              ->addIndex(['order_date', 'meal_type'], ['unique' => true])
              ->create();
    }
}
