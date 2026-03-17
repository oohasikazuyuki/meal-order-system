<?php
namespace App\Model\Entity;

use Cake\ORM\Entity;

class MenuIngredient extends Entity
{
    protected array $_accessible = [
        'menu_master_id'  => true,
        'name'            => true,
        'amount'          => true,
        'unit'            => true,
        'persons_per_unit'=> true,
        'supplier_id'     => true,
        'sort_order'      => true,
    ];
}
