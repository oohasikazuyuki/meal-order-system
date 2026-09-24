<?php
namespace App\Repository;

use App\Model\Table\BirthdayMenuDatesTable;
use Cake\ORM\Locator\LocatorAwareTrait;

class BirthdayMenuDateRepository
{
    use LocatorAwareTrait;

    private BirthdayMenuDatesTable $BirthdayMenuDates;

    public function __construct()
    {
        $this->BirthdayMenuDates = $this->fetchTable('BirthdayMenuDates');
    }

    public function findByMonthAndBlock(int $year, int $month, ?int $blockId): array
    {
        $from = sprintf('%04d-%02d-01', $year, $month);
        $to   = date('Y-m-t', strtotime($from));

        $query = $this->BirthdayMenuDates->find()
            ->where(['menu_date >=' => $from, 'menu_date <=' => $to]);

        if ($blockId !== null) {
            $query->where(function ($exp) use ($blockId) {
                return $exp->or([
                    'block_id IS' => null,
                    'block_id'    => $blockId,
                ]);
            });
        }

        return $query->orderBy(['menu_date' => 'ASC'])->toArray();
    }

    /**
     * 日付範囲内の誕生日メニュー日付の文字列配列を返す（スケジュールフィルタ用）
     */
    public function findDatesByDateRange(string $from, string $to, ?int $blockId): array
    {
        $query = $this->BirthdayMenuDates->find()
            ->select(['menu_date'])
            ->where(['menu_date >=' => $from, 'menu_date <=' => $to]);

        if ($blockId !== null) {
            $query->where(function ($exp) use ($blockId) {
                return $exp->or([
                    'block_id IS' => null,
                    'block_id'    => $blockId,
                ]);
            });
        }

        return array_unique(
            array_map(fn($r) => (string)$r->menu_date, $query->toArray())
        );
    }

    public function findByDateAndBlock(string $menuDate, ?int $blockId)
    {
        $query = $this->BirthdayMenuDates->find()
            ->where(['menu_date' => $menuDate]);

        if ($blockId !== null) {
            $query->where(['block_id IS' => $blockId]);
        } else {
            $query->where(['block_id IS' => null]);
        }

        return $query->first();
    }

    public function get(int $id)
    {
        return $this->BirthdayMenuDates->get($id);
    }

    public function create(array $data)
    {
        return $this->BirthdayMenuDates->newEntity($data);
    }

    public function patch($entity, array $data)
    {
        return $this->BirthdayMenuDates->patchEntity($entity, $data);
    }

    public function save($entity): bool
    {
        return (bool)$this->BirthdayMenuDates->save($entity);
    }

    public function delete($entity): bool
    {
        return (bool)$this->BirthdayMenuDates->delete($entity);
    }
}
