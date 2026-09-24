<?php
namespace App\Service;

use App\Repository\UserRepository;
use Cake\Http\ServerRequest;

/**
 * kamaho に接続するときの資格情報を決める。
 *
 * ログイン中のユーザーが連携情報を登録していればそれを使う。
 * 無ければ空を返し、呼び出し側は環境変数の既定アカウントで接続する。
 *
 * リクエストヘッダから資格情報を受け取る経路は廃止した。
 * パスワードはアクセスログやプロキシに残るうえ、ログインさえしていれば
 * 誰でも任意のアカウントで外部システムに接続できてしまうため。
 * フロントエンドはこの経路を使っておらず、連携情報は POST body で送っている。
 */
class KamahoCredentialResolverService
{
    private AuthService $authService;
    private UserRepository $userRepository;
    private CredentialCryptoService $credentialCryptoService;

    public function __construct()
    {
        $this->authService = new AuthService();
        $this->userRepository = new UserRepository();
        $this->credentialCryptoService = new CredentialCryptoService();
    }

    /**
     * @return array{login_account: string, login_password: string}|array{}
     * @throws CredentialDecryptionException 登録済みの連携情報を復号できないとき。
     *   呼び出し側で捕まえて、再連携を促すこと。
     */
    public function resolveKamahoOptions(ServerRequest $request): array
    {
        $token = $this->authService->extractBearerToken($request->getHeaderLine('Authorization'));
        if (!$token) {
            return [];
        }

        $user = $this->userRepository->findByApiToken($token);
        if (!$user || empty($user->kamaho_login_id) || empty($user->kamaho_password_enc)) {
            return [];
        }

        $password = $this->credentialCryptoService->decrypt((string)$user->kamaho_password_enc);

        return [
            'login_account' => (string)$user->kamaho_login_id,
            'login_password' => $password,
        ];
    }
}
