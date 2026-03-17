<?php
namespace App\Repository;

use App\Model\Table\OrdersTable;
use Cake\ORM\Locator\LocatorAwareTrait;

class OrderRepository
{
    use LocatorAwareTrait;

    private OrdersTable $Orders;

    public function __construct()
    {
        $this->Orders = $this->fetchTable('Orders');
    }

    public function findAll(array $conditions = [], array $options = []): array
    {
        $query = $this->Orders->find('all');

        if (!empty($conditions)) {
            $query->where($conditions);
        }

        if (isset($options['contain'])) {
            $query->contain($options['contain']);
        }

        if (isset($options['order'])) {
            $query->orderBy($options['order']);
        }

        return $query->toList();
    }

    public function findById(int $id, array $options = [])
    {
        $query = $this->Orders->find();
        
        if (isset($options['contain'])) {
            $query->contain($options['contain']);
        }

        return $query->where(['id' => $id])->first();
    }

    public function findByDateAndStatus(string $date, ?string $excludeStatus = null): array
    {
        $query = $this->Orders->find('all')
            ->contain(['Menus'])
            ->where(['Orders.order_date' => $date]);

        if ($excludeStatus !== null) {
            $query->where(['Orders.status !=' => $excludeStatus]);
        }

        return $query->toList();
    }

    public function save($entity): bool
    {
        return (bool)$this->Orders->save($entity);
    }

    public function create(array $data)
    {
        return $this->Orders->newEmptyEntity();
    }

    public function patch($entity, array $data)
    {
        return $this->Orders->patchEntity($entity, $data);
    }

    public function delete($entity): bool
    {
        return (bool)$this->Orders->delete($entity);
    }

    public function get(int $id, array $options = [])
    {
        return $this->Orders->get($id, $options);
    }
}
