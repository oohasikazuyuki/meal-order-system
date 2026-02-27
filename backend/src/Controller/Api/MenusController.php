<?php
namespace App\Controller\Api;

use App\Controller\AppController;

class MenusController extends AppController
{
    /**
     * GET /api/menus.json
     *   ?date=YYYY-MM-DD       → 特定日
     *   ?year=YYYY&month=MM    → 月全体（カレンダー用）
     */
    public function index(): void
    {
        $table = $this->fetchTable('Menus');
        $query = $table->find('all');

        $date  = $this->request->getQuery('date');
        $year  = $this->request->getQuery('year');
        $month = $this->request->getQuery('month');

        if ($date) {
            $query->where(['Menus.menu_date' => $date]);
        } elseif ($year && $month) {
            $from = sprintf('%04d-%02d-01', (int)$year, (int)$month);
            $to   = date('Y-m-t', strtotime($from));
            $query->where(['Menus.menu_date >=' => $from, 'Menus.menu_date <=' => $to]);
        }

        $menus = $query->orderBy(['Menus.menu_date' => 'ASC', 'Menus.meal_type' => 'ASC'])->toArray();
        $this->set(compact('menus'));
        $this->viewBuilder()->setOption('serialize', ['menus']);
    }

    /** POST /api/menus.json - メニュー登録（date+meal_typeでupsert） */
    public function add(): void
    {
        $data  = $this->request->getData();
        $table = $this->fetchTable('Menus');

        $menuDate = $data['menu_date'] ?? null;
        $mealType = isset($data['meal_type']) ? (int)$data['meal_type'] : null;
        $blockId  = isset($data['block_id']) ? (int)$data['block_id'] : null;

        $existing = null;
        if ($menuDate && $mealType && $blockId) {
            $existing = $table->find()
                ->where(['menu_date' => $menuDate, 'meal_type' => $mealType, 'block_id' => $blockId])
                ->first();
        }

        $menu = $existing
            ? $table->patchEntity($existing, $data)
            : $table->newEntity($data);

        if ($table->save($menu)) {
            $this->response = $this->response->withStatus($existing ? 200 : 201);
            $this->set(['success' => true, 'menu' => $menu]);
        } else {
            $this->response = $this->response->withStatus(400);
            $this->set(['success' => false, 'errors' => $menu->getErrors()]);
        }
        $this->viewBuilder()->setOption('serialize', ['success', 'menu', 'errors']);
    }

    /** DELETE /api/menus/:id.json */
    public function delete(int $id): void
    {
        $table  = $this->fetchTable('Menus');
        $entity = $table->get($id);
        $table->delete($entity);

        $this->set(['success' => true]);
        $this->viewBuilder()->setOption('serialize', ['success']);
    }
}
