<?php
use Migrations\AbstractMigration;

class CreateUsers extends AbstractMigration
{
    public function change(): void
    {
        $table = $this->table('users');
        $table
            ->addColumn('name', 'string', ['limit' => 100])
            ->addColumn('email', 'string', ['limit' => 255])
            ->addColumn('password', 'string', ['limit' => 255])
            ->addColumn('role', 'enum', ['values' => ['admin', 'user'], 'default' => 'user'])
            ->addColumn('created', 'datetime', ['null' => true])
            ->addColumn('modified', 'datetime', ['null' => true])
            ->create();
    }
}
