<?php
namespace App\Controller\Api;

use App\Controller\AppController;

/**
 * 発注数量 CRUD API
 *
 * GET    /api/order-quantities.json?date=YYYY-MM-DD  → 指定日の発注数量一覧
 * POST   /api/order-quantities.json                  → 一括保存（upsert）
 * DELETE /api/order-quantities/:id.json              → 削除
 */
class OrderQuantitiesController extends AppController
{
    public function initialize(): void
    {
        parent::initialize();
        $this->DailyOrderQuantities = $this->fetchTable('DailyOrderQuantities');
    }

    /**
     * GET /api/order-quantities.json?date=YYYY-MM-DD
     * 指定日の全食事種別の発注数量を返す
     */
    public function index(): void
    {
        $user = $this->requireAuthenticatedUser();
        if ($user === null) {
            return;
        }

        $date = $this->request->getQuery('date', date('Y-m-d'));

        $rows = $this->DailyOrderQuantities->find('all')
            ->where(['order_date' => $date])
            ->orderBy(['meal_type' => 'ASC'])
            ->toArray();

        $this->set(['ok' => true, 'date' => $date, 'user' => $user, 'quantities' => $rows]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'date', 'user', 'quantities']);
    }

    /**
     * POST /api/order-quantities.json
     * 指定日の発注数量を一括保存（meal_type ごとに upsert）
     *
     * リクエストボディ:
     * {
     *   "order_date": "2026-03-01",
     *   "items": [
     *     {"meal_type": 1, "kamaho_count": 5, "order_quantity": 6, "notes": ""},
     *     {"meal_type": 2, "kamaho_count": 10, "order_quantity": 10, "notes": ""},
     *     ...
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
            $mealType = (int)($item['meal_type'] ?? 0);
            if (!in_array($mealType, [1, 2, 3, 4], true)) {
                continue;
            }

            // upsert: 既存レコードを取得、なければ新規作成
            $existing = $this->DailyOrderQuantities->find()
                ->where(['order_date' => $orderDate, 'meal_type' => $mealType])
                ->first();

            $entity = $existing
                ? $this->DailyOrderQuantities->patchEntity($existing, $item)
                : $this->DailyOrderQuantities->newEntity(array_merge($item, ['order_date' => $orderDate]));

            if ($this->DailyOrderQuantities->save($entity)) {
                $saved[] = $entity;
            } else {
                $errors[$mealType] = $entity->getErrors();
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
     * DELETE /api/order-quantities/:id.json
     */
    public function delete(int $id): void
    {
        $entity = $this->DailyOrderQuantities->get($id);
        $this->DailyOrderQuantities->delete($entity);

        $this->set(['ok' => true]);
        $this->viewBuilder()->setOption('serialize', ['ok']);
    }
}
