<?php
declare(strict_types=1);

namespace App\Domain\Entity;

use App\Domain\ValueObject\OrderDate;
use App\Domain\ValueObject\OrderId;
use App\Domain\ValueObject\OrderStatus;

/**
 * 発注エンティティ（ドメインエンティティ）
 */
class Order
{
    private OrderId $id;
    private int $userId;
    private int $menuId;
    private int $quantity;
    private OrderDate $orderDate;
    private OrderStatus $status;
    private ?\DateTimeImmutable $createdAt;
    private ?\DateTimeImmutable $updatedAt;

    public function __construct(
        OrderId $id,
        int $userId,
        int $menuId,
        int $quantity,
        OrderDate $orderDate,
        OrderStatus $status,
        ?\DateTimeImmutable $createdAt = null,
        ?\DateTimeImmutable $updatedAt = null
    ) {
        $this->id = $id;
        $this->userId = $userId;
        $this->menuId = $menuId;
        $this->quantity = $quantity;
        $this->orderDate = $orderDate;
        $this->status = $status;
        $this->createdAt = $createdAt ?? new \DateTimeImmutable();
        $this->updatedAt = $updatedAt;
    }

    public static function create(
        int $userId,
        int $menuId,
        int $quantity,
        OrderDate $orderDate
    ): self {
        return new self(
            OrderId::generate(),
            $userId,
            $menuId,
            $quantity,
            $orderDate,
            OrderStatus::pending()
        );
    }

    public function updateQuantity(int $quantity): void
    {
        if ($quantity <= 0) {
            throw new \InvalidArgumentException('数量は1以上である必要があります');
        }
        $this->quantity = $quantity;
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function confirm(): void
    {
        $this->status = OrderStatus::confirmed();
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function cancel(): void
    {
        $this->status = OrderStatus::cancelled();
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function complete(): void
    {
        $this->status = OrderStatus::completed();
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function isEditable(): bool
    {
        return $this->status->isPending() || $this->status->isConfirmed();
    }

    public function isCancellable(): bool
    {
        return !$this->status->isCompleted() && !$this->status->isCancelled();
    }

    // Getters
    public function getId(): OrderId
    {
        return $this->id;
    }

    public function getUserId(): int
    {
        return $this->userId;
    }

    public function getMenuId(): int
    {
        return $this->menuId;
    }

    public function getQuantity(): int
    {
        return $this->quantity;
    }

    public function getOrderDate(): OrderDate
    {
        return $this->orderDate;
    }

    public function getStatus(): OrderStatus
    {
        return $this->status;
    }

    public function getCreatedAt(): ?\DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): ?\DateTimeImmutable
    {
        return $this->updatedAt;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id->value(),
            'user_id' => $this->userId,
            'menu_id' => $this->menuId,
            'quantity' => $this->quantity,
            'order_date' => $this->orderDate->value(),
            'status' => $this->status->value(),
            'created_at' => $this->createdAt?->format('Y-m-d H:i:s'),
            'updated_at' => $this->updatedAt?->format('Y-m-d H:i:s'),
        ];
    }
}
