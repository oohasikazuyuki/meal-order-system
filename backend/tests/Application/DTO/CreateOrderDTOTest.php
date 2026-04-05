<?php
declare(strict_types=1);

namespace App\Test\Application\DTO;

use App\Application\DTO\CreateOrderDTO;
use PHPUnit\Framework\TestCase;

class CreateOrderDTOTest extends TestCase
{
    private function validData(): array
    {
        return [
            'user_id'    => 1,
            'menu_id'    => 10,
            'quantity'   => 2,
            'order_date' => '2026-04-05',
        ];
    }

    // ── コンストラクタ ────────────────────────────────────────────────────────

    public function testConstructorSetsValues(): void
    {
        $dto = new CreateOrderDTO($this->validData());
        $this->assertSame(1, $dto->userId);
        $this->assertSame(10, $dto->menuId);
        $this->assertSame(2, $dto->quantity);
        $this->assertSame('2026-04-05', $dto->orderDate);
    }

    public function testConstructorUsesDefaultsForMissingKeys(): void
    {
        $dto = new CreateOrderDTO([]);
        $this->assertSame(0, $dto->userId);
        $this->assertSame(0, $dto->menuId);
        $this->assertSame(1, $dto->quantity);  // デフォルト1
        $this->assertSame(date('Y-m-d'), $dto->orderDate);  // 今日
    }

    // ── validate ─────────────────────────────────────────────────────────────

    public function testValidateReturnsEmptyArrayForValidData(): void
    {
        $dto = new CreateOrderDTO($this->validData());
        $this->assertSame([], $dto->validate());
    }

    public function testValidateReturnsErrorForZeroUserId(): void
    {
        $dto = new CreateOrderDTO(array_merge($this->validData(), ['user_id' => 0]));
        $errors = $dto->validate();
        $this->assertArrayHasKey('user_id', $errors);
    }

    public function testValidateReturnsErrorForNegativeUserId(): void
    {
        $dto = new CreateOrderDTO(array_merge($this->validData(), ['user_id' => -1]));
        $errors = $dto->validate();
        $this->assertArrayHasKey('user_id', $errors);
    }

    public function testValidateReturnsErrorForZeroMenuId(): void
    {
        $dto = new CreateOrderDTO(array_merge($this->validData(), ['menu_id' => 0]));
        $errors = $dto->validate();
        $this->assertArrayHasKey('menu_id', $errors);
    }

    public function testValidateReturnsErrorForZeroQuantity(): void
    {
        $dto = new CreateOrderDTO(array_merge($this->validData(), ['quantity' => 0]));
        $errors = $dto->validate();
        $this->assertArrayHasKey('quantity', $errors);
    }

    public function testValidateReturnsErrorForInvalidDateFormat(): void
    {
        $dto = new CreateOrderDTO(array_merge($this->validData(), ['order_date' => '2026/04/05']));
        $errors = $dto->validate();
        $this->assertArrayHasKey('order_date', $errors);
    }

    public function testValidateReturnsMultipleErrors(): void
    {
        $dto = new CreateOrderDTO(['user_id' => 0, 'menu_id' => 0, 'quantity' => 0, 'order_date' => 'bad']);
        $errors = $dto->validate();
        $this->assertCount(4, $errors);
    }

    // ── isValid ──────────────────────────────────────────────────────────────

    public function testIsValidReturnsTrueForValidData(): void
    {
        $dto = new CreateOrderDTO($this->validData());
        $this->assertTrue($dto->isValid());
    }

    public function testIsValidReturnsFalseForInvalidData(): void
    {
        $dto = new CreateOrderDTO([]);
        $this->assertFalse($dto->isValid());
    }
}
