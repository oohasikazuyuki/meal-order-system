<?php
namespace App\Repository;

use App\Model\Table\UsersTable;
use Cake\ORM\Locator\LocatorAwareTrait;

class UserRepository
{
    use LocatorAwareTrait;

    private UsersTable $Users;

    public function __construct()
    {
        $this->Users = $this->fetchTable('Users');
    }

    public function findByLoginId(string $loginId)
    {
        return $this->Users->find()->where(['login_id' => $loginId])->first();
    }

    public function findByApiToken(string $token)
    {
        return $this->Users->find()->where(['api_token' => $token])->first();
    }

    public function findById(int $id)
    {
        return $this->Users->find()->where(['id' => $id])->first();
    }

    public function findAll(array $options = []): array
    {
        $query = $this->Users->find();

        if (isset($options['select'])) {
            $query->select($options['select']);
        }

        if (isset($options['order'])) {
            $query->orderBy($options['order']);
        }

        return $query->toArray();
    }

    public function save($entity): bool
    {
        return (bool)$this->Users->save($entity);
    }

    public function create(array $data, array $options = [])
    {
        return $this->Users->newEntity($data, $options);
    }

    public function patch($entity, array $data, array $options = [])
    {
        return $this->Users->patchEntity($entity, $data, $options);
    }

    public function delete($entity): bool
    {
        return (bool)$this->Users->delete($entity);
    }

    public function get(int $id)
    {
        return $this->Users->get($id);
    }
}
