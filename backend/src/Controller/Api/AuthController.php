<?php
namespace App\Controller\Api;

use App\Controller\AppController;
use App\Service\AuthService;

/**
 * 認証 API
 *
 * POST /api/auth/login.json   → ログイン（ID or email + password）
 * POST /api/auth/logout.json  → ログアウト
 * GET  /api/auth/me.json      → 現在のログインユーザー取得
 */
class AuthController extends AppController
{
    private AuthService $authService;

    public function initialize(): void
    {
        parent::initialize();
        $this->authService = new AuthService();
    }

    /** POST /api/auth/login.json */
    public function login(): void
    {
        $data = $this->request->getData();
        $loginId = trim((string)($data['login_id'] ?? ''));
        $password = (string)($data['password'] ?? '');

        $result = $this->authService->login($loginId, $password);

        if (!$result['success']) {
            $this->response = $this->response->withStatus($result['status']);
            $this->set(['ok' => false, 'message' => $result['message']]);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        $this->set([
            'ok' => true,
            'token' => $result['token'],
            'user' => $result['user'],
        ]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'token', 'user']);
    }

    /** POST /api/auth/logout.json */
    public function logout(): void
    {
        $token = $this->authService->extractBearerToken(
            $this->request->getHeaderLine('Authorization')
        );
        $this->authService->logout($token);

        $this->set(['ok' => true]);
        $this->viewBuilder()->setOption('serialize', ['ok']);
    }

    /** GET /api/auth/me.json */
    public function me(): void
    {
        $token = $this->authService->extractBearerToken(
            $this->request->getHeaderLine('Authorization')
        );
        $result = $this->authService->getAuthenticatedUser($token);

        if (!$result['success']) {
            $this->response = $this->response->withStatus($result['status']);
            $this->set(['ok' => false, 'message' => $result['message']]);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        $this->set([
            'ok' => true,
            'user' => $result['user'],
        ]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'user']);
    }
}
