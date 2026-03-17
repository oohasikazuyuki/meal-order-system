<?php
namespace App\Controller\Api;

use App\Controller\AppController;
use App\Service\UserService;

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
    private UserService $userService;

    public function initialize(): void
    {
        parent::initialize();
        $this->userService = new UserService();
    }

    public function index(): void
    {
        $users = $this->userService->getUserList();
        $this->set(['ok' => true, 'users' => $users]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'users']);
    }

    public function add(): void
    {
        $result = $this->userService->createUser($this->request->getData());

        if (!$result['success']) {
            $this->response = $this->response->withStatus($result['status']);
            if (isset($result['message'])) {
                $this->set(['ok' => false, 'message' => $result['message']]);
                $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            } else {
                $this->set(['ok' => false, 'errors' => $result['errors']]);
                $this->viewBuilder()->setOption('serialize', ['ok', 'errors']);
            }
            return;
        }

        $this->response = $this->response->withStatus($result['status']);
        $this->set(['ok' => true, 'user' => $result['user']]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'user']);
    }

    public function edit(int $id): void
    {
        $result = $this->userService->updateUser($id, $this->request->getData());

        if (!$result['success']) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'errors' => $result['errors']]);
            $this->viewBuilder()->setOption('serialize', ['ok', 'errors']);
            return;
        }

        $this->set(['ok' => true, 'user' => $result['user']]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'user']);
    }

    public function delete(int $id): void
    {
        $this->userService->deleteUser($id);
        $this->set(['ok' => true]);
        $this->viewBuilder()->setOption('serialize', ['ok']);
    }
}
