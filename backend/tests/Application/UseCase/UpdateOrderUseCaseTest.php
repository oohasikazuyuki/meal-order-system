<?php
declare(strict_types=1);

namespace App\Test\Application\UseCase;

use App\Application\DTO\UpdateOrderDTO;
use App\Application\Exception\InputValidationException;
use App\Application\UseCase\UpdateOrderUseCase;
use App\Domain\Entity\Order;
use App\Domain\Exception\BusinessRuleViolationException;
use App\Domain\Exception\EntityNotFoundException;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\Service\OrderDomainService;
use App\Domain\ValueObject\OrderDate;
use App\Domain\ValueObject\OrderId;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class UpdateOrderUseCaseTest extends TestCase
{
    private OrderRepositoryInterface&MockObject $repo;
    private OrderDomainService&MockObject $domainService;
    private UpdateOrderUseCase $useCase;

    protected function setUp(): void
    {
        $this->repo          = $this->createMock(OrderRepositoryInterface::class);
        $this->domainService = $this->createMock(OrderDomainService::class);
        $this->useCase       = new UpdateOrderUseCase($this->repo, $this->domainService);
    }

    private function makeOrder(): Order
    {
        return Order::create(1, 10, 2, OrderDate::fromString(date('Y-m-d', strtotime('+1 day'))));
    }

    // ── 正常系 ────────────────────────────────────────────────────────────────

    public function testExecuteUpdatesQuantity(): void
    {
        $order = $this->makeOrder();
        $this->repo->method('findById')->willReturn($order);
        $this->domainService->method('canEditOrder')->willReturn(true);
        $this->repo->expects($this->once())->method('save');

        $dto = new UpdateOrderDTO(['quantity' => 5]);
        $result = $this->useCase->execute(1, $dto);

        $this->assertSame(5, $result->getQuantity());
    }

    public function testExecuteUpdatesStatusToConfirmed(): void
    {
        $order = $this->makeOrder();
        $this->repo->method('findById')->willReturn($order);
        $this->domainService->method('canEditOrder')->willReturn(true);

        $dto = new UpdateOrderDTO(['status' => 'confirmed']);
        $result = $this->useCase->execute(1, $dto);

        $this->assertTrue($result->getStatus()->isConfirmed());
    }

    public function testExecuteUpdatesStatusToCancelled(): void
    {
        $order = $this->makeOrder();
        $this->repo->method('findById')->willReturn($order);
        $this->domainService->method('canEditOrder')->willReturn(true);

        $dto = new UpdateOrderDTO(['status' => 'cancelled']);
        $result = $this->useCase->execute(1, $dto);

        $this->assertTrue($result->getStatus()->isCancelled());
    }

    public function testExecuteUpdatesStatusToCompleted(): void
    {
        $order = $this->makeOrder();
        $this->repo->method('findById')->willReturn($order);
        $this->domainService->method('canEditOrder')->willReturn(true);

        $dto = new UpdateOrderDTO(['status' => 'completed']);
        $result = $this->useCase->execute(1, $dto);

        $this->assertTrue($result->getStatus()->isCompleted());
    }

    public function testExecuteWithNoChangesStillSaves(): void
    {
        $order = $this->makeOrder();
        $this->repo->method('findById')->willReturn($order);
        $this->domainService->method('canEditOrder')->willReturn(true);
        $this->repo->expects($this->once())->method('save');

        $dto = new UpdateOrderDTO([]);
        $this->useCase->execute(1, $dto);
    }

    // ── バリデーションエラー ─────────────────────────────────────────────────

    public function testExecuteThrowsForZeroOrderId(): void
    {
        $this->expectException(InputValidationException::class);

        $this->useCase->execute(0, new UpdateOrderDTO(['quantity' => 1]));
    }

    public function testExecuteThrowsForNegativeOrderId(): void
    {
        $this->expectException(InputValidationException::class);

        $this->useCase->execute(-5, new UpdateOrderDTO(['quantity' => 1]));
    }

    public function testExecuteThrowsForInvalidQuantity(): void
    {
        $this->expectException(InputValidationException::class);

        $dto = new UpdateOrderDTO(['quantity' => 0]);
        $this->useCase->execute(1, $dto);
    }

    public function testExecuteThrowsForInvalidStatus(): void
    {
        $this->expectException(InputValidationException::class);

        $dto = new UpdateOrderDTO(['status' => 'unknown']);
        $this->useCase->execute(1, $dto);
    }

    // ── エンティティ未検出 ───────────────────────────────────────────────────

    public function testExecuteThrowsEntityNotFoundWhenOrderMissing(): void
    {
        $this->expectException(EntityNotFoundException::class);

        $this->repo->method('findById')->willReturn(null);
        $dto = new UpdateOrderDTO(['quantity' => 3]);
        $this->useCase->execute(999, $dto);
    }

    // ── ビジネスルール違反 ───────────────────────────────────────────────────

    public function testExecuteThrowsWhenOrderNotEditable(): void
    {
        $this->expectException(BusinessRuleViolationException::class);
        $this->expectExceptionMessage('この発注は編集できません');

        $order = $this->makeOrder();
        $this->repo->method('findById')->willReturn($order);
        $this->domainService->method('canEditOrder')->willReturn(false);

        $this->useCase->execute(1, new UpdateOrderDTO(['quantity' => 3]));
    }
}
