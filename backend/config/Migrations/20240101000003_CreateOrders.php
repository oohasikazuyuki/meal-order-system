<?php
use Migrations\AbstractMigration;

class CreateOrders extends AbstractMigration
{
    public function change(): void
    {
        $table = $this->table('orders');
        $table
            ->addColumn('user_id', 'integer')
            ->addColumn('menu_id', 'integer')
            ->addColumn('quantity', 'integer')
            ->addColumn('order_date', 'date')
            ->addColumn('status', 'enum', [
                'values' => ['pending', 'confirmed', 'cancelled'],
                'default' => 'pending'
            ])
            ->addColumn('note', 'text', ['null' => true])
            ->addColumn('created', 'datetime', ['null' => true])
            ->addColumn('modified', 'datetime', ['null' => true])
            ->addForeignKey('user_id', 'users', 'id', ['delete' => 'CASCADE'])
            ->addForeignKey('menu_id', 'menus', 'id', ['delete' => 'CASCADE'])
            ->create();
    }
}
