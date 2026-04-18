<?php
namespace App\Controller\Api;

use App\Controller\AppController;
use App\Repository\UserRepository;
use App\Service\AuthService;
use App\Service\CredentialCryptoService;
use Cake\I18n\FrozenTime;

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
    private UserRepository $userRepository;
    private CredentialCryptoService $credentialCryptoService;

    public function initialize(): void
    {
        parent::initialize();
        $this->authService = new AuthService();
        $this->userRepository = new UserRepository();
        $this->credentialCryptoService = new CredentialCryptoService();
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

    /** GET /api/auth/kamaho-link.json */
    public function kamahoLink(): void
    {
        $token = $this->authService->extractBearerToken(
            $this->request->getHeaderLine('Authorization')
        );
        $auth = $this->authService->getAuthenticatedUser($token);
        if (!$auth['success']) {
            $this->response = $this->response->withStatus($auth['status']);
            $this->set(['ok' => false, 'message' => $auth['message']]);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        $user = $this->userRepository->findById((int)$auth['user']['id']);
        if (!$user) {
            $this->response = $this->response->withStatus(404);
            $this->set(['ok' => false, 'message' => 'ユーザーが見つかりません']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        $this->set([
            'ok' => true,
            'kamaho_login_id' => $user->kamaho_login_id ?: null,
            'has_kamaho_link' => !empty($user->kamaho_login_id) && !empty($user->kamaho_password_enc),
            'kamaho_linked_at' => $user->kamaho_linked_at ? $user->kamaho_linked_at->format('Y-m-d H:i:s') : null,
        ]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'kamaho_login_id', 'has_kamaho_link', 'kamaho_linked_at']);
    }

    /** PUT /api/auth/kamaho-link.json */
    public function updateKamahoLink(): void
    {
        $token = $this->authService->extractBearerToken(
            $this->request->getHeaderLine('Authorization')
        );
        $auth = $this->authService->getAuthenticatedUser($token);
        if (!$auth['success']) {
            $this->response = $this->response->withStatus($auth['status']);
            $this->set(['ok' => false, 'message' => $auth['message']]);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        $user = $this->userRepository->findById((int)$auth['user']['id']);
        if (!$user) {
            $this->response = $this->response->withStatus(404);
            $this->set(['ok' => false, 'message' => 'ユーザーが見つかりません']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        $data = $this->request->getData();
        $loginId = trim((string)($data['kamaho_login_id'] ?? ''));
        $password = (string)($data['kamaho_password'] ?? '');

        if ($loginId === '') {
            $user->kamaho_login_id = null;
            $user->kamaho_password_enc = null;
            $user->kamaho_linked_at = null;
        } else {
            $user->kamaho_login_id = $loginId;
            if ($password !== '') {
                $user->kamaho_password_enc = $this->credentialCryptoService->encrypt($password);
                $user->kamaho_linked_at = FrozenTime::now();
            }
        }

        if (!$this->userRepository->save($user)) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'message' => '連携情報の更新に失敗しました']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        $this->set([
            'ok' => true,
            'kamaho_login_id' => $user->kamaho_login_id ?: null,
            'has_kamaho_link' => !empty($user->kamaho_login_id) && !empty($user->kamaho_password_enc),
            'kamaho_linked_at' => $user->kamaho_linked_at ? $user->kamaho_linked_at->format('Y-m-d H:i:s') : null,
        ]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'kamaho_login_id', 'has_kamaho_link', 'kamaho_linked_at']);
    }
}
