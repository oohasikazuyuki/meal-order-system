<?php
namespace App\Controller\Api;

use App\Controller\AppController;

/**
 * ユーザー管理 API
 *
 * GET    /api/users.json       → 一覧
 * POST   /api/users.json       → 新規作成
 * PUT    /api/users/:id.json   → 更新
 * DELETE /api/users/:id.json   → 削除
 */
class UsersController extends AppController
{
    public function index(): void
    {
        $users = $this->fetchTable('Users')
            ->find()
            ->select(['id', 'name', 'login_id', 'role', 'block_id', 'created'])
            ->orderBy(['id' => 'ASC'])
            ->toArray();

        $this->set(['ok' => true, 'users' => $users]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'users']);
    }

    public function add(): void
    {
        $data = $this->request->getData();
        $table = $this->fetchTable('Users');

        if (empty($data['password'])) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'message' => 'パスワードは必須です']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        $data['password'] = password_hash($data['password'], PASSWORD_BCRYPT);

        // block_id: 空文字またはnullの場合はnullに統一
        if (array_key_exists('block_id', $data)) {
            $data['block_id'] = ($data['block_id'] !== '' && $data['block_id'] !== null) ? (int)$data['block_id'] : null;
        }
        $user = $table->newEntity($data, ['accessibleFields' => ['name' => true, 'login_id' => true, 'password' => true, 'role' => true, 'block_id' => true]]);

        if ($table->save($user)) {
            $this->response = $this->response->withStatus(201);
            $this->set(['ok' => true, 'user' => ['id' => $user->id, 'name' => $user->name, 'login_id' => $user->login_id, 'role' => $user->role, 'block_id' => $user->block_id]]);
        } else {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'errors' => $user->getErrors()]);
        }
        $this->viewBuilder()->setOption('serialize', ['ok', 'user', 'errors', 'message']);
    }

    public function edit(int $id): void
    {
        $table = $this->fetchTable('Users');
        $user  = $table->get($id);
        $data  = $this->request->getData();

        // パスワードが送られてきた場合のみハッシュ化
        if (!empty($data['password'])) {
            $data['password'] = password_hash($data['password'], PASSWORD_BCRYPT);
        } else {
            unset($data['password']);
        }

        if (array_key_exists('block_id', $data)) {
            $data['block_id'] = ($data['block_id'] !== '' && $data['block_id'] !== null) ? (int)$data['block_id'] : null;
        }
        $table->patchEntity($user, $data, ['accessibleFields' => ['name' => true, 'login_id' => true, 'password' => true, 'role' => true, 'block_id' => true]]);

        if ($table->save($user)) {
            $this->set(['ok' => true, 'user' => ['id' => $user->id, 'name' => $user->name, 'login_id' => $user->login_id, 'role' => $user->role, 'block_id' => $user->block_id]]);
        } else {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'errors' => $user->getErrors()]);
        }
        $this->viewBuilder()->setOption('serialize', ['ok', 'user', 'errors']);
    }

    public function delete(int $id): void
    {
        $table = $this->fetchTable('Users');
        $user  = $table->get($id);
        $table->delete($user);

        $this->set(['ok' => true]);
        $this->viewBuilder()->setOption('serialize', ['ok']);
    }
}
