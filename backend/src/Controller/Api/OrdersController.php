<?php
namespace App\Controller\Api;

use App\Controller\AppController;
use Cake\Http\Exception\NotFoundException;

class OrdersController extends AppController
{

    /** GET /api/orders - 発注一覧 */
    public function index(): void
    {
        $orders = $this->Orders->find('all')
            ->contain(['Users', 'Menus'])
            ->orderBy(['Orders.order_date' => 'DESC'])
            ->toList();

        $this->set(compact('orders'));
        $this->viewBuilder()->setOption('serialize', ['orders']);
    }

    /** GET /api/orders/:id - 発注詳細 */
    public function view(int $id): void
    {
        $order = $this->Orders->get($id, contain: ['Users', 'Menus']);
        $this->set(compact('order'));
        $this->viewBuilder()->setOption('serialize', ['order']);
    }

    /** POST /api/orders - 発注登録 */
    public function add(): void
    {
        $order = $this->Orders->newEmptyEntity();
        $order = $this->Orders->patchEntity($order, $this->request->getData());

        if ($this->Orders->save($order)) {
            $this->response = $this->response->withStatus(201);
            $this->set(['success' => true, 'order' => $order]);
        } else {
            $this->response = $this->response->withStatus(400);
            $this->set(['success' => false, 'errors' => $order->getErrors()]);
        }
        $this->viewBuilder()->setOption('serialize', ['success', 'order', 'errors']);
    }

    /** PUT /api/orders/:id - 発注更新 */
    public function edit(int $id): void
    {
        $order = $this->Orders->get($id);
        $order = $this->Orders->patchEntity($order, $this->request->getData());

        if ($this->Orders->save($order)) {
            $this->set(['success' => true, 'order' => $order]);
        } else {
            $this->response = $this->response->withStatus(400);
            $this->set(['success' => false, 'errors' => $order->getErrors()]);
        }
        $this->viewBuilder()->setOption('serialize', ['success', 'order', 'errors']);
    }

    /** DELETE /api/orders/:id - 発注削除 */
    public function delete(int $id): void
    {
        $order = $this->Orders->get($id);
        $this->Orders->delete($order);
        $this->set(['success' => true]);
        $this->viewBuilder()->setOption('serialize', ['success']);
    }

    /** GET /api/orders/summary - 日別集計 */
    public function summary(): void
    {
        $date = $this->request->getQuery('date', date('Y-m-d'));
        $orders = $this->Orders->find('all')
            ->contain(['Menus'])
            ->where(['Orders.order_date' => $date, 'Orders.status !=' => 'cancelled'])
            ->toList();

        $this->set(compact('orders'));
        $this->viewBuilder()->setOption('serialize', ['orders']);
    }
}
