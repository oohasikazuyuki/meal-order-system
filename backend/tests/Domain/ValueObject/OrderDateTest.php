<?php
declare(strict_types=1);

namespace App\Test\Domain\ValueObject;

use App\Domain\ValueObject\OrderDate;
use PHPUnit\Framework\TestCase;

class OrderDateTest extends TestCase
{
    // ── fromString ───────────────────────────────────────────────────────────

    public function testFromStringValidDate(): void
    {
        $date = OrderDate::fromString('2026-04-05');
        $this->assertSame('2026-04-05', $date->value());
    }

    public function testFromStringTrimsWhitespace(): void
    {
        $date = OrderDate::fromString('  2026-04-05  ');
        $this->assertSame('2026-04-05', $date->value());
    }

    public function testFromStringExtractsDateFromDatetimeString(): void
    {
        $date = OrderDate::fromString('2026-04-05 12:00:00');
        $this->assertSame('2026-04-05', $date->value());
    }

    public function testFromStringInvalidFormatThrows(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('YYYY-MM-DD');
        OrderDate::fromString('05/04/2026');
    }

    public function testFromStringEmptyThrows(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        OrderDate::fromString('');
    }

    // ── today ────────────────────────────────────────────────────────────────

    public function testTodayReturnsCurrentDate(): void
    {
        $today = OrderDate::today();
        $this->assertSame(date('Y-m-d'), $today->value());
        $this->assertTrue($today->isToday());
    }

    // ── isFuture / isPast / isToday ──────────────────────────────────────────

    public function testIsFutureForFutureDate(): void
    {
        $future = OrderDate::fromString(date('Y-m-d', strtotime('+1 day')));
        $this->assertTrue($future->isFuture());
        $this->assertFalse($future->isPast());
        $this->assertFalse($future->isToday());
    }

    public function testIsPastForPastDate(): void
    {
        $past = OrderDate::fromString('2020-01-01');
        $this->assertTrue($past->isPast());
        $this->assertFalse($past->isFuture());
        $this->assertFalse($past->isToday());
    }

    public function testIsTodayForCurrentDate(): void
    {
        $today = OrderDate::fromString(date('Y-m-d'));
        $this->assertTrue($today->isToday());
    }

    // ── equals ───────────────────────────────────────────────────────────────

    public function testEqualsReturnsTrueForSameDate(): void
    {
        $a = OrderDate::fromString('2026-04-05');
        $b = OrderDate::fromString('2026-04-05');
        $this->assertTrue($a->equals($b));
    }

    public function testEqualsReturnsFalseForDifferentDate(): void
    {
        $a = OrderDate::fromString('2026-04-05');
        $b = OrderDate::fromString('2026-04-06');
        $this->assertFalse($a->equals($b));
    }

    // ── __toString ───────────────────────────────────────────────────────────

    public function testToString(): void
    {
        $date = OrderDate::fromString('2026-04-05');
        $this->assertSame('2026-04-05', (string)$date);
    }
}
