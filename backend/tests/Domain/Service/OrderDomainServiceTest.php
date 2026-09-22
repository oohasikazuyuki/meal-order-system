<?php
declare(strict_types=1);

namespace App\Test\Domain\Service;

use App\Domain\Entity\Order;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\Service\OrderDomainService;
use App\Domain\ValueObject\OrderDate;
use App\Domain\ValueObject\OrderId;
use App\Domain\ValueObject\OrderStatus;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class OrderDomainServiceTest extends TestCase
{
    private OrderRepositoryInterface&MockObject $repo;
    private OrderDomainService $service;

    protected function setUp(): void
    {
        $this->repo    = $this->createMock(OrderRepositoryInterface::class);
        $this->service = new OrderDomainService($this->repo);
    }

    // ── ヘルパー ──────────────────────────────────────────────────────────────

    private function makeOrder(
        int $userId,
        int $menuId,
        string $date,
        string $status = 'pending'
    ): Order {
        $order = Order::create($userId, $menuId, 1, OrderDate::fromString($date));
        if ($status === 'cancelled') $order->cancel();
        if ($status === 'confirmed') $order->confirm();
        if ($status === 'completed') $order->complete();
        return $order;
    }

    // ── isDuplicateOrder ─────────────────────────────────────────────────────

    public function testIsDuplicateOrderReturnsTrueForExistingActiveOrder(): void
    {
        $date = '2026-06-01';
        $existing = $this->makeOrder(1, 10, $date, 'pending');

        $this->repo->expects($this->once())
            ->method('findByUserId')
            ->with(1)
            ->willReturn([$existing]);

        $isDup = $this->service->isDuplicateOrder(1, 10, OrderDate::fromString($date));
        $this->assertTrue($isDup);
    }

    public function testIsDuplicateOrderReturnsFalseForCancelledOrder(): void
    {
        $date = '2026-06-01';
        $existing = $this->makeOrder(1, 10, $date, 'cancelled');

        $this->repo->method('findByUserId')->willReturn([$existing]);

        $isDup = $this->service->isDuplicateOrder(1, 10, OrderDate::fromString($date));
        $this->assertFalse($isDup);
    }

    public function testIsDuplicateOrderReturnsFalseForDifferentMenu(): void
    {
        $date = '2026-06-01';
        $existing = $this->makeOrder(1, 10, $date, 'pending');

        $this->repo->method('findByUserId')->willReturn([$existing]);

        $isDup = $this->service->isDuplicateOrder(1, 99, OrderDate::fromString($date));
        $this->assertFalse($isDup);
    }

    public function testIsDuplicateOrderReturnsFalseForDifferentDate(): void
    {
        $existing = $this->makeOrder(1, 10, '2026-06-01', 'pending');

        $this->repo->method('findByUserId')->willReturn([$existing]);

        $isDup = $this->service->isDuplicateOrder(1, 10, OrderDate::fromString('2026-06-02'));
        $this->assertFalse($isDup);
    }

    public function testIsDuplicateOrderReturnsFalseWhenNoOrders(): void
    {
        $this->repo->method('findByUserId')->willReturn([]);

        $isDup = $this->service->isDuplicateOrder(1, 10, OrderDate::fromString('2026-06-01'));
        $this->assertFalse($isDup);
    }

    // ── calculateTotalQuantityByDate ─────────────────────────────────────────

    public function testCalculateTotalQuantityByDateSumsQuantities(): void
    {
        $date = OrderDate::fromString('2026-06-01');
        $firstOrder = Order::create(1, 1, 3, $date);
        $secondOrder = Order::create(2, 2, 5, $date);

        $this->repo->method('findByDateExcludingStatus')->willReturn([$firstOrder, $secondOrder]);

        $total = $this->service->calculateTotalQuantityByDate($date);
        $this->assertSame(8, $total);
    }

    public function testCalculateTotalQuantityByDateReturnsZeroForEmptyList(): void
    {
        $this->repo->method('findByDateExcludingStatus')->willReturn([]);

        $total = $this->service->calculateTotalQuantityByDate(OrderDate::fromString('2026-06-01'));
        $this->assertSame(0, $total);
    }

    // ── canEditOrder ─────────────────────────────────────────────────────────

    public function testCanEditOrderReturnsTrueForFuturePendingOrder(): void
    {
        $order = $this->makeOrder(1, 1, date('Y-m-d', strtotime('+1 day')), 'pending');
        $this->assertTrue($this->service->canEditOrder($order));
    }

    public function testCanEditOrderReturnsFalseForPastOrder(): void
    {
        $order = $this->makeOrder(1, 1, '2020-01-01', 'pending');
        $this->assertFalse($this->service->canEditOrder($order));
    }

    public function testCanEditOrderReturnsFalseForCompletedOrder(): void
    {
        $order = $this->makeOrder(1, 1, date('Y-m-d', strtotime('+1 day')), 'completed');
        $this->assertFalse($this->service->canEditOrder($order));
    }

    // ── canCancelOrder ───────────────────────────────────────────────────────

    public function testCanCancelOrderReturnsTrueForFuturePendingOrder(): void
    {
        $order = $this->makeOrder(1, 1, date('Y-m-d', strtotime('+2 days')), 'pending');
        $this->assertTrue($this->service->canCancelOrder($order));
    }

    public function testCanCancelOrderReturnsFalseForAlreadyCancelledOrder(): void
    {
        $order = $this->makeOrder(1, 1, date('Y-m-d', strtotime('+2 days')), 'cancelled');
        $this->assertFalse($this->service->canCancelOrder($order));
    }
}