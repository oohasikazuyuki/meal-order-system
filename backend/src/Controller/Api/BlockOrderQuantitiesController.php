<?php
namespace App\Controller\Api;

use App\Controller\AppController;
use Cake\Cache\Cache;
use App\Service\KamahoApiService;

/**
 * ブロック別発注数量 API
 *
 * GET  /api/block-order-quantities.json?date=YYYY-MM-DD
 *   → ブロック×食事種別の複合データ（kamaho食数・メニュー・グラム量含む）
 *
 * POST /api/block-order-quantities.json
 *   → upsert
 *
 * POST /api/block-order-quantities/import-kamaho.json
 *   → 期間の食数を kamaho から取り込み、部屋別の食数と発注数を上書きする
 */
class BlockOrderQuantitiesController extends AppController
{
    /** 連携先に接続できなかったことを一時的に覚えておくキー */
    private const KAMAHO_DOWN_KEY = 'kamaho_unavailable';

    public function initialize(): void
    {
        parent::initialize();
        $this->Blocks = $this->fetchTable('Blocks');
        $this->BlockOrderQuantities = $this->fetchTable('BlockOrderQuantities');
        $this->Menus = $this->fetchTable('Menus');
    }

    /**
     * GET /api/block-order-quantities.json?date=YYYY-MM-DD
     */
    public function index(): void
    {
        $user = $this->requireAuthenticatedUser();
        if ($user === null) {
            return;
        }

        $date = $this->request->getQuery('date', date('Y-m-d'));

        // 1. ブロック+部屋+グラム設定
        $blocks = $this->loadBlocks();

        // 2. 保存済みのblock_order_quantities
        $savedRows   = $this->BlockOrderQuantities->find()
            ->where(['order_date' => $date])
            ->toArray();
        $savedByBlockMeal = [];
        foreach ($savedRows as $row) {
            $savedByBlockMeal[$row->block_id][$row->meal_type] = $row;
        }

        // 3. kamahoから部屋別食数取得（kamaho の部屋ID => 食事種別 => 食数）
        //    保存済みの値があるセルでは kamaho の値を使わないため、
        //    全ブロック×全食事種別が保存済みなら外部通信そのものを省く。
        //    取れなかったときは null。0で埋めたまま保存されないよう画面に知らせる。
        $kamahoByRoom = $this->needsKamahoCounts($blocks, $savedByBlockMeal)
            ? $this->loadKamahoMealCounts($date)
            : [];
        if ($kamahoByRoom) {
            // 取得時に部屋の kamaho ID を記録しているので、読み直して反映する
            $blocks = $this->loadBlocks();
        }

        // 4. この日のメニュー一覧（名前・グラム量）
        $menuRows   = $this->Menus->find()
            ->where(['menu_date' => $date])
            ->toArray();
        $menuByType = []; // meal_type => ['name' => ..., 'grams_per_person' => ...]
        foreach ($menuRows as $menu) {
            $menuByType[(int)$menu->meal_type] = [
                'name'             => $menu->name,
                'grams_per_person' => (float)$menu->grams_per_person,
            ];
        }

        // 5. 合成
        $mealTypes = [1, 2, 3, 4];
        $result    = [];

        foreach ($blocks as $block) {
            $room1 = $block->room1;
            $room2 = $block->room2;

            $room1KamahoData = $kamahoByRoom[$room1?->kamaho_room_id] ?? [];
            $room2KamahoData = $kamahoByRoom[$room2?->kamaho_room_id] ?? [];

            $quantities = [];
            foreach ($mealTypes as $mt) {
                $saved = $savedByBlockMeal[$block->id][$mt] ?? null;

                $r1Count = isset($saved)
                    ? (int)$saved->room1_kamaho_count
                    : (int)($room1KamahoData[$mt] ?? 0);
                $r2Count = isset($saved)
                    ? (int)$saved->room2_kamaho_count
                    : (int)($room2KamahoData[$mt] ?? 0);

                $totalCount      = $r1Count + $r2Count;
                $gramsPerPerson  = $menuByType[$mt]['grams_per_person'] ?? 0.0;
                $totalGrams      = $totalCount * $gramsPerPerson;

                $quantities[] = [
                    'meal_type'          => $mt,
                    'menu_name'          => $menuByType[$mt]['name'] ?? null,
                    'grams_per_person'   => $gramsPerPerson,
                    'room1_kamaho_count' => $r1Count,
                    'room2_kamaho_count' => $r2Count,
                    'total_kamaho_count' => $totalCount,
                    'total_grams'        => $totalGrams,
                    'order_quantity'     => $saved ? (int)$saved->order_quantity : $totalCount,
                    'notes'              => $saved ? ($saved->notes ?? '') : '',
                    'saved_id'           => $saved ? (int)$saved->id : null,
                ];
            }

            $result[] = [
                'id'         => $block->id,
                'name'       => $block->name,
                'room1'      => ['id' => $room1 ? $room1->id : null, 'name' => $room1 ? $room1->name : null],
                'room2'      => ['id' => $room2 ? $room2->id : null, 'name' => $room2 ? $room2->name : null],
                'quantities' => $quantities,
            ];
        }

        $this->set(['ok' => true, 'date' => $date, 'blocks' => $result, 'kamaho_error' => $kamahoByRoom === null]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'date', 'blocks', 'kamaho_error']);
    }

    /**
     * POST /api/block-order-quantities/import-kamaho.json
     * { "from": "2026-10-26", "to": "2026-11-01" }
     *
     * kamaho の食数で、期間内の全ブロック×食事種別の部屋別食数と発注数を上書きする。
     * 備考は残す。取得に失敗したら何も書き込まない。
     */
    public function importKamaho(): void
    {
        $user = $this->requireAuthenticatedUser();
        if ($user === null) {
            return;
        }

        $from = (string)$this->request->getData('from');
        $to   = (string)$this->request->getData('to');
        $fromDate = \DateTimeImmutable::createFromFormat('!Y-m-d', $from);
        $toDate   = \DateTimeImmutable::createFromFormat('!Y-m-d', $to);
        if (!$fromDate || !$toDate || $fromDate > $toDate || $fromDate->diff($toDate)->days > 31) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'message' => 'from/to（YYYY-MM-DD、31日以内）を指定してください']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        try {
            $kamaho = (new KamahoApiService())->fetchMealCounts($from, $to);
        } catch (\RuntimeException $e) {
            $this->response = $this->response->withStatus(502);
            $this->set(['ok' => false, 'message' => $e->getMessage()]);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        $addedRooms = $this->fetchTable('Rooms')->syncKamahoRooms($kamaho['rooms']);
        $blocks = $this->loadBlocks();

        $saved = 0;
        $this->BlockOrderQuantities->getConnection()->transactional(function () use ($kamaho, $blocks, $fromDate, $toDate, &$saved) {
            for ($d = $fromDate; $d <= $toDate; $d = $d->modify('+1 day')) {
                $date = $d->format('Y-m-d');
                $byRoom = $kamaho['counts'][$date] ?? [];
                $existing = [];
                foreach ($this->BlockOrderQuantities->find()->where(['order_date' => $date]) as $row) {
                    $existing[$row->block_id][$row->meal_type] = $row;
                }
                foreach ($blocks as $block) {
                    foreach ([1, 2, 3, 4] as $mt) {
                        $r1 = (int)($byRoom[$block->room1?->kamaho_room_id][$mt] ?? 0);
                        $r2 = (int)($byRoom[$block->room2?->kamaho_room_id][$mt] ?? 0);
                        $entity = $existing[$block->id][$mt]
                            ?? $this->BlockOrderQuantities->newEntity(['order_date' => $date, 'block_id' => $block->id, 'meal_type' => $mt]);
                        $entity->set(['room1_kamaho_count' => $r1, 'room2_kamaho_count' => $r2, 'order_quantity' => $r1 + $r2]);
                        $this->BlockOrderQuantities->saveOrFail($entity);
                        $saved++;
                    }
                }
            }
        });

        // 発注に使われていない kamaho の部屋（ブロックに入っていない）を知らせる
        $usedIds = [];
        foreach ($blocks as $block) {
            $usedIds[] = $block->room1?->kamaho_room_id;
            $usedIds[] = $block->room2?->kamaho_room_id;
        }
        $unassigned = [];
        foreach ($kamaho['counts'] as $byRoom) {
            foreach ($byRoom as $kamahoId => $byMeal) {
                if (!in_array($kamahoId, $usedIds, true) && array_sum($byMeal) > 0) {
                    $unassigned[$kamahoId] = $kamaho['rooms'][$kamahoId] ?? (string)$kamahoId;
                }
            }
        }

        Cache::clear('kamaho');
        $this->set([
            'ok' => true,
            'saved' => $saved,
            'added_rooms' => $addedRooms,
            'unassigned_rooms' => array_values($unassigned),
        ]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'saved', 'added_rooms', 'unassigned_rooms']);
    }

    /**
     * POST /api/block-order-quantities.json
     * {
     *   "order_date": "2026-02-26",
     *   "items": [
     *     {
     *       "block_id": 1, "meal_type": 1,
     *       "room1_kamaho_count": 5, "room2_kamaho_count": 8,
     *       "order_quantity": 15, "notes": ""
     *     }, ...
     *   ]
     * }
     */
    public function add(): void
    {
        if ($this->requireAuthenticatedUser() === null) {
            return;
        }
        $data      = $this->request->getData();
        $orderDate = $data['order_date'] ?? null;
        $items     = $data['items'] ?? [];

        if (!$orderDate || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $orderDate)) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'message' => 'order_date が不正です']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        if (empty($items) || !is_array($items)) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'message' => 'items が空です']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        $saved  = [];
        $errors = [];

        foreach ($items as $item) {
            $blockId  = (int)($item['block_id'] ?? 0);
            $mealType = (int)($item['meal_type'] ?? 0);
            if (!$blockId || !in_array($mealType, [1, 2, 3, 4], true)) {
                continue;
            }

            $existing = $this->BlockOrderQuantities->find()
                ->where(['order_date' => $orderDate, 'block_id' => $blockId, 'meal_type' => $mealType])
                ->first();

            $entityData = array_merge($item, ['order_date' => $orderDate]);
            $entity = $existing
                ? $this->BlockOrderQuantities->patchEntity($existing, $entityData)
                : $this->BlockOrderQuantities->newEntity($entityData);

            if ($this->BlockOrderQuantities->save($entity)) {
                $saved[] = $entity;
            } else {
                $errors[] = $entity->getErrors();
            }
        }

        if (!empty($errors)) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'errors' => $errors]);
            $this->viewBuilder()->setOption('serialize', ['ok', 'errors']);
            return;
        }

        $this->set(['ok' => true, 'saved' => $saved]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'saved']);
    }

    private function loadBlocks(): array
    {
        return $this->Blocks->find('all')
            ->contain(['Room1', 'Room2'])
            ->orderBy(['Blocks.sort_order' => 'ASC', 'Blocks.id' => 'ASC'])
            ->toArray();
    }

    /**
     * 保存されていない枠が1つでもあるか（あるときだけ kamaho に問い合わせる）
     */
    private function needsKamahoCounts(array $blocks, array $savedByBlockMeal): bool
    {
        foreach ($blocks as $block) {
            foreach ([1, 2, 3, 4] as $mt) {
                if (!isset($savedByBlockMeal[$block->id][$mt])) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * kamaho の部屋別食数を取得する。取れなければ null。
     *
     * 1週間分の画面は同じ瞬間に7日分を並べて要求するため、結果も失敗も短時間キャッシュする。
     * 連携が未設定・停止中でも、7回続けて待たされることがなくなる。
     *
     * @return array<int, array<int, int>>|null kamaho の部屋ID => 食事種別 => 食数
     */
    private function loadKamahoMealCounts(string $date): ?array
    {
        // 直前に接続できなかったなら、他の日付でも試さない。
        // 連携先が落ちている間、画面を開くたびに全日分待たされるのを防ぐ。
        if (Cache::read(self::KAMAHO_DOWN_KEY, 'kamaho')) {
            return null;
        }

        $cacheKey = 'kamaho_meal_counts_' . $date;
        $cached   = Cache::read($cacheKey, 'kamaho');
        if (is_array($cached)) {
            return $cached;
        }

        try {
            $kamaho = (new KamahoApiService())->fetchMealCounts($date, $date);
        } catch (\Throwable $e) {
            Cache::write(self::KAMAHO_DOWN_KEY, true, 'kamaho');
            return null;
        }
        $this->fetchTable('Rooms')->syncKamahoRooms($kamaho['rooms']);
        $counts = $kamaho['counts'][$date] ?? [];

        Cache::write($cacheKey, $counts, 'kamaho');
        return $counts;
    }
}
