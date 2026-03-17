<?php
declare(strict_types=1);

namespace App\Application\DTO;

/**
 * 発注作成DTO
 */
final class CreateOrderDTO
{
    public int $userId;
    public int $menuId;
    public int $quantity;
    public string $orderDate;

    public function __construct(array $data)
    {
        $this->userId = (int)($data['user_id'] ?? 0);
        $this->menuId = (int)($data['menu_id'] ?? 0);
        $this->quantity = (int)($data['quantity'] ?? 1);
        $this->orderDate = $data['order_date'] ?? date('Y-m-d');
    }

    public function validate(): array
    {
        $errors = [];

        if ($this->userId <= 0) {
            $errors['user_id'] = 'ユーザーIDは必須です';
        }

        if ($this->menuId <= 0) {
            $errors['menu_id'] = 'メニューIDは必須です';
        }

        if ($this->quantity <= 0) {
            $errors['quantity'] = '数量は1以上である必要があります';
        }

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $this->orderDate)) {
            $errors['order_date'] = '発注日はYYYY-MM-DD形式である必要があります';
        }

        return $errors;
    }

    public function isValid(): bool
    {
        return empty($this->validate());
    }
}
