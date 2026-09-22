<?php
declare(strict_types=1);

namespace App\Test\Application\UseCase;

use App\Application\UseCase\DeleteOrderUseCase;
use App\Domain\Entity\Order;
use App\Domain\Exception\EntityNotFoundException;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\ValueObject\OrderDate;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class DeleteOrderUseCaseTest extends TestCase
{
    private OrderRepositoryInterface&MockObject $repo;
    private DeleteOrderUseCase $useCase;

    protected function setUp(): void
    {
        $this->repo    = $this->createMock(OrderRepositoryInterface::class);
        $this->useCase = new DeleteOrderUseCase($this->repo);
    }

    private function makeOrder(): Order
    {
        return Order::create(1, 10, 1, OrderDate::fromString('2026-04-05'));
    }

    // ── 正常系 ────────────────────────────────────────────────────────────────

    public function testExecuteDeletesOrder(): void
    {
        $order = $this->makeOrder();
        $this->repo->method('findById')->willReturn($order);
        $this->repo->expects($this->once())
            ->method('delete')
            ->with($order);

        $this->useCase->execute(1);
    }

    // ── 異常系 ────────────────────────────────────────────────────────────────

    public function testExecuteThrowsForZeroId(): void
    {
        $this->expectException(EntityNotFoundException::class);

        $this->useCase->execute(0);
    }

    public function testExecuteThrowsForNegativeId(): void
    {
        $this->expectException(EntityNotFoundException::class);

        $this->useCase->execute(-1);
    }

    public function testExecuteThrowsWhenOrderNotFound(): void
    {
        $this->expectException(EntityNotFoundException::class);

        $this->repo->method('findById')->willReturn(null);
        $this->useCase->execute(999);
    }

    public function testExecuteDoesNotDeleteWhenNotFound(): void
    {
        $this->repo->method('findById')->willReturn(null);
        $this->repo->expects($this->never())->method('delete');

        try {
            $this->useCase->execute(999);
        } catch (EntityNotFoundException) {
        }
    }
}
