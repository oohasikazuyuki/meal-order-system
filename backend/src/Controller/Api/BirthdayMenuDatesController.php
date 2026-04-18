<?php
namespace App\Controller\Api;

use App\Controller\AppController;
use App\Service\BirthdayMenuDateService;

class BirthdayMenuDatesController extends AppController
{
    private BirthdayMenuDateService $service;

    public function initialize(): void
    {
        parent::initialize();
        $this->service = new BirthdayMenuDateService();
    }

    /**
     * GET /api/birthday-menu-dates.json
     *   ?year=YYYY&month=MM          → 月全体
     *   ?block_id=N                  → ブロック絞り込み（省略時は全ブロック）
     */
    public function index(): void
    {
        $year    = $this->request->getQuery('year')  ? (int)$this->request->getQuery('year')  : (int)date('Y');
        $month   = $this->request->getQuery('month') ? (int)$this->request->getQuery('month') : (int)date('m');
        $blockId = $this->request->getQuery('block_id') !== null && $this->request->getQuery('block_id') !== ''
            ? (int)$this->request->getQuery('block_id')
            : null;

        $birthday_menu_dates = $this->service->getByMonth($year, $month, $blockId);
        $this->set(compact('birthday_menu_dates'));
        $this->viewBuilder()->setOption('serialize', ['birthday_menu_dates']);
    }

    /** POST /api/birthday-menu-dates.json */
    public function add(): void
    {
        $result = $this->service->save($this->request->getData());

        $this->response = $this->response->withStatus($result['status']);
        $this->set([
            'success'            => $result['success'],
            'birthday_menu_date' => $result['birthday_menu_date'],
            'errors'             => $result['errors'],
        ]);
        $this->viewBuilder()->setOption('serialize', ['success', 'birthday_menu_date', 'errors']);
    }

    /** PUT /api/birthday-menu-dates/:id.json */
    public function edit(int $id): void
    {
        $result = $this->service->update($id, $this->request->getData());

        $this->response = $this->response->withStatus($result['status']);
        $this->set([
            'success'            => $result['success'],
            'birthday_menu_date' => $result['birthday_menu_date'],
            'errors'             => $result['errors'],
        ]);
        $this->viewBuilder()->setOption('serialize', ['success', 'birthday_menu_date', 'errors']);
    }

    /** DELETE /api/birthday-menu-dates/:id.json */
    public function delete(int $id): void
    {
        $this->service->delete($id);
        $this->set(['success' => true]);
        $this->viewBuilder()->setOption('serialize', ['success']);
    }
}
