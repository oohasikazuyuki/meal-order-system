<?php
declare(strict_types=1);

namespace App\Application\UseCase;

use App\Domain\Entity\Order;
use App\Domain\Repository\OrderRepositoryInterface;

/**
 * 発注一覧取得ユースケース
 */
class GetOrderListUseCase
{
    private OrderRepositoryInterface $orderRepository;

    public function __construct(OrderRepositoryInterface $orderRepository)
    {
        $this->orderRepository = $orderRepository;
    }

    /**
     * @return Order[]
     */
    public function execute(): array
    {
        return $this->orderRepository->findAll();
    }
}
