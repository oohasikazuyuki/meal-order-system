<?php
declare(strict_types=1);

use Migrations\AbstractMigration;

class CreateBirthdayMenuDates extends AbstractMigration
{
    public function change(): void
    {
        $table = $this->table('birthday_menu_dates');
        $table->addColumn('menu_date', 'date', [
            'default' => null,
            'null' => false,
        ]);
        $table->addColumn('block_id', 'integer', [
            'default' => null,
            'limit' => 11,
            'null' => true,
        ]);
        $table->addColumn('memo', 'string', [
            'default' => null,
            'limit' => 255,
            'null' => true,
        ]);
        $table->addColumn('created', 'datetime', [
            'default' => null,
            'null' => false,
        ]);
        $table->addColumn('modified', 'datetime', [
            'default' => null,
            'null' => false,
        ]);
        $table->addIndex(['menu_date']);
        $table->addIndex(['block_id']);
        $table->create();
    }
}
