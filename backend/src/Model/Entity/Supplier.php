<?php
namespace App\Model\Entity;

use Cake\ORM\Entity;

class Supplier extends Entity
{
    protected array $_accessible = [
        'name'             => true,
        'code'             => true,
        'has_order_sheet'  => true,
        'delivery_days'    => true,
        'order_day'            => true,
        'delivery_lead_weeks'  => true,
        'file_ext'             => true,
        'notes'            => true,
    ];
}
