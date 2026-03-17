<?php
use Migrations\AbstractMigration;

class AddOrderDayToSuppliers extends AbstractMigration
{
    public function change(): void
    {
        if (!$this->hasTable('suppliers')) {
            return;
        }

        $table = $this->table('suppliers');

        if ($table->hasColumn('order_day')) {
            return;
        }

        $table
            ->addColumn('order_day', 'integer', [
                'null'    => true,
                'default' => null,
                'comment' => '発注曜日オフセット: 0=月,1=火,2=水,3=木,4=金,5=土,6=日（weekStartからの日数）',
                'after'   => 'delivery_days',
            ])
            ->update();
    }
}
