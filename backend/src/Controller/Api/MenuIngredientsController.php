<?php
namespace App\Controller\Api;

use App\Controller\AppController;

/**
 * メニュー材料 API
 *
 * GET  /api/menu-ingredients.json?menu_master_id=:id  → 一覧
 * POST /api/menu-ingredients.json                     → バッチ保存
 */
class MenuIngredientsController extends AppController
{
    public function initialize(): void
    {
        parent::initialize();
        $this->MenuIngredients = $this->fetchTable('MenuIngredients');
    }

    /** GET /api/menu-ingredients.json?menu_master_id=:id */
    public function index(): void
    {
        $masterId = $this->request->getQuery('menu_master_id');
        if (!$masterId) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'message' => 'menu_master_id is required']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        $ingredients = $this->MenuIngredients->find()
            ->where(['menu_master_id' => (int)$masterId])
            ->orderBy(['sort_order' => 'ASC', 'id' => 'ASC'])
            ->toArray();

        $this->set(['ok' => true, 'ingredients' => $ingredients]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'ingredients']);
    }

    /**
     * POST /api/menu-ingredients.json
     * body: { menu_master_id: int, items: [{name, amount, unit}] }
     */
    public function add(): void
    {
        $data     = $this->request->getData();
        $masterId = isset($data['menu_master_id']) ? (int)$data['menu_master_id'] : null;
        $items    = $data['items'] ?? [];

        if (!$masterId) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'message' => 'menu_master_id is required']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        $this->MenuIngredients->deleteAll(['menu_master_id' => $masterId]);

        $saved = [];
        foreach ($items as $i => $item) {
            if (empty(trim((string)($item['name'] ?? '')))) continue;
            $supplierId = isset($item['supplier_id']) && $item['supplier_id'] !== '' && $item['supplier_id'] !== null
                ? (int)$item['supplier_id'] : null;
            $ppu = isset($item['persons_per_unit']) && $item['persons_per_unit'] !== '' && $item['persons_per_unit'] !== null
                ? (int)$item['persons_per_unit'] : null;
            $entity = $this->MenuIngredients->newEntity([
                'menu_master_id'  => $masterId,
                'name'            => trim((string)($item['name'] ?? '')),
                'amount'          => (float)($item['amount'] ?? 0),
                'unit'            => trim((string)($item['unit'] ?? 'g')),
                'persons_per_unit'=> $ppu,
                'supplier_id'     => $supplierId,
                'sort_order'      => $i,
            ]);
            if ($this->MenuIngredients->save($entity)) $saved[] = $entity;
        }

        $this->set(['ok' => true, 'ingredients' => $saved]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'ingredients']);
    }
}
