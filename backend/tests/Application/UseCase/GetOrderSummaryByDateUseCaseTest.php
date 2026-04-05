<?php
declare(strict_types=1);

namespace App\Test\Application\UseCase;

use App\Application\UseCase\GetOrderSummaryByDateUseCase;
use App\Domain\Entity\Order;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\ValueObject\OrderDate;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class GetOrderSummaryByDateUseCaseTest extends TestCase
{
    private OrderRepositoryInterface&MockObject $repo;
    private GetOrderSummaryByDateUseCase $useCase;

    protected function setUp(): void
    {
        $this->repo    = $this->createMock(OrderRepositoryInterface::class);
        $this->useCase = new GetOrderSummaryByDateUseCase($this->repo);
    }

    // ── 正常系 ────────────────────────────────────────────────────────────────

    public function testExecuteReturnsOrdersForDate(): void
    {
        $date = OrderDate::fromString('2026-06-01');
        $o1 = Order::create(1, 10, 2, $date);
        $o2 = Order::create(2, 20, 3, $date);

        $this->repo->method('findByDateExcludingStatus')->willReturn([$o1, $o2]);

        $result = $this->useCase->execute('2026-06-01');

        $this->assertCount(2, $result);
    }

    public function testExecuteReturnsEmptyForDateWithNoOrders(): void
    {
        $this->repo->method('findByDateExcludingStatus')->willReturn([]);

        $result = $this->useCase->execute('2026-06-01');

        $this->assertSame([], $result);
    }

    public function testExecuteCallsRepoWithCancelledExclusion(): void
    {
        $this->repo->expects($this->once())
            ->method('findByDateExcludingStatus')
            ->with($this->isInstanceOf(OrderDate::class), 'cancelled')
            ->willReturn([]);

        $this->useCase->execute('2026-06-01');
    }

    // ── 異常系 ────────────────────────────────────────────────────────────────

    public function testExecuteThrowsForInvalidDateFormat(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('YYYY-MM-DD');

        $this->useCase->execute('01/06/2026');
    }

    public function testExecuteThrowsForEmptyDate(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        $this->useCase->execute('');
    }
}
