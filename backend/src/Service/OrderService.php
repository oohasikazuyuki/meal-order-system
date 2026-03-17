<?php
namespace App\Service;

use App\Repository\OrderRepository;

class OrderService
{
    private OrderRepository $orderRepository;

    public function __construct()
    {
        $this->orderRepository = new OrderRepository();
    }

    /**
     * 発注一覧を取得
     */
    public function getOrderList(): array
    {
        return $this->orderRepository->findAll([], [
            'contain' => ['Users', 'Menus'],
            'order' => ['Orders.order_date' => 'DESC']
        ]);
    }

    /**
     * 発注詳細を取得
     */
    public function getOrderById(int $id)
    {
        return $this->orderRepository->findById($id, [
            'contain' => ['Users', 'Menus']
        ]);
    }

    /**
     * 発注を作成
     */
    public function createOrder(array $data): array
    {
        $entity = $this->orderRepository->create($data);
        $entity = $this->orderRepository->patch($entity, $data);

        $success = $this->orderRepository->save($entity);

        return [
            'success' => $success,
            'entity' => $entity,
            'errors' => $success ? [] : $entity->getErrors()
        ];
    }

    /**
     * 発注を更新
     */
    public function updateOrder(int $id, array $data): array
    {
        $entity = $this->orderRepository->get($id);
        $entity = $this->orderRepository->patch($entity, $data);

        $success = $this->orderRepository->save($entity);

        return [
            'success' => $success,
            'entity' => $entity,
            'errors' => $success ? [] : $entity->getErrors()
        ];
    }

    /**
     * 発注を削除
     */
    public function deleteOrder(int $id): bool
    {
        $entity = $this->orderRepository->get($id);
        return $this->orderRepository->delete($entity);
    }

    /**
     * 日別発注集計を取得
     */
    public function getOrderSummaryByDate(string $date): array
    {
        return $this->orderRepository->findByDateAndStatus($date, 'cancelled');
    }
}
