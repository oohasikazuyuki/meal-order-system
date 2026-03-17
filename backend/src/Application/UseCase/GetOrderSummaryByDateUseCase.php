<?php
declare(strict_types=1);

namespace App\Application\UseCase;

use App\Domain\Entity\Order;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\ValueObject\OrderDate;

/**
 * 日別発注サマリー取得ユースケース
 */
class GetOrderSummaryByDateUseCase
{
    private OrderRepositoryInterface $orderRepository;

    public function __construct(OrderRepositoryInterface $orderRepository)
    {
        $this->orderRepository = $orderRepository;
    }

    /**
     * @return Order[]
     * @throws \InvalidArgumentException
     */
    public function execute(string $date): array
    {
        try {
            $orderDate = OrderDate::fromString($date);
        } catch (\InvalidArgumentException $e) {
            throw new \InvalidArgumentException('日付はYYYY-MM-DD形式である必要があります', 400, $e);
        }
        
        return $this->orderRepository->findByDateExcludingStatus($orderDate, 'cancelled');
    }
}
