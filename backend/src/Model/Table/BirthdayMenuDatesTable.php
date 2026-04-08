<?php
namespace App\Model\Table;

use Cake\ORM\Table;
use Cake\Validation\Validator;

class BirthdayMenuDatesTable extends Table
{
    public function initialize(array $config): void
    {
        parent::initialize($config);
        $this->setTable('birthday_menu_dates');
        $this->addBehavior('Timestamp');
    }

    public function validationDefault(Validator $validator): Validator
    {
        $validator
            ->date('menu_date')
            ->notEmptyString('menu_date')
            ->allowEmptyString('memo');
        return $validator;
    }
}
