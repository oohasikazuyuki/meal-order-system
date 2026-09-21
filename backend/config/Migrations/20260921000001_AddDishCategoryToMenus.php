<?php
use Migrations\AbstractMigration;

class AddDishCategoryToMenus extends AbstractMigration
{
    public function change(): void
    {
        $table = $this->table('menus');
        if (!$table->hasColumn('dish_category')) {
            $table->addColumn('dish_category', 'string', [
                'limit'   => 50,
                'null'    => true,
                'default' => null,
                'after'   => 'name',
            ])->update();
        }
    }
}
