<?php
declare(strict_types=1);

namespace App\Application\DTO;

/**
 * 発注更新DTO
 */
final class UpdateOrderDTO
{
    public ?int $quantity = null;
    public ?string $status = null;

    public function __construct(array $data)
    {
        if (isset($data['quantity'])) {
            $this->quantity = (int)$data['quantity'];
        }

        if (isset($data['status'])) {
            $this->status = $data['status'];
        }
    }

    public function validate(): array
    {
        $errors = [];

        if ($this->quantity !== null && $this->quantity <= 0) {
            $errors['quantity'] = '数量は1以上である必要があります';
        }

        if ($this->status !== null) {
            $validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
            if (!in_array($this->status, $validStatuses, true)) {
                $errors['status'] = '無効なステータスです';
            }
        }

        return $errors;
    }

    public function isValid(): bool
    {
        return empty($this->validate());
    }
}
