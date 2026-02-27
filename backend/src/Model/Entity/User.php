<?php
namespace App\Model\Entity;

use Cake\ORM\Entity;

class User extends Entity
{
    protected array $_accessible = [
        'name'      => true,
        'login_id'  => true,
        'password'  => true,
        'role'      => true,
        'block_id'  => true,
        'api_token' => true,
    ];

    protected array $_hidden = ['password'];
}
