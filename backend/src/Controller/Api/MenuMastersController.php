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
    private function parseAmount(mixed $value): float
    {
        if (is_numeric($value)) {
            return (float)$value;
        }
        if (!is_string($value)) {
            return 0.0;
        }

        $v = trim($value);
        if ($v === '') {
            return 0.0;
        }
        if (preg_match('/^([0-9]+(?:\.[0-9]+)?)\s*\/\s*([0-9]+(?:\.[0-9]+)?)$/', $v, $m)) {
            $num = (float)$m[1];
            $den = (float)$m[2];
            return $den > 0 ? $num / $den : 0.0;
        }

        return is_numeric($v) ? (float)$v : 0.0;
    }

    public function initialize(): void
    {
        parent::initialize();
        $this->MenuMasters = $this->fetchTable('MenuMasters');
        $this->MenuIngredients = $this->fetchTable('MenuIngredients');
    }

    /** GET /api/menu-masters.json?block_id=N (省略時は全件) */
    public function index(): void
    {
        $query = $this->MenuMasters->find('all')
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

        $blockId = isset($data['block_id']) && $data['block_id'] !== '' ? (int)$data['block_id'] : null;
        $dishCategory = isset($data['dish_category']) && $data['dish_category'] !== '' ? trim((string)$data['dish_category']) : null;
        $entity = $this->MenuMasters->newEntity([
            'name'             => trim((string)($data['name'] ?? '')),
            'dish_category'    => $dishCategory,
            'block_id'         => $blockId,
            'grams_per_person' => (float)($data['grams_per_person'] ?? 0),
            'memo'             => trim((string)($data['memo'] ?? '')),
        ]);

        if ($this->MenuMasters->save($entity)) {
            // 材料も同時保存
            if (!empty($data['ingredients'])) {
                $this->saveIngredients($entity->id, $data['ingredients']);
                $entity = $this->MenuMasters->get($entity->id, contain: ['MenuIngredients']);
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
        $entity = $this->MenuMasters->get($id);

        $blockId = array_key_exists('block_id', $data)
            ? (($data['block_id'] !== '' && $data['block_id'] !== null) ? (int)$data['block_id'] : null)
            : $entity->block_id;
        $dishCategory = array_key_exists('dish_category', $data)
            ? (($data['dish_category'] !== '' && $data['dish_category'] !== null) ? trim((string)$data['dish_category']) : null)
            : $entity->dish_category;
        $this->MenuMasters->patchEntity($entity, [
            'name'             => trim((string)($data['name'] ?? $entity->name)),
            'dish_category'    => $dishCategory,
            'block_id'         => $blockId,
            'grams_per_person' => (float)($data['grams_per_person'] ?? $entity->grams_per_person),
            'memo'             => trim((string)($data['memo'] ?? $entity->memo)),
        ]);

        if ($this->MenuMasters->save($entity)) {
            // 材料の更新
            if (array_key_exists('ingredients', $data)) {
                $this->saveIngredients($id, $data['ingredients']);
            }
            $entity = $this->MenuMasters->get($id, contain: ['MenuIngredients']);
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
        $entity = $this->MenuMasters->get($id);
        $this->MenuMasters->delete($entity);

        $this->set(['ok' => true]);
        $this->viewBuilder()->setOption('serialize', ['ok']);
    }

    /** 材料を一括保存（既存削除→再挿入） */
    private function saveIngredients(int $masterId, array $items): void
    {
        $this->MenuIngredients->deleteAll(['menu_master_id' => $masterId]);
        foreach ($items as $i => $item) {
            $name = trim((string)($item['name'] ?? ''));
            if (!$name) continue;
            $supplierId = isset($item['supplier_id']) && $item['supplier_id'] !== '' && $item['supplier_id'] !== null
                ? (int)$item['supplier_id'] : null;
            $ppu = isset($item['persons_per_unit']) && $item['persons_per_unit'] !== '' && $item['persons_per_unit'] !== null
                ? (int)$item['persons_per_unit'] : null;
            $this->MenuIngredients->save($this->MenuIngredients->newEntity([
                'menu_master_id'  => $masterId,
                'name'            => $name,
                'amount'          => $this->parseAmount($item['amount'] ?? 0),
                'unit'            => trim((string)($item['unit'] ?? 'g')),
                'persons_per_unit'=> $ppu,
                'supplier_id'     => $supplierId,
                'sort_order'      => $i,
            ]));
        }
    }
}
