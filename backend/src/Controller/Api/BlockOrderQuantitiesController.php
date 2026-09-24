<?php
namespace App\Controller\Api;

use App\Controller\AppController;
use Cake\Cache\Cache;
use App\Service\KamahoApiService;
use App\Service\KamahoCredentialResolverService;

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
    /** 連携先に接続できなかったことを一時的に覚えておくキー */
    private const KAMAHO_DOWN_KEY = 'kamaho_unavailable';

    private KamahoCredentialResolverService $kamahoCredentialResolverService;

    public function initialize(): void
    {
        parent::initialize();
        $this->Blocks = $this->fetchTable('Blocks');
        $this->BlockOrderQuantities = $this->fetchTable('BlockOrderQuantities');
        $this->Menus = $this->fetchTable('Menus');
        $this->kamahoCredentialResolverService = new KamahoCredentialResolverService();
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
        $blocks = $this->Blocks->find('all')
            ->contain(['Room1', 'Room2'])
            ->orderBy(['Blocks.sort_order' => 'ASC', 'Blocks.id' => 'ASC'])
            ->toArray();

        // 2. 保存済みのblock_order_quantities
        $savedRows   = $this->BlockOrderQuantities->find()
            ->where(['order_date' => $date])
            ->toArray();
        $savedByBlockMeal = [];
        foreach ($savedRows as $row) {
            $savedByBlockMeal[$row->block_id][$row->meal_type] = $row;
        }

        // 3. kamahoから部屋別食数取得
        //    保存済みの値があるセルでは kamaho の値を使わないため、
        //    全ブロック×全食事種別が保存済みなら外部通信そのものを省く。
        $kamahoByRoom = $this->needsKamahoCounts($blocks, $savedByBlockMeal)
            ? $this->loadKamahoMealCounts($date)
            : [];

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
     * kamaho の部屋別食数を取得する。
     *
     * 1週間分の画面は同じ瞬間に7日分を並べて要求するため、結果も失敗も短時間キャッシュする。
     * 連携が未設定・停止中でも、7回続けて数百msずつ待たされることがなくなる。
     */
    private function loadKamahoMealCounts(string $date): array
    {
        $cacheKey = 'kamaho_meal_counts_' . $date;
        $cached   = Cache::read($cacheKey, 'kamaho');
        if ($cached !== null) {
            return is_array($cached) ? $cached : [];
        }

        // 直前に接続できなかったなら、他の日付でも試さずに0扱いで返す。
        // 連携先が落ちている間、画面を開くたびに全日分待たされるのを防ぐ。
        if (Cache::read(self::KAMAHO_DOWN_KEY, 'kamaho')) {
            return [];
        }

        $counts = [];
        try {
            $counts = $this->buildKamahoServiceFromRequest()->getMealCountsByRoomForDate($date);
        } catch (\Throwable $e) {
            // kamaho が取れなくても継続（0扱い）
            Cache::write(self::KAMAHO_DOWN_KEY, true, 'kamaho');
        }

        // 失敗時（空配列）も書き込む。同じ失敗を短時間で繰り返し試さないため。
        Cache::write($cacheKey, $counts, 'kamaho');

        return $counts;
    }

    private function buildKamahoServiceFromRequest(): KamahoApiService
    {
        $options = $this->kamahoCredentialResolverService->resolveKamahoOptions($this->request);
        return new KamahoApiService($options);
    }
}
