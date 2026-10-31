<?php
namespace App\Model\Table;

use Cake\Database\Expression\FunctionExpression;
use Cake\Database\Expression\IdentifierExpression;
use Cake\Database\Expression\QueryExpression;
use Cake\ORM\Query\SelectQuery;
use Cake\ORM\Table;
use Cake\Validation\Validator;

class MenusTable extends Table
{
    public function initialize(array $config): void
    {
        parent::initialize($config);
        $this->setTable('menus');
        $this->addBehavior('Timestamp');
    }

    public function validationDefault(Validator $validator): Validator
    {
        $validator
            ->notEmptyString('name')
            ->date('menu_date')
            ->integer('meal_type')
            ->inList('meal_type', [1, 2, 3, 4])
            ->integer('block_id')
            ->decimal('grams_per_person');
        return $validator;
    }

    /**
     * 献立（Menus）に、名前が同じメニューマスタを mm として結ぶ。
     *
     * 同じ名前のブロック専用マスタがあれば共通マスタ（block_id IS NULL）は使わない。
     * 両方を結ぶと材料が2回足されて発注数が倍になる。
     */
    public function findWithMaster(SelectQuery $query): SelectQuery
    {
        $blockSpecificExists = $this->getConnection()
            ->selectQuery(['mm2.id'], ['mm2' => 'menu_masters'])
            ->where(fn(QueryExpression $exp) => $exp
                ->equalFields('mm2.name', 'Menus.name')
                ->equalFields('mm2.block_id', 'Menus.block_id'));

        return $query->innerJoin(['mm' => 'menu_masters'], fn(QueryExpression $exp) => $exp
            ->equalFields('mm.name', 'Menus.name')
            ->add($exp->or(fn(QueryExpression $or) => $or
                ->equalFields('mm.block_id', 'Menus.block_id')
                ->add($or->and(fn(QueryExpression $and) => $and
                    ->isNull('mm.block_id')
                    ->notExists($blockSpecificExists))))));
    }

    /** 献立のブロック・日・食事区分の発注数（block_order_quantities）を boq として結ぶ。無ければ NULL */
    public function findWithOrderQuantity(SelectQuery $query): SelectQuery
    {
        return $query->leftJoin(['boq' => 'block_order_quantities'], fn(QueryExpression $exp) => $exp
            ->equalFields('boq.order_date', 'Menus.menu_date')
            ->equalFields('boq.block_id', 'Menus.block_id')
            ->equalFields('boq.meal_type', 'Menus.meal_type'));
    }

    /** COALESCE(boq.order_quantity, 0) */
    public function orderQuantity(SelectQuery $query): FunctionExpression
    {
        return $query->func()->coalesce(['boq.order_quantity' => 'identifier', 0], [0 => 'integer']);
    }

    /** mi.amount * COALESCE(boq.order_quantity, 0)。1人あたり量 × 人数 */
    public function ingredientAmount(SelectQuery $query): QueryExpression
    {
        return $query->expr()
            ->add([new IdentifierExpression('mi.amount'), $this->orderQuantity($query)])
            ->setConjunction('*');
    }
}
