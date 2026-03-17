<?php
namespace App\Controller\Api;

use App\Controller\AppController;
use App\Service\KamahoApiService;

/**
 * ブロック別発注数量 API
 *
 * GET  /api/block-order-quantities.json?date=YYYY-MM-DD
 *   → ブロック×食事種別の複合データ（kamaho食数・メニュー・グラム量含む）
 *
 * POST /api/block-order-quantities.json
 *   → upsert
 */
class BlockOrderQuantitiesController extends AppController
{
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
        $date = $this->request->getQuery('date', date('Y-m-d'));

        // 1. ブロック+部屋+グラム設定
        $blocks = $this->Blocks->find('all')
            ->contain(['Room1', 'Room2'])
            ->orderBy(['Blocks.sort_order' => 'ASC', 'Blocks.id' => 'ASC'])
            ->toArray();

        // 2. kamahoから部屋別食数取得
        $kamahoByRoom = [];
        try {
            $service      = new KamahoApiService();
            $kamahoByRoom = $service->getMealCountsByRoomForDate($date);
        } catch (\Throwable $e) {
            // kamaho が取れなくても継続（0扱い）
        }

        // 3. 保存済みのblock_order_quantities
        $savedRows   = $this->BlockOrderQuantities->find()
            ->where(['order_date' => $date])
            ->toArray();
        $savedByBlockMeal = [];
        foreach ($savedRows as $row) {
            $savedByBlockMeal[$row->block_id][$row->meal_type] = $row;
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

            // kamahoの部屋名でマッチング
            $room1KamahoData = $room1 ? ($kamahoByRoom[$room1->name] ?? []) : [];
            $room2KamahoData = $room2 ? ($kamahoByRoom[$room2->name] ?? []) : [];

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

        $this->set(['ok' => true, 'date' => $date, 'blocks' => $result]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'date', 'blocks']);
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
}
