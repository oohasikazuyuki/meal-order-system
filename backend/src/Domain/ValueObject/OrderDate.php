<?php
declare(strict_types=1);

namespace App\Domain\ValueObject;

/**
 * 発注日値オブジェクト
 */
final class OrderDate
{
    private string $value;

    private function __construct(string $value)
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            throw new \InvalidArgumentException('発注日はYYYY-MM-DD形式である必要があります');
        }
        $this->value = $value;
    }

    public static function fromString(string $value): self
    {
        $normalized = trim($value);
        if (preg_match('/^\d{4}-\d{2}-\d{2}/', $normalized, $m)) {
            $normalized = $m[0];
        }
        return new self($normalized);
    }

    public static function today(): self
    {
        return new self(date('Y-m-d'));
    }

    public function value(): string
    {
        return $this->value;
    }

    public function isFuture(): bool
    {
        return $this->value > date('Y-m-d');
    }

    public function isPast(): bool
    {
        return $this->value < date('Y-m-d');
    }

    public function isToday(): bool
    {
        return $this->value === date('Y-m-d');
    }

    public function equals(OrderDate $other): bool
    {
        return $this->value === $other->value;
    }

    public function __toString(): string
    {
        return $this->value;
    }
}
