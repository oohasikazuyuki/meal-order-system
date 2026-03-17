<?php
namespace App\Model\Table;

use Cake\ORM\Table;

class UsersTable extends Table
{
    public function initialize(array $config): void
    {
        parent::initialize($config);
        $this->setTable('users');
        $this->addBehavior('Timestamp');
        
        // Blocks テーブルとの関連付け
        $this->belongsTo('Blocks', [
            'foreignKey' => 'block_id',
            'joinType' => 'LEFT',
        ]);
    }
}
