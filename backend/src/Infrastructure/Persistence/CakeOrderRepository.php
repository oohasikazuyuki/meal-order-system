<?php
declare(strict_types=1);

namespace App\Infrastructure\Persistence;

use App\Domain\Entity\Order;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\ValueObject\OrderDate;
use App\Domain\ValueObject\OrderId;
use App\Domain\ValueObject\OrderStatus;
use Cake\ORM\Locator\LocatorAwareTrait;

/**
 * 発注リポジトリ実装（インフラストラクチャ層）
 * CakePHP ORM を使用した実装
 */
class CakeOrderRepository implements OrderRepositoryInterface
{
    use LocatorAwareTrait;

    private $ordersTable;

    public function __construct()
    {
        $this->ordersTable = $this->fetchTable('Orders');
    }

    /**
     * 発注を保存（新規作成または更新）
     */
    public function save(Order $order): void
    {
        $data = [
            'user_id' => $order->getUserId(),
            'menu_id' => $order->getMenuId(),
            'quantity' => $order->getQuantity(),
            'order_date' => $order->getOrderDate()->value(),
            'status' => $order->getStatus()->value(),
        ];

        // 新規作成 or 更新を判定
        $isNew = $order->getId()->isNew();

        if ($isNew) {
            // 新規作成
            $entity = $this->ordersTable->newEntity($data);
        } else {
            // 更新
            $entity = $this->ordersTable->get($order->getId()->value());
            $entity = $this->ordersTable->patchEntity($entity, $data);
        }

        $result = $this->ordersTable->save($entity);
        
        if (!$result) {
            throw new \RuntimeException('発注の保存に失敗しました');
        }

        // 新規作成時はIDを更新
        if ($isNew) {
            $reflection = new \ReflectionClass($order);
            $property = $reflection->getProperty('id');
            $property->setAccessible(true);
            $property->setValue($order, OrderId::fromInt((int)$entity->id));
        }
    }

    /**
     * IDで発注を取得
     */
    public function findById(OrderId $id): ?Order
    {
        try {
            $entity = $this->ordersTable->get($id->value(), [
                'contain' => ['Users', 'Menus']
            ]);
            return $this->toDomain($entity);
        } catch (\Cake\Datasource\Exception\RecordNotFoundException $e) {
            return null;
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * すべての発注を取得
     */
    public function findAll(): array
    {
        $entities = $this->ordersTable->find('all')
            ->contain(['Users', 'Menus'])
            ->orderBy(['Orders.order_date' => 'DESC', 'Orders.id' => 'DESC'])
            ->toArray();

        return array_map(fn($entity) => $this->toDomain($entity), $entities);
    }

    /**
     * 日付で発注を取得
     */
    public function findByDate(OrderDate $date): array
    {
        $entities = $this->ordersTable->find('all')
            ->where(['order_date' => $date->value()])
            ->contain(['Users', 'Menus'])
            ->orderBy(['Orders.id' => 'ASC'])
            ->toArray();

        return array_map(fn($entity) => $this->toDomain($entity), $entities);
    }

    /**
     * ユーザーIDで発注を取得
     */
    public function findByUserId(int $userId): array
    {
        $entities = $this->ordersTable->find('all')
            ->where(['user_id' => $userId])
            ->orderBy(['Orders.order_date' => 'DESC', 'Orders.id' => 'DESC'])
            ->toArray();

        return array_map(fn($entity) => $this->toDomain($entity), $entities);
    }

    /**
     * 日付とステータスで発注を取得（特定ステータスを除外）
     */
    public function findByDateExcludingStatus(OrderDate $date, string $excludeStatus): array
    {
        $entities = $this->ordersTable->find('all')
            ->where([
                'order_date' => $date->value(),
                'status !=' => $excludeStatus
            ])
            ->contain(['Menus'])
            ->orderBy(['Orders.id' => 'ASC'])
            ->toArray();

        return array_map(fn($entity) => $this->toDomain($entity), $entities);
    }

    /**
     * 発注を削除
     */
    public function delete(Order $order): void
    {
        if ($order->getId()->isNew()) {
            throw new \InvalidArgumentException('新規エンティティは削除できません');
        }

        $entity = $this->ordersTable->get($order->getId()->value());
        $this->ordersTable->delete($entity);
    }

    /**
     * Cakeエンティティをドメインエンティティに変換
     */
    private function toDomain($cakeEntity): Order
    {
        $orderDateValue = $cakeEntity->order_date instanceof \DateTimeInterface
            ? $cakeEntity->order_date->format('Y-m-d')
            : substr((string)$cakeEntity->order_date, 0, 10);

        $createdAt = null;
        if (!empty($cakeEntity->created)) {
            $createdAt = $cakeEntity->created instanceof \DateTimeInterface
                ? new \DateTimeImmutable($cakeEntity->created->format('Y-m-d H:i:s'))
                : new \DateTimeImmutable((string)$cakeEntity->created);
        }

        $updatedAt = null;
        if (!empty($cakeEntity->modified)) {
            $updatedAt = $cakeEntity->modified instanceof \DateTimeInterface
                ? new \DateTimeImmutable($cakeEntity->modified->format('Y-m-d H:i:s'))
                : new \DateTimeImmutable((string)$cakeEntity->modified);
        }

        return new Order(
            OrderId::fromInt((int)$cakeEntity->id),
            (int)$cakeEntity->user_id,
            (int)$cakeEntity->menu_id,
            (int)$cakeEntity->quantity,
            OrderDate::fromString($orderDateValue),
            OrderStatus::fromString((string)($cakeEntity->status ?? 'pending')),
            $createdAt,
            $updatedAt
        );
    }
}
