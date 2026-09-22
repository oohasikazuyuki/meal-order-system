<?php
declare(strict_types=1);

namespace App\Test\Application\UseCase;

use App\Application\DTO\CreateOrderDTO;
use App\Application\Exception\InputValidationException;
use App\Application\UseCase\CreateOrderUseCase;
use App\Domain\Entity\Order;
use App\Domain\Exception\BusinessRuleViolationException;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\Service\OrderDomainService;
use App\Domain\ValueObject\OrderDate;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class CreateOrderUseCaseTest extends TestCase
{
    private OrderRepositoryInterface&MockObject $repo;
    private OrderDomainService&MockObject $domainService;
    private CreateOrderUseCase $useCase;

    protected function setUp(): void
    {
        $this->repo          = $this->createMock(OrderRepositoryInterface::class);
        $this->domainService = $this->createMock(OrderDomainService::class);
        $this->useCase       = new CreateOrderUseCase($this->repo, $this->domainService);
    }

    private function validDto(): CreateOrderDTO
    {
        return new CreateOrderDTO([
            'user_id'    => 1,
            'menu_id'    => 10,
            'quantity'   => 2,
            'order_date' => '2026-04-05',
        ]);
    }

    // ── 正常系 ────────────────────────────────────────────────────────────────

    public function testExecuteReturnsOrderOnSuccess(): void
    {
        $this->domainService->method('isDuplicateOrder')->willReturn(false);
        $this->repo->expects($this->once())->method('save');

        $order = $this->useCase->execute($this->validDto());

        $this->assertInstanceOf(Order::class, $order);
        $this->assertSame(1, $order->getUserId());
        $this->assertSame(10, $order->getMenuId());
        $this->assertSame(2, $order->getQuantity());
        $this->assertTrue($order->getStatus()->isPending());
    }

    public function testExecuteSavesOrderToRepository(): void
    {
        $this->domainService->method('isDuplicateOrder')->willReturn(false);
        $this->repo->expects($this->once())
            ->method('save')
            ->with($this->isInstanceOf(Order::class));

        $this->useCase->execute($this->validDto());
    }

    // ── バリデーションエラー ─────────────────────────────────────────────────

    public function testExecuteThrowsInputValidationExceptionForInvalidDto(): void
    {
        $this->expectException(InputValidationException::class);

        $dto = new CreateOrderDTO(['user_id' => 0, 'menu_id' => 0, 'quantity' => 0, 'order_date' => 'bad']);
        $this->useCase->execute($dto);
    }

    public function testExecuteValidationErrorContainsFields(): void
    {
        try {
            $dto = new CreateOrderDTO(['user_id' => 0, 'menu_id' => 0, 'quantity' => 1, 'order_date' => '2026-04-05']);
            $this->useCase->execute($dto);
            $this->fail('例外が発生しませんでした');
        } catch (InputValidationException $e) {
            $this->assertArrayHasKey('user_id', $e->getErrors());
            $this->assertArrayHasKey('menu_id', $e->getErrors());
        }
    }

    public function testExecuteDoesNotCallRepoWhenValidationFails(): void
    {
        $this->repo->expects($this->never())->method('save');

        try {
            $this->useCase->execute(new CreateOrderDTO([]));
        } catch (InputValidationException) {
        }
    }

    // ── 重複チェック ─────────────────────────────────────────────────────────

    public function testExecuteThrowsBusinessRuleViolationForDuplicateOrder(): void
    {
        $this->expectException(BusinessRuleViolationException::class);
        $this->expectExceptionMessage('同じメニューの発注が既に存在します');

        $this->domainService->method('isDuplicateOrder')->willReturn(true);
        $this->useCase->execute($this->validDto());
    }

    public function testExecuteDoesNotSaveWhenDuplicate(): void
    {
        $this->domainService->method('isDuplicateOrder')->willReturn(true);
        $this->repo->expects($this->never())->method('save');

        try {
            $this->useCase->execute($this->validDto());
        } catch (BusinessRuleViolationException) {
        }
    }

    public function testExecuteCallsDomainServiceWithCorrectArguments(): void
    {
        $this->domainService->expects($this->once())
            ->method('isDuplicateOrder')
            ->with(1, 10, $this->isInstanceOf(OrderDate::class))
            ->willReturn(false);

        $this->repo->method('save');
        $this->useCase->execute($this->validDto());
    }
}
