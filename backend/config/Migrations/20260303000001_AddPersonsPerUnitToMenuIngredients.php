<?php
use Migrations\AbstractMigration;

class AddPersonsPerUnitToMenuIngredients extends AbstractMigration
{
    public function change(): void
    {
        if (!$this->hasTable('menu_ingredients')) {
            return;
        }

        $table = $this->table('menu_ingredients');
        if ($table->hasColumn('persons_per_unit')) {
            return;
        }

        $table
            ->addColumn('persons_per_unit', 'integer', [
                'null'    => true,
                'default' => null,
                'comment' => '何人で1単位か（例: 3人で1束）。NULLの場合は従来の amount×人数 計算',
                'after'   => 'unit',
            ])
            ->update();
    }
}
