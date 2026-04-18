<?php
namespace App\Service;

use App\Repository\UserRepository;

class AuthService
{
    private UserRepository $userRepository;

    public function __construct()
    {
        $this->userRepository = new UserRepository();
    }

    /**
     * ログイン処理
     */
    public function login(string $loginId, string $password): array
    {
        if (!$loginId || !$password) {
            return [
                'success' => false,
                'status' => 400,
                'message' => 'ログインIDとパスワードは必須です'
            ];
        }

        $user = $this->userRepository->findByLoginId($loginId);

        if (!$user || !password_verify($password, $user->password)) {
            return [
                'success' => false,
                'status' => 401,
                'message' => 'ログインIDまたはパスワードが正しくありません'
            ];
        }

        // トークン生成・保存
        $token = bin2hex(random_bytes(32));
        $user->api_token = $token;
        $this->userRepository->save($user);

        return [
            'success' => true,
            'token' => $token,
            'user' => $this->toArray($user)
        ];
    }

    /**
     * Userオブジェクトを配列に変換（文字化け対策）
     */
    private function toArray($user): array
    {
        return [
            'id' => (int)$user->id,
            'name' => (string)$user->name,
            'login_id' => (string)$user->login_id,
            'role' => (string)$user->role,
            'block_id' => $user->block_id !== null ? (int)$user->block_id : null,
        ];
    }

    /**
     * ログアウト処理
     */
    public function logout(?string $token): bool
    {
        if (!$token) {
            return false;
        }

        $user = $this->userRepository->findByApiToken($token);
        if ($user) {
            $user->api_token = null;
            return $this->userRepository->save($user);
        }

        return false;
    }

    /**
     * 認証ユーザー情報取得
     */
    public function getAuthenticatedUser(?string $token): array
    {
        if (!$token) {
            return [
                'success' => false,
                'status' => 401,
                'message' => '未認証'
            ];
        }

        $user = $this->userRepository->findByApiToken($token);

        if (!$user) {
            return [
                'success' => false,
                'status' => 401,
                'message' => 'トークンが無効です'
            ];
        }

        return [
            'success' => true,
            'user' => $this->toArray($user)
        ];
    }

    /**
     * Bearerトークンを抽出
     */
    public function extractBearerToken(string $authHeader): ?string
    {
        if (preg_match('/^Bearer\s+(.+)$/i', $authHeader, $m)) {
            return $m[1];
        }
        return null;
    }
}
