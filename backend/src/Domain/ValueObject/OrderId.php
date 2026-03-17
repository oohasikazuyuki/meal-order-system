<?php
declare(strict_types=1);

namespace App\Domain\ValueObject;

/**
 * 発注ID値オブジェクト
 */
final class OrderId
{
    private ?int $value;

    private function __construct(?int $value)
    {
        // null（新規）または正の整数のみ許可
        if ($value !== null && $value <= 0) {
            throw new \InvalidArgumentException('OrderIdは正の整数である必要があります');
        }
        $this->value = $value;
    }

    /**
     * IDから生成（既存エンティティ用）
     */
    public static function fromInt(int $value): self
    {
        if ($value <= 0) {
            throw new \InvalidArgumentException('OrderIdは正の整数である必要があります');
        }
        return new self($value);
    }

    /**
     * 新規生成（新規エンティティ用）
     */
    public static function generate(): self
    {
        return new self(null);
    }

    /**
     * 値を取得（nullの可能性あり）
     */
    public function value(): ?int
    {
        return $this->value;
    }

    /**
     * 新規エンティティかどうか
     */
    public function isNew(): bool
    {
        return $this->value === null;
    }

    /**
     * 別のOrderIdと等価か
     */
    public function equals(OrderId $other): bool
    {
        return $this->value === $other->value;
    }

    /**
     * 文字列表現
     */
    public function __toString(): string
    {
        return (string)($this->value ?? '(new)');
    }
}
