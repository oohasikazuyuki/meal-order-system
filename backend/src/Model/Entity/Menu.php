<?php
namespace App\Model\Entity;

use Cake\ORM\Entity;

class Menu extends Entity
{
    protected array $_accessible = [
        'name'             => true,
        'dish_category'    => true,
        'menu_date'        => true,
        'date'             => true,
        'meal_type'        => true,
        'block_id'         => true,
        'grams_per_person' => true,
        'capacity'         => true,
    ];
}
