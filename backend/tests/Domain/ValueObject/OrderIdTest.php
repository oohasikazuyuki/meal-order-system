<?php
declare(strict_types=1);

namespace App\Test\Domain\ValueObject;

use App\Domain\ValueObject\OrderId;
use PHPUnit\Framework\TestCase;

class OrderIdTest extends TestCase
{
    // ── fromInt ──────────────────────────────────────────────────────────────

    public function testFromIntValidPositiveValue(): void
    {
        $id = OrderId::fromInt(42);
        $this->assertSame(42, $id->value());
        $this->assertFalse($id->isNew());
    }

    public function testFromIntZeroThrows(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        OrderId::fromInt(0);
    }

    public function testFromIntNegativeThrows(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        OrderId::fromInt(-1);
    }

    // ── generate (新規) ──────────────────────────────────────────────────────

    public function testGenerateReturnsNewId(): void
    {
        $id = OrderId::generate();
        $this->assertNull($id->value());
        $this->assertTrue($id->isNew());
    }

    // ── equals ───────────────────────────────────────────────────────────────

    public function testEqualsTrueForSameValue(): void
    {
        $leftOrderId = OrderId::fromInt(1);
        $rightOrderId = OrderId::fromInt(1);
        $this->assertTrue($leftOrderId->equals($rightOrderId));
    }

    public function testEqualsFalseForDifferentValue(): void
    {
        $leftOrderId = OrderId::fromInt(1);
        $rightOrderId = OrderId::fromInt(2);
        $this->assertFalse($leftOrderId->equals($rightOrderId));
    }

    public function testEqualsNewIds(): void
    {
        $firstNewOrderId = OrderId::generate();
        $secondNewOrderId = OrderId::generate();
        // どちらも null なので等価
        $this->assertTrue($firstNewOrderId->equals($secondNewOrderId));
    }

    // ── __toString ───────────────────────────────────────────────────────────

    public function testToStringWithValue(): void
    {
        $id = OrderId::fromInt(5);
        $this->assertSame('5', (string)$id);
    }

    public function testToStringNew(): void
    {
        $id = OrderId::generate();
        $this->assertSame('(new)', (string)$id);
    }
}