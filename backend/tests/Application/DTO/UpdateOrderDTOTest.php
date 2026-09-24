<?php
declare(strict_types=1);

namespace App\Test\Application\DTO;

use App\Application\DTO\UpdateOrderDTO;
use PHPUnit\Framework\TestCase;

class UpdateOrderDTOTest extends TestCase
{
    // ── コンストラクタ ────────────────────────────────────────────────────────

    public function testConstructorSetsQuantity(): void
    {
        $dto = new UpdateOrderDTO(['quantity' => 3]);
        $this->assertSame(3, $dto->quantity);
    }

    public function testConstructorSetsStatus(): void
    {
        $dto = new UpdateOrderDTO(['status' => 'confirmed']);
        $this->assertSame('confirmed', $dto->status);
    }

    public function testConstructorDefaultsToNull(): void
    {
        $dto = new UpdateOrderDTO([]);
        $this->assertNull($dto->quantity);
        $this->assertNull($dto->status);
    }

    // ── validate ─────────────────────────────────────────────────────────────

    public function testValidateReturnsEmptyForEmptyDto(): void
    {
        $dto = new UpdateOrderDTO([]);
        $this->assertSame([], $dto->validate());
    }

    public function testValidateReturnsEmptyForValidQuantity(): void
    {
        $dto = new UpdateOrderDTO(['quantity' => 1]);
        $this->assertSame([], $dto->validate());
    }

    public function testValidateReturnsErrorForZeroQuantity(): void
    {
        $dto = new UpdateOrderDTO(['quantity' => 0]);
        $errors = $dto->validate();
        $this->assertArrayHasKey('quantity', $errors);
    }

    public function testValidateReturnsErrorForNegativeQuantity(): void
    {
        $dto = new UpdateOrderDTO(['quantity' => -1]);
        $errors = $dto->validate();
        $this->assertArrayHasKey('quantity', $errors);
    }

    public function testValidateReturnsEmptyForValidStatus(): void
    {
        foreach (['pending', 'confirmed', 'completed', 'cancelled'] as $status) {
            $dto = new UpdateOrderDTO(['status' => $status]);
            $this->assertSame([], $dto->validate(), "status={$status} は有効なはずです");
        }
    }

    public function testValidateReturnsErrorForInvalidStatus(): void
    {
        $dto = new UpdateOrderDTO(['status' => 'shipped']);
        $errors = $dto->validate();
        $this->assertArrayHasKey('status', $errors);
    }

    public function testValidateReturnsMultipleErrors(): void
    {
        $dto = new UpdateOrderDTO(['quantity' => 0, 'status' => 'bad']);
        $errors = $dto->validate();
        $this->assertArrayHasKey('quantity', $errors);
        $this->assertArrayHasKey('status', $errors);
    }

    // ── isValid ──────────────────────────────────────────────────────────────

    public function testIsValidReturnsTrueForEmptyDto(): void
    {
        $dto = new UpdateOrderDTO([]);
        $this->assertTrue($dto->isValid());
    }

    public function testIsValidReturnsFalseForInvalidData(): void
    {
        $dto = new UpdateOrderDTO(['quantity' => 0]);
        $this->assertFalse($dto->isValid());
    }
}
