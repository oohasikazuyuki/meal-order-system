<?php
use Migrations\AbstractMigration;

class AddDishCategoryToMenuMasters extends AbstractMigration
{
    public function change(): void
    {
        $this->table('menu_masters')
            ->addColumn('dish_category', 'string', [
                'limit'   => 50,
                'null'    => true,
                'default' => null,
                'after'   => 'name',
            ])
            ->update();
    }
}
