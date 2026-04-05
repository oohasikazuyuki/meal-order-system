<?php
declare(strict_types=1);

namespace App\Test\Application\UseCase;

use App\Application\UseCase\GetOrderListUseCase;
use App\Domain\Entity\Order;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\ValueObject\OrderDate;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class GetOrderListUseCaseTest extends TestCase
{
    private OrderRepositoryInterface&MockObject $repo;
    private GetOrderListUseCase $useCase;

    protected function setUp(): void
    {
        $this->repo    = $this->createMock(OrderRepositoryInterface::class);
        $this->useCase = new GetOrderListUseCase($this->repo);
    }

    public function testExecuteReturnsAllOrders(): void
    {
        $date = OrderDate::fromString('2026-04-05');
        $o1 = Order::create(1, 10, 1, $date);
        $o2 = Order::create(2, 20, 3, $date);

        $this->repo->method('findAll')->willReturn([$o1, $o2]);

        $result = $this->useCase->execute();

        $this->assertCount(2, $result);
        $this->assertSame($o1, $result[0]);
        $this->assertSame($o2, $result[1]);
    }

    public function testExecuteReturnsEmptyArrayWhenNoOrders(): void
    {
        $this->repo->method('findAll')->willReturn([]);

        $result = $this->useCase->execute();

        $this->assertSame([], $result);
    }

    public function testExecuteCallsFindAll(): void
    {
        $this->repo->expects($this->once())->method('findAll')->willReturn([]);

        $this->useCase->execute();
    }
}
