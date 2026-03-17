<?php
namespace App\Service;

use App\Repository\UserRepository;

class UserService
{
    private UserRepository $userRepository;

    public function __construct()
    {
        $this->userRepository = new UserRepository();
    }

    /**
     * ユーザー一覧取得
     */
    public function getUserList(): array
    {
        $users = $this->userRepository->findAll([
            'select' => ['id', 'name', 'login_id', 'role', 'block_id', 'created'],
            'order' => ['id' => 'ASC']
        ]);
        
        return $this->fixEncoding($users);
    }

    /**
     * 文字エンコーディングの修正（UTF-8への正規化）
     */
    private function fixEncoding(array $data): array
    {
        return array_map(function ($item) {
            if (is_array($item)) {
                return $this->fixEncoding($item);
            }
            if (is_string($item)) {
                $detected = mb_detect_encoding($item, ['UTF-8', 'ISO-8859-1', 'Windows-1252'], true);
                if ($detected !== 'UTF-8' && $detected !== false) {
                    return mb_convert_encoding($item, 'UTF-8', $detected);
                }
            }
            return $item;
        }, $data);
    }

    /**
     * ユーザー作成
     */
    public function createUser(array $data): array
    {
        // バリデーション
        if (empty($data['name'])) {
            return [
                'success' => false,
                'status' => 400,
                'message' => '名前は必須です'
            ];
        }

        if (empty($data['login_id'])) {
            return [
                'success' => false,
                'status' => 400,
                'message' => 'ログインIDは必須です'
            ];
        }

        if (empty($data['password'])) {
            return [
                'success' => false,
                'status' => 400,
                'message' => 'パスワードは必須です'
            ];
        }

        // 権限の検証
        if (empty($data['role']) || !in_array($data['role'], ['admin', 'user'], true)) {
            return [
                'success' => false,
                'status' => 400,
                'message' => '権限は admin または user で指定してください'
            ];
        }

        // 既存スキーマ互換: email 必須カラムがある場合に備えて補完
        if (empty($data['email'])) {
            $data['email'] = sprintf('%s@local.invalid', (string)$data['login_id']);
        }

        $data['password'] = password_hash($data['password'], PASSWORD_BCRYPT);

        // block_id: 空文字またはnullの場合はnullに統一
        if (array_key_exists('block_id', $data)) {
            $data['block_id'] = ($data['block_id'] !== '' && $data['block_id'] !== null && $data['block_id'] !== 0) 
                ? (int)$data['block_id'] : null;
        } else {
            $data['block_id'] = null;
        }

        $user = $this->userRepository->create($data, [
            'accessibleFields' => [
                'name' => true, 
                'login_id' => true, 
                'email' => true,
                'password' => true, 
                'role' => true, 
                'block_id' => true
            ]
        ]);

        $success = $this->userRepository->save($user);

        return [
            'success' => $success,
            'status' => $success ? 201 : 400,
            'user' => $success ? [
                'id' => $user->id,
                'name' => $user->name,
                'login_id' => $user->login_id,
                'role' => $user->role,
                'block_id' => $user->block_id,
                'created' => $user->created ? $user->created->format('Y-m-d H:i:s') : null
            ] : null,
            'errors' => $success ? [] : $user->getErrors()
        ];
    }

    /**
     * ユーザー更新
     */
    public function updateUser(int $id, array $data): array
    {
        try {
            $user = $this->userRepository->get($id);
        } catch (\Exception $e) {
            return [
                'success' => false,
                'errors' => ['id' => 'ユーザーが見つかりません']
            ];
        }

        // パスワードが送られてきた場合のみハッシュ化
        if (!empty($data['password'])) {
            $data['password'] = password_hash($data['password'], PASSWORD_BCRYPT);
        } else {
            unset($data['password']);
        }

        // 権限の検証
        if (isset($data['role']) && !in_array($data['role'], ['admin', 'user'], true)) {
            return [
                'success' => false,
                'errors' => ['role' => '権限は admin または user で指定してください']
            ];
        }

        // block_id: 空文字またはnullの場合はnullに統一
        if (array_key_exists('block_id', $data)) {
            $data['block_id'] = ($data['block_id'] !== '' && $data['block_id'] !== null && $data['block_id'] !== 0) 
                ? (int)$data['block_id'] : null;
        }

        $this->userRepository->patch($user, $data, [
            'accessibleFields' => [
                'name' => true, 
                'login_id' => true, 
                'password' => true, 
                'role' => true, 
                'block_id' => true
            ]
        ]);

        $success = $this->userRepository->save($user);

        return [
            'success' => $success,
            'user' => $success ? [
                'id' => $user->id,
                'name' => $user->name,
                'login_id' => $user->login_id,
                'role' => $user->role,
                'block_id' => $user->block_id,
                'created' => $user->created ? $user->created->format('Y-m-d H:i:s') : null
            ] : null,
            'errors' => $success ? [] : $user->getErrors()
        ];
    }

    /**
     * ユーザー削除
     */
    public function deleteUser(int $id): bool
    {
        $user = $this->userRepository->get($id);
        return $this->userRepository->delete($user);
    }
}
