<?php
namespace App\Controller\Api;

use App\Controller\AppController;
use App\Service\MenuService;

class MenusController extends AppController
{
    private MenuService $menuService;

    public function initialize(): void
    {
        parent::initialize();
        $this->menuService = new MenuService();
    }

    /**
     * GET /api/menus.json
     *   ?date=YYYY-MM-DD       → 特定日
     *   ?year=YYYY&month=MM    → 月全体（カレンダー用）
     */
    public function index(): void
    {
        $date = $this->request->getQuery('date');
        $year = $this->request->getQuery('year');
        $month = $this->request->getQuery('month');

        $menus = $this->menuService->getMenus($date, $year ? (int)$year : null, $month ? (int)$month : null);
        $this->set(compact('menus'));
        $this->viewBuilder()->setOption('serialize', ['menus']);
    }

    /** POST /api/menus.json - メニュー登録（date+meal_typeでupsert） */
    public function add(): void
    {
        $result = $this->menuService->saveMenu($this->request->getData());

        $this->response = $this->response->withStatus($result['status']);
        $this->set([
            'success' => $result['success'],
            'menu' => $result['menu'],
            'errors' => $result['errors']
        ]);
        $this->viewBuilder()->setOption('serialize', ['success', 'menu', 'errors']);
    }

    /** DELETE /api/menus/:id.json */
    public function delete(int $id): void
    {
        $this->menuService->deleteMenu($id);
        $this->set(['success' => true]);
        $this->viewBuilder()->setOption('serialize', ['success']);
    }

    /** POST /api/menus/copy-routine.json */
    public function copyRoutine(): void
    {
        $data = $this->request->getData();
        $sourceStart = (string)($data['source_start'] ?? '');
        $targetStart = (string)($data['target_start'] ?? '');
        $months = (int)($data['months'] ?? 2);
        $includeBirthdayMenu = (bool)($data['include_birthday_menu'] ?? true);
        $replaceExisting = (bool)($data['replace_existing'] ?? true);
        $blockId = isset($data['block_id']) && $data['block_id'] !== '' ? (int)$data['block_id'] : null;

        $result = $this->menuService->copyRoutine(
            $sourceStart,
            $targetStart,
            $months,
            $includeBirthdayMenu,
            $replaceExisting,
            $blockId
        );

        $this->response = $this->response->withStatus($result['status'] ?? 200);
        $this->set($result);
        $this->viewBuilder()->setOption('serialize', array_keys($result));
    }
}
