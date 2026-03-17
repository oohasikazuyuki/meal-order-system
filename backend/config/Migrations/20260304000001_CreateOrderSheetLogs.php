<?php
declare(strict_types=1);

use Migrations\AbstractMigration;

class CreateOrderSheetLogs extends AbstractMigration
{
    public function change(): void
    {
        $table = $this->table('order_sheet_logs');
        $table->addColumn('user_id', 'integer', [
            'default' => null,
            'limit' => 11,
            'null' => true,
        ]);
        $table->addColumn('supplier_id', 'integer', [
            'default' => null,
            'limit' => 11,
            'null' => false,
        ]);
        $table->addColumn('week_start', 'date', [
            'default' => null,
            'null' => false,
        ]);
        $table->addColumn('block_name', 'string', [
            'default' => null,
            'limit' => 100,
            'null' => true,
        ]);
        $table->addColumn('action', 'string', [
            'default' => null,
            'limit' => 20,
            'null' => false,
            'comment' => 'download or pdf',
        ]);
        $table->addColumn('ip_address', 'string', [
            'default' => null,
            'limit' => 45,
            'null' => true,
        ]);
        $table->addColumn('created', 'datetime', [
            'default' => null,
            'null' => false,
        ]);
        $table->addIndex(['user_id']);
        $table->addIndex(['supplier_id']);
        $table->addIndex(['week_start']);
        $table->addIndex(['created']);
        $table->create();
    }
}
