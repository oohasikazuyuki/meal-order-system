<?php
namespace App\Model\Entity;

use Cake\ORM\Entity;

class MenuIngredient extends Entity
{
    protected array $_accessible = [
        'menu_master_id' => true,
        'name'           => true,
        'amount'         => true,
        'unit'           => true,
        'sort_order'     => true,
    ];
}
