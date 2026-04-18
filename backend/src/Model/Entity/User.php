<?php
namespace App\Model\Entity;

use Cake\ORM\Entity;

class User extends Entity
{
    protected array $_accessible = [
        'name'      => true,
        'login_id'  => true,
        'kamaho_login_id' => true,
        'kamaho_password_enc' => true,
        'kamaho_linked_at' => true,
        'password'  => true,
        'role'      => true,
        'block_id'  => true,
        'api_token' => true,
    ];

    protected array $_hidden = ['password', 'kamaho_password_enc'];
}
