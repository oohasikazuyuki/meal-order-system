<?php
use Migrations\AbstractMigration;

class AddDeliveryLeadWeeksToSuppliers extends AbstractMigration
{
    public function change(): void
    {
        if (!$this->hasTable('suppliers')) {
            return;
        }

        $table = $this->table('suppliers');

        if ($table->hasColumn('delivery_lead_weeks')) {
            return;
        }

        $table
            ->addColumn('delivery_lead_weeks', 'integer', [
                'null'    => false,
                'default' => 0,
                'comment' => '納品リードタイム週数: 0=同週納品, 1=翌週納品（発注週の翌週に納品）',
                'after'   => 'order_day',
            ])
            ->update();
    }
}
