<?php
namespace App\Service;

use App\Repository\MenuRepository;
use DateTime;

class MenuService
{
    private MenuRepository $menuRepository;

    public function __construct()
    {
        $this->menuRepository = new MenuRepository();
    }

    /**
     * メニュー一覧取得
     */
    public function getMenus(?string $date = null, ?int $year = null, ?int $month = null): array
    {
        if ($date) {
            return $this->menuRepository->findAll(
                ['menu_date' => $date],
                ['order' => ['menu_date' => 'ASC', 'meal_type' => 'ASC']]
            );
        }

        if ($year && $month) {
            $from = sprintf('%04d-%02d-01', $year, $month);
            $to = date('Y-m-t', strtotime($from));
            return $this->menuRepository->findByDateRange($from, $to);
        }

        return $this->menuRepository->findAll([], [
            'order' => ['menu_date' => 'ASC', 'meal_type' => 'ASC']
        ]);
    }

    /**
     * メニュー登録（date+meal_typeでupsert）
     */
    public function saveMenu(array $data): array
    {
        // 既存DB互換: menus.date(必須) がある環境では menu_date を複製して保存
        if (!isset($data['date']) && !empty($data['menu_date'])) {
            $data['date'] = $data['menu_date'];
        }

        $menuDate = $data['menu_date'] ?? null;
        $mealType = isset($data['meal_type']) ? (int)$data['meal_type'] : null;
        $blockId = isset($data['block_id']) ? (int)$data['block_id'] : null;

        $existing = null;
        if ($menuDate && $mealType && $blockId) {
            $existing = $this->menuRepository->findByDateMealTypeAndBlock(
                $menuDate,
                $mealType,
                $blockId
            );
        }

        $menu = $existing
            ? $this->menuRepository->patch($existing, $data)
            : $this->menuRepository->create($data);

        $success = $this->menuRepository->save($menu);

        return [
            'success' => $success,
            'status' => $success ? ($existing ? 200 : 201) : 400,
            'menu' => $success ? $menu : null,
            'errors' => $success ? [] : $menu->getErrors()
        ];
    }

    /**
     * メニュー削除
     */
    public function deleteMenu(int $id): bool
    {
        $entity = $this->menuRepository->get($id);
        return $this->menuRepository->delete($entity);
    }

    /**
     * 2ヶ月ルーティンなどの期間コピー
     */
    public function copyRoutine(
        string $sourceStartStr,
        string $targetStartStr,
        int $months = 2,
        bool $includeBirthdayMenu = true,
        bool $replaceExisting = true,
        ?int $blockId = null
    ): array {
        try {
            $sourceStart = DateTime::createFromFormat('Y-m-d', $sourceStartStr);
            $targetStart = DateTime::createFromFormat('Y-m-d', $targetStartStr);
            if (!$sourceStart || !$targetStart) {
                return [
                    'ok' => false,
                    'status' => 400,
                    'message' => 'source_start / target_start は YYYY-MM-DD 形式で指定してください',
                ];
            }

            $months = max(1, min(12, $months));
            $sourceEnd = (clone $sourceStart)->modify("+{$months} months")->modify('-1 day');
            $targetEnd = (clone $targetStart)->modify("+{$months} months")->modify('-1 day');

            $sourceMenus = $blockId
                ? $this->menuRepository->findByDateRangeAndBlock($sourceStart->format('Y-m-d'), $sourceEnd->format('Y-m-d'), $blockId)
                : $this->menuRepository->findByDateRange($sourceStart->format('Y-m-d'), $sourceEnd->format('Y-m-d'));

            $offsetDays = (int)$sourceStart->diff($targetStart)->format('%r%a');
            $rows = [];
            $blockIds = [];

            foreach ($sourceMenus as $m) {
                if (!$includeBirthdayMenu && str_contains((string)$m->name, '誕生日')) {
                    continue;
                }

                $newDate = (new DateTime((string)$m->menu_date))
                    ->modify(($offsetDays >= 0 ? '+' : '') . $offsetDays . ' days')
                    ->format('Y-m-d');

                $row = [
                    'name' => (string)$m->name,
                    'menu_date' => $newDate,
                    'date' => $newDate,
                    'meal_type' => (int)$m->meal_type,
                    'block_id' => (int)$m->block_id,
                ];
                // NULLを明示保存するとDB制約で失敗する環境があるため、値がある場合のみ引き継ぐ
                if ($m->grams_per_person !== null) {
                    $row['grams_per_person'] = (float)$m->grams_per_person;
                }
                $rows[] = $row;
                $blockIds[] = (int)$m->block_id;
            }

            $deleted = 0;
            if ($replaceExisting && !empty($rows)) {
                $deleted = $this->menuRepository->deleteByDateRangeAndBlocks(
                    $targetStart->format('Y-m-d'),
                    $targetEnd->format('Y-m-d'),
                    $blockIds
                );
            }

            $copied = empty($rows) ? 0 : $this->menuRepository->saveMany($rows);

            return [
                'ok' => true,
                'status' => 200,
                'source_start' => $sourceStart->format('Y-m-d'),
                'source_end' => $sourceEnd->format('Y-m-d'),
                'target_start' => $targetStart->format('Y-m-d'),
                'target_end' => $targetEnd->format('Y-m-d'),
                'months' => $months,
                'deleted' => $deleted,
                'copied' => $copied,
            ];
        } catch (\Throwable $e) {
            return [
                'ok' => false,
                'status' => 500,
                'message' => '献立コピー中にエラーが発生しました',
                'error' => $e->getMessage(),
            ];
        }
    }
}
