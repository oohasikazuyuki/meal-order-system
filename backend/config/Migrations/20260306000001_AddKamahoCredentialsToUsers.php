<?php
declare(strict_types=1);

use Migrations\AbstractMigration;

class AddKamahoCredentialsToUsers extends AbstractMigration
{
    public function change(): void
    {
        if (!$this->hasTable('users')) {
            return;
        }

        $table = $this->table('users');

        if (!$table->hasColumn('kamaho_login_id')) {
            $table->addColumn('kamaho_login_id', 'string', [
                'limit' => 100,
                'null' => true,
                'default' => null,
                'after' => 'login_id',
            ]);
        }

        if (!$table->hasColumn('kamaho_password_enc')) {
            $table->addColumn('kamaho_password_enc', 'text', [
                'null' => true,
                'default' => null,
                'after' => 'kamaho_login_id',
            ]);
        }

        if (!$table->hasColumn('kamaho_linked_at')) {
            $table->addColumn('kamaho_linked_at', 'datetime', [
                'null' => true,
                'default' => null,
                'after' => 'kamaho_password_enc',
            ]);
        }

        $table->update();
    }
}
