<?php
namespace App\Controller\Api;

use App\Controller\AppController;

/**
 * メニューマスタ API（料理名・グラム・材料の管理）
 *
 * GET    /api/menu-masters.json          → 一覧（材料含む）
 * POST   /api/menu-masters.json          → 新規作成
 * PUT    /api/menu-masters/:id.json      → 更新
 * DELETE /api/menu-masters/:id.json      → 削除
 */
class MenuMastersController extends AppController
{
    /** GET /api/menu-masters.json?block_id=N (省略時は全件) */
    public function index(): void
    {
        $query = $this->fetchTable('MenuMasters')
            ->find('all')
            ->contain(['MenuIngredients' => function ($q) {
                return $q->orderBy(['MenuIngredients.sort_order' => 'ASC', 'MenuIngredients.id' => 'ASC']);
            }])
            ->orderBy(['MenuMasters.name' => 'ASC']);

        $blockId = $this->request->getQuery('block_id');
        if ($blockId !== null) {
            // 指定ブロック専用 OR 全ブロック共通（block_id IS NULL）を返す
            $query->where(function ($exp) use ($blockId) {
                return $exp->or([
                    'MenuMasters.block_id' => (int)$blockId,
                    'MenuMasters.block_id IS' => null,
                ]);
            });
        }

        $masters = $query->toArray();

        $this->set(['ok' => true, 'menu_masters' => $masters]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'menu_masters']);
    }

    /** POST /api/menu-masters.json */
    public function add(): void
    {
        $data  = $this->request->getData();
        $table = $this->fetchTable('MenuMasters');

        $blockId = isset($data['block_id']) && $data['block_id'] !== '' ? (int)$data['block_id'] : null;
        $entity = $table->newEntity([
            'name'             => trim((string)($data['name'] ?? '')),
            'block_id'         => $blockId,
            'grams_per_person' => (float)($data['grams_per_person'] ?? 0),
            'memo'             => trim((string)($data['memo'] ?? '')),
        ]);

        if ($table->save($entity)) {
            // 材料も同時保存
            if (!empty($data['ingredients'])) {
                $this->saveIngredients($entity->id, $data['ingredients']);
                $entity = $table->get($entity->id, contain: ['MenuIngredients']);
            }
            $this->response = $this->response->withStatus(201);
            $this->set(['ok' => true, 'menu_master' => $entity]);
        } else {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'errors' => $entity->getErrors()]);
        }
        $this->viewBuilder()->setOption('serialize', ['ok', 'menu_master', 'errors']);
    }

    /** PUT /api/menu-masters/:id.json */
    public function edit(int $id): void
    {
        $data  = $this->request->getData();
        $table = $this->fetchTable('MenuMasters');
        $entity = $table->get($id);

        $blockId = array_key_exists('block_id', $data)
            ? (($data['block_id'] !== '' && $data['block_id'] !== null) ? (int)$data['block_id'] : null)
            : $entity->block_id;
        $table->patchEntity($entity, [
            'name'             => trim((string)($data['name'] ?? $entity->name)),
            'block_id'         => $blockId,
            'grams_per_person' => (float)($data['grams_per_person'] ?? $entity->grams_per_person),
            'memo'             => trim((string)($data['memo'] ?? $entity->memo)),
        ]);

        if ($table->save($entity)) {
            // 材料の更新
            if (array_key_exists('ingredients', $data)) {
                $this->saveIngredients($id, $data['ingredients']);
            }
            $entity = $table->get($id, contain: ['MenuIngredients']);
            $this->set(['ok' => true, 'menu_master' => $entity]);
        } else {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'errors' => $entity->getErrors()]);
        }
        $this->viewBuilder()->setOption('serialize', ['ok', 'menu_master', 'errors']);
    }

    /** DELETE /api/menu-masters/:id.json */
    public function delete(int $id): void
    {
        $table  = $this->fetchTable('MenuMasters');
        $entity = $table->get($id);
        $table->delete($entity);

        $this->set(['ok' => true]);
        $this->viewBuilder()->setOption('serialize', ['ok']);
    }

    /** 材料を一括保存（既存削除→再挿入） */
    private function saveIngredients(int $masterId, array $items): void
    {
        $ingTable = $this->fetchTable('MenuIngredients');
        $ingTable->deleteAll(['menu_master_id' => $masterId]);
        foreach ($items as $i => $item) {
            $name = trim((string)($item['name'] ?? ''));
            if (!$name) continue;
            $ingTable->save($ingTable->newEntity([
                'menu_master_id' => $masterId,
                'name'           => $name,
                'amount'         => (float)($item['amount'] ?? 0),
                'unit'           => trim((string)($item['unit'] ?? 'g')),
                'sort_order'     => $i,
            ]));
        }
    }
}
