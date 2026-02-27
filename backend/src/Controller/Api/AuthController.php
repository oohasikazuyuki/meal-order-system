<?php
namespace App\Controller\Api;

use App\Controller\AppController;

/**
 * 認証 API
 *
 * POST /api/auth/login.json   → ログイン（ID or email + password）
 * POST /api/auth/logout.json  → ログアウト
 * GET  /api/auth/me.json      → 現在のログインユーザー取得
 */
class AuthController extends AppController
{
    /** POST /api/auth/login.json */
    public function login(): void
    {
        $data     = $this->request->getData();
        $loginId  = trim((string)($data['login_id'] ?? ''));
        $password = (string)($data['password'] ?? '');

        if (!$loginId || !$password) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'message' => 'ログインIDとパスワードは必須です']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        $usersTable = $this->fetchTable('Users');
        $user = $usersTable->find()->where(['login_id' => $loginId])->first();

        if (!$user || !password_verify($password, $user->password)) {
            $this->response = $this->response->withStatus(401);
            $this->set(['ok' => false, 'message' => 'ログインIDまたはパスワードが正しくありません']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        // トークン生成・保存
        $token = bin2hex(random_bytes(32));
        $user->api_token = $token;
        $usersTable->save($user);

        $this->set([
            'ok'    => true,
            'token' => $token,
            'user'  => [
                'id'       => $user->id,
                'name'     => $user->name,
                'role'     => $user->role,
                'block_id' => $user->block_id,
            ],
        ]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'token', 'user']);
    }

    /** POST /api/auth/logout.json */
    public function logout(): void
    {
        $token = $this->getBearerToken();
        if ($token) {
            $usersTable = $this->fetchTable('Users');
            $user = $usersTable->find()->where(['api_token' => $token])->first();
            if ($user) {
                $user->api_token = null;
                $usersTable->save($user);
            }
        }

        $this->set(['ok' => true]);
        $this->viewBuilder()->setOption('serialize', ['ok']);
    }

    /** GET /api/auth/me.json */
    public function me(): void
    {
        $token = $this->getBearerToken();
        if (!$token) {
            $this->response = $this->response->withStatus(401);
            $this->set(['ok' => false, 'message' => '未認証']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        $usersTable = $this->fetchTable('Users');
        $user = $usersTable->find()->where(['api_token' => $token])->first();

        if (!$user) {
            $this->response = $this->response->withStatus(401);
            $this->set(['ok' => false, 'message' => 'トークンが無効です']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        $this->set([
            'ok'   => true,
            'user' => [
                'id'       => $user->id,
                'name'     => $user->name,
                'role'     => $user->role,
                'block_id' => $user->block_id,
            ],
        ]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'user']);
    }

    private function getBearerToken(): ?string
    {
        $header = $this->request->getHeaderLine('Authorization');
        if (preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
            return $m[1];
        }
        return null;
    }
}
