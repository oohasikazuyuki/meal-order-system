<?php
namespace App\Model\Entity;

use Cake\ORM\Entity;

class BirthdayMenuDate extends Entity
{
    protected array $_accessible = [
        'menu_date' => true,
        'block_id'  => true,
        'memo'      => true,
    ];
}
