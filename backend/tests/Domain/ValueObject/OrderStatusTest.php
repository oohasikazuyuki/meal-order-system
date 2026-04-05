<?php
declare(strict_types=1);

namespace App\Test\Domain\ValueObject;

use App\Domain\ValueObject\OrderStatus;
use PHPUnit\Framework\TestCase;

class OrderStatusTest extends TestCase
{
    // ── ファクトリメソッド ────────────────────────────────────────────────────

    public function testPendingFactory(): void
    {
        $status = OrderStatus::pending();
        $this->assertSame('pending', $status->value());
        $this->assertTrue($status->isPending());
        $this->assertFalse($status->isConfirmed());
        $this->assertFalse($status->isCompleted());
        $this->assertFalse($status->isCancelled());
    }

    public function testConfirmedFactory(): void
    {
        $status = OrderStatus::confirmed();
        $this->assertSame('confirmed', $status->value());
        $this->assertFalse($status->isPending());
        $this->assertTrue($status->isConfirmed());
    }

    public function testCompletedFactory(): void
    {
        $status = OrderStatus::completed();
        $this->assertSame('completed', $status->value());
        $this->assertTrue($status->isCompleted());
    }

    public function testCancelledFactory(): void
    {
        $status = OrderStatus::cancelled();
        $this->assertSame('cancelled', $status->value());
        $this->assertTrue($status->isCancelled());
    }

    // ── fromString ───────────────────────────────────────────────────────────

    public function testFromStringValidValues(): void
    {
        foreach (['pending', 'confirmed', 'completed', 'cancelled'] as $val) {
            $s = OrderStatus::fromString($val);
            $this->assertSame($val, $s->value());
        }
    }

    public function testFromStringInvalidThrows(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('無効なステータス');
        OrderStatus::fromString('invalid');
    }

    public function testFromStringEmptyThrows(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        OrderStatus::fromString('');
    }

    // ── equals ───────────────────────────────────────────────────────────────

    public function testEqualsReturnsTrueForSameStatus(): void
    {
        $a = OrderStatus::pending();
        $b = OrderStatus::pending();
        $this->assertTrue($a->equals($b));
    }

    public function testEqualsReturnsFalseForDifferentStatus(): void
    {
        $a = OrderStatus::pending();
        $b = OrderStatus::confirmed();
        $this->assertFalse($a->equals($b));
    }

    // ── __toString ───────────────────────────────────────────────────────────

    public function testToString(): void
    {
        $this->assertSame('pending', (string)OrderStatus::pending());
        $this->assertSame('confirmed', (string)OrderStatus::confirmed());
    }
}
