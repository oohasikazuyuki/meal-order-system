<?php
namespace App\Model\Entity;

use Cake\ORM\Entity;

class Menu extends Entity
{
    protected array $_accessible = [
        'name'             => true,
        'menu_date'        => true,
        'meal_type'        => true,
        'block_id'         => true,
        'grams_per_person' => true,
    ];
}
