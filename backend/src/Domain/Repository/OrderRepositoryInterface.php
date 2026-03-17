<?php
declare(strict_types=1);

namespace App\Domain\Repository;

use App\Domain\Entity\Order;
use App\Domain\ValueObject\OrderDate;
use App\Domain\ValueObject\OrderId;

/**
 * 発注リポジトリインターフェース（ドメイン層）
 */
interface OrderRepositoryInterface
{
    /**
     * 発注を保存（新規作成または更新）
     * 
     * @param Order $order
     * @return void
     * @throws \RuntimeException 保存失敗時
     */
    public function save(Order $order): void;

    /**
     * IDで発注を取得
     * 
     * @param OrderId $id
     * @return Order|null
     */
    public function findById(OrderId $id): ?Order;

    /**
     * すべての発注を取得
     * 
     * @return Order[]
     */
    public function findAll(): array;

    /**
     * 日付で発注を取得
     * 
     * @param OrderDate $date
     * @return Order[]
     */
    public function findByDate(OrderDate $date): array;

    /**
     * ユーザーIDで発注を取得
     * 
     * @param int $userId
     * @return Order[]
     */
    public function findByUserId(int $userId): array;

    /**
     * 日付とステータスで発注を取得（特定ステータスを除外）
     * 
     * @param OrderDate $date
     * @param string $excludeStatus
     * @return Order[]
     */
    public function findByDateExcludingStatus(OrderDate $date, string $excludeStatus): array;

    /**
     * 発注を削除
     * 
     * @param Order $order
     * @return void
     */
    public function delete(Order $order): void;
}
