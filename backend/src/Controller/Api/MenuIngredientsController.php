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

        $ingredients = $this->fetchTable('MenuIngredients')
            ->find()
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

        $table = $this->fetchTable('MenuIngredients');
        $table->deleteAll(['menu_master_id' => $masterId]);

        $saved = [];
        foreach ($items as $i => $item) {
            if (empty(trim((string)($item['name'] ?? '')))) continue;
            $entity = $table->newEntity([
                'menu_master_id' => $masterId,
                'name'           => trim((string)($item['name'] ?? '')),
                'amount'         => (float)($item['amount'] ?? 0),
                'unit'           => trim((string)($item['unit'] ?? 'g')),
                'sort_order'     => $i,
            ]);
            if ($table->save($entity)) $saved[] = $entity;
        }

        $this->set(['ok' => true, 'ingredients' => $saved]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'ingredients']);
    }
}
