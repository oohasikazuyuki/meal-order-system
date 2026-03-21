<?php
namespace App\Model\Entity;

use Cake\ORM\Entity;

class MenuMaster extends Entity
{
    protected array $_accessible = [
        'name'             => true,
        'dish_category'    => true,
        'block_id'         => true,
        'grams_per_person' => true,
        'memo'             => true,
    ];
}
