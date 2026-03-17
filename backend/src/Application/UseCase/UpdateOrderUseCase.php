<?php
declare(strict_types=1);

namespace App\Application\UseCase;

use App\Application\DTO\UpdateOrderDTO;
use App\Application\Exception\InputValidationException;
use App\Domain\Entity\Order;
use App\Domain\Exception\BusinessRuleViolationException;
use App\Domain\Exception\EntityNotFoundException;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\Service\OrderDomainService;
use App\Domain\ValueObject\OrderId;

/**
 * 発注更新ユースケース
 */
class UpdateOrderUseCase
{
    private OrderRepositoryInterface $orderRepository;
    private OrderDomainService $orderDomainService;

    public function __construct(
        OrderRepositoryInterface $orderRepository,
        OrderDomainService $orderDomainService
    ) {
        $this->orderRepository = $orderRepository;
        $this->orderDomainService = $orderDomainService;
    }

    /**
     * @throws InputValidationException
     * @throws EntityNotFoundException
     * @throws BusinessRuleViolationException
     */
    public function execute(int $orderId, UpdateOrderDTO $dto): Order
    {
        // IDのバリデーション
        if ($orderId <= 0) {
            throw new InputValidationException(['id' => '発注IDは正の整数である必要があります']);
        }

        // DTOバリデーション
        $errors = $dto->validate();
        if (!empty($errors)) {
            throw new InputValidationException($errors);
        }

        // 発注の取得
        $order = $this->orderRepository->findById(OrderId::fromInt($orderId));
        if (!$order) {
            throw new EntityNotFoundException('Order', $orderId);
        }

        // 編集可能かチェック
        if (!$this->orderDomainService->canEditOrder($order)) {
            throw new BusinessRuleViolationException('この発注は編集できません');
        }

        // 更新
        if ($dto->quantity !== null) {
            $order->updateQuantity($dto->quantity);
        }

        if ($dto->status !== null) {
            match ($dto->status) {
                'confirmed' => $order->confirm(),
                'completed' => $order->complete(),
                'cancelled' => $order->cancel(),
                default => null,
            };
        }

        // 永続化
        $this->orderRepository->save($order);

        return $order;
    }
}
