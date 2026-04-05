<?php
declare(strict_types=1);

namespace App\Test\Domain\Entity;

use App\Domain\Entity\Order;
use App\Domain\ValueObject\OrderDate;
use App\Domain\ValueObject\OrderId;
use App\Domain\ValueObject\OrderStatus;
use PHPUnit\Framework\TestCase;

class OrderTest extends TestCase
{
    private function makeOrder(
        int $userId = 1,
        int $menuId = 10,
        int $quantity = 3,
        string $date = '2026-04-05'
    ): Order {
        return Order::create($userId, $menuId, $quantity, OrderDate::fromString($date));
    }

    // ── create ───────────────────────────────────────────────────────────────

    public function testCreateSetsDefaultPendingStatus(): void
    {
        $order = $this->makeOrder();
        $this->assertTrue($order->getStatus()->isPending());
    }

    public function testCreateSetsNewId(): void
    {
        $order = $this->makeOrder();
        $this->assertTrue($order->getId()->isNew());
    }

    public function testCreateStoresUserIdMenuIdQuantity(): void
    {
        $order = $this->makeOrder(userId: 7, menuId: 99, quantity: 5);
        $this->assertSame(7, $order->getUserId());
        $this->assertSame(99, $order->getMenuId());
        $this->assertSame(5, $order->getQuantity());
    }

    public function testCreateSetsCreatedAt(): void
    {
        $order = $this->makeOrder();
        $this->assertNotNull($order->getCreatedAt());
        $this->assertInstanceOf(\DateTimeImmutable::class, $order->getCreatedAt());
    }

    // ── updateQuantity ───────────────────────────────────────────────────────

    public function testUpdateQuantityChangesValue(): void
    {
        $order = $this->makeOrder(quantity: 1);
        $order->updateQuantity(10);
        $this->assertSame(10, $order->getQuantity());
    }

    public function testUpdateQuantitySetsUpdatedAt(): void
    {
        $order = $this->makeOrder();
        $order->updateQuantity(2);
        $this->assertNotNull($order->getUpdatedAt());
    }

    public function testUpdateQuantityZeroThrows(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('1以上');
        $this->makeOrder()->updateQuantity(0);
    }

    public function testUpdateQuantityNegativeThrows(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->makeOrder()->updateQuantity(-5);
    }

    // ── ステータス遷移 ────────────────────────────────────────────────────────

    public function testConfirmChangesStatusToConfirmed(): void
    {
        $order = $this->makeOrder();
        $order->confirm();
        $this->assertTrue($order->getStatus()->isConfirmed());
    }

    public function testCancelChangesStatusToCancelled(): void
    {
        $order = $this->makeOrder();
        $order->cancel();
        $this->assertTrue($order->getStatus()->isCancelled());
    }

    public function testCompleteChangesStatusToCompleted(): void
    {
        $order = $this->makeOrder();
        $order->complete();
        $this->assertTrue($order->getStatus()->isCompleted());
    }

    // ── isEditable ───────────────────────────────────────────────────────────

    public function testIsEditableWhenPending(): void
    {
        $order = $this->makeOrder();
        $this->assertTrue($order->isEditable());
    }

    public function testIsEditableWhenConfirmed(): void
    {
        $order = $this->makeOrder();
        $order->confirm();
        $this->assertTrue($order->isEditable());
    }

    public function testIsNotEditableWhenCompleted(): void
    {
        $order = $this->makeOrder();
        $order->complete();
        $this->assertFalse($order->isEditable());
    }

    public function testIsNotEditableWhenCancelled(): void
    {
        $order = $this->makeOrder();
        $order->cancel();
        $this->assertFalse($order->isEditable());
    }

    // ── isCancellable ────────────────────────────────────────────────────────

    public function testIsCancellableWhenPending(): void
    {
        $order = $this->makeOrder();
        $this->assertTrue($order->isCancellable());
    }

    public function testIsNotCancellableWhenCompleted(): void
    {
        $order = $this->makeOrder();
        $order->complete();
        $this->assertFalse($order->isCancellable());
    }

    public function testIsNotCancellableWhenAlreadyCancelled(): void
    {
        $order = $this->makeOrder();
        $order->cancel();
        $this->assertFalse($order->isCancellable());
    }

    // ── toArray ──────────────────────────────────────────────────────────────

    public function testToArrayContainsRequiredKeys(): void
    {
        $order = $this->makeOrder(userId: 3, menuId: 7, quantity: 2, date: '2026-04-05');
        $arr = $order->toArray();

        $this->assertArrayHasKey('user_id', $arr);
        $this->assertArrayHasKey('menu_id', $arr);
        $this->assertArrayHasKey('quantity', $arr);
        $this->assertArrayHasKey('order_date', $arr);
        $this->assertArrayHasKey('status', $arr);
        $this->assertSame(3, $arr['user_id']);
        $this->assertSame(7, $arr['menu_id']);
        $this->assertSame(2, $arr['quantity']);
        $this->assertSame('2026-04-05', $arr['order_date']);
        $this->assertSame('pending', $arr['status']);
    }
}
