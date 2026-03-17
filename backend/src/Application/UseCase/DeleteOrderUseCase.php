<?php
declare(strict_types=1);

namespace App\Application\UseCase;

use App\Domain\Exception\EntityNotFoundException;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\ValueObject\OrderId;

/**
 * 発注削除ユースケース
 */
class DeleteOrderUseCase
{
    private OrderRepositoryInterface $orderRepository;

    public function __construct(OrderRepositoryInterface $orderRepository)
    {
        $this->orderRepository = $orderRepository;
    }

    /**
     * @throws EntityNotFoundException
     */
    public function execute(int $orderId): void
    {
        // IDのバリデーション
        if ($orderId <= 0) {
            throw new EntityNotFoundException('Order', $orderId);
        }

        $order = $this->orderRepository->findById(OrderId::fromInt($orderId));
        
        if (!$order) {
            throw new EntityNotFoundException('Order', $orderId);
        }

        $this->orderRepository->delete($order);
    }
}
