<?php
declare(strict_types=1);

namespace App\Domain\Service;

use App\Domain\Entity\Order;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\ValueObject\OrderDate;

/**
 * 発注ドメインサービス
 * 
 * 複数のエンティティにまたがるビジネスロジックを実装
 */
class OrderDomainService
{
    private OrderRepositoryInterface $orderRepository;

    public function __construct(OrderRepositoryInterface $orderRepository)
    {
        $this->orderRepository = $orderRepository;
    }

    /**
     * 指定日の発注が重複していないか確認
     */
    public function isDuplicateOrder(int $userId, int $menuId, OrderDate $orderDate): bool
    {
        $orders = $this->orderRepository->findByUserId($userId);
        
        foreach ($orders as $order) {
            if ($order->getMenuId() === $menuId && 
                $order->getOrderDate()->equals($orderDate) &&
                !$order->getStatus()->isCancelled()) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * 指定日の総発注数を計算
     */
    public function calculateTotalQuantityByDate(OrderDate $orderDate): int
    {
        $orders = $this->orderRepository->findByDateExcludingStatus($orderDate, 'cancelled');
        
        return array_reduce($orders, function ($total, Order $order) {
            return $total + $order->getQuantity();
        }, 0);
    }

    /**
     * 発注が編集可能か検証
     */
    public function canEditOrder(Order $order): bool
    {
        // 発注日が過去の場合は編集不可
        if ($order->getOrderDate()->isPast()) {
            return false;
        }

        // ステータスが完了またはキャンセル済みの場合は編集不可
        return $order->isEditable();
    }

    /**
     * 発注がキャンセル可能か検証
     */
    public function canCancelOrder(Order $order): bool
    {
        // 発注日の前日までキャンセル可能
        $yesterday = date('Y-m-d', strtotime('-1 day', strtotime($order->getOrderDate()->value())));
        if (date('Y-m-d') > $yesterday) {
            return false;
        }

        return $order->isCancellable();
    }
}
