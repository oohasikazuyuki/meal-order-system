<?php
declare(strict_types=1);

namespace App\Application\UseCase;

use App\Application\DTO\CreateOrderDTO;
use App\Application\Exception\InputValidationException;
use App\Domain\Entity\Order;
use App\Domain\Exception\BusinessRuleViolationException;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\Service\OrderDomainService;
use App\Domain\ValueObject\OrderDate;

/**
 * 発注作成ユースケース
 */
class CreateOrderUseCase
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
     * @throws BusinessRuleViolationException
     */
    public function execute(CreateOrderDTO $dto): Order
    {
        // DTOバリデーション
        $errors = $dto->validate();
        if (!empty($errors)) {
            throw new InputValidationException($errors);
        }

        $orderDate = OrderDate::fromString($dto->orderDate);

        // 重複チェック
        if ($this->orderDomainService->isDuplicateOrder($dto->userId, $dto->menuId, $orderDate)) {
            throw new BusinessRuleViolationException('同じメニューの発注が既に存在します');
        }

        // 発注エンティティの生成
        $order = Order::create(
            $dto->userId,
            $dto->menuId,
            $dto->quantity,
            $orderDate
        );

        // 永続化
        $this->orderRepository->save($order);

        return $order;
    }
}
