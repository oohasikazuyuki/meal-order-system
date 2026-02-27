<?php
use Migrations\AbstractMigration;

class CreateMenus extends AbstractMigration
{
    public function change(): void
    {
        $table = $this->table('menus');
        $table
            ->addColumn('name', 'string', ['limit' => 100])
            ->addColumn('date', 'date')
            ->addColumn('meal_type', 'enum', ['values' => ['breakfast', 'lunch', 'dinner']])
            ->addColumn('capacity', 'integer', ['default' => 0])
            ->addColumn('created', 'datetime', ['null' => true])
            ->addColumn('modified', 'datetime', ['null' => true])
            ->create();
    }
}
