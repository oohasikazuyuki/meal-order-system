<?php
namespace App\Repository;

use App\Model\Table\MenusTable;
use Cake\ORM\Locator\LocatorAwareTrait;

class MenuRepository
{
    use LocatorAwareTrait;

    private MenusTable $Menus;

    public function __construct()
    {
        $this->Menus = $this->fetchTable('Menus');
    }

    public function findAll(array $conditions = [], array $options = []): array
    {
        $query = $this->Menus->find('all');

        if (!empty($conditions)) {
            $query->where($conditions);
        }

        if (isset($options['order'])) {
            $query->orderBy($options['order']);
        }

        return $query->toArray();
    }

    public function findByDateRange(string $from, string $to): array
    {
        return $this->Menus->find('all')
            ->where(['menu_date >=' => $from, 'menu_date <=' => $to])
            ->orderBy(['menu_date' => 'ASC', 'meal_type' => 'ASC'])
            ->toArray();
    }

    public function findByDateRangeAndBlock(string $from, string $to, int $blockId): array
    {
        return $this->Menus->find('all')
            ->where([
                'menu_date >=' => $from,
                'menu_date <=' => $to,
                'block_id' => $blockId,
            ])
            ->orderBy(['menu_date' => 'ASC', 'meal_type' => 'ASC'])
            ->toArray();
    }

    public function findByDateMealTypeAndBlock(string $menuDate, int $mealType, int $blockId)
    {
        return $this->Menus->find()
            ->where([
                'menu_date' => $menuDate,
                'meal_type' => $mealType,
                'block_id' => $blockId
            ])
            ->first();
    }

    /**
     * dish_category も含めた upsert 用検索。
     * 新ユニーク制約 (menu_date, meal_type, block_id, dish_category) に対応。
     */
    public function findByDateMealTypeCategoryAndBlock(string $menuDate, int $mealType, string $dishCategory, int $blockId)
    {
        return $this->Menus->find()
            ->where([
                'menu_date'     => $menuDate,
                'meal_type'     => $mealType,
                'dish_category' => $dishCategory,
                'block_id'      => $blockId,
            ])
            ->first();
    }

    public function save($entity): bool
    {
        return (bool)$this->Menus->save($entity);
    }

    public function create(array $data)
    {
        return $this->Menus->newEntity($data);
    }

    public function patch($entity, array $data)
    {
        return $this->Menus->patchEntity($entity, $data);
    }

    public function delete($entity): bool
    {
        return (bool)$this->Menus->delete($entity);
    }

    public function get(int $id)
    {
        return $this->Menus->get($id);
    }

    public function deleteByDateRangeAndBlocks(string $from, string $to, array $blockIds): int
    {
        if (empty($blockIds)) {
            return 0;
        }

        return $this->Menus->deleteAll([
            'menu_date >=' => $from,
            'menu_date <=' => $to,
            'block_id IN' => array_values(array_unique(array_map('intval', $blockIds))),
        ]);
    }

    public function saveMany(array $rows): int
    {
        $saved = 0;
        foreach ($rows as $row) {
            $entity = $this->Menus->newEntity($row);
            if ($this->Menus->save($entity)) {
                $saved++;
            }
        }
        return $saved;
    }
}
