<?php
namespace App\Service;

use App\Repository\UserRepository;
use Cake\Http\ServerRequest;

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

    public function resolveKamahoOptions(ServerRequest $request): array
    {
        $fromUser = $this->resolveFromAuthenticatedUser($request);
        if (!empty($fromUser)) {
            return $fromUser;
        }

        return $this->resolveFromHeaders($request);
    }

    private function resolveFromAuthenticatedUser(ServerRequest $request): array
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
        if ($password === '') {
            return [];
        }

        return [
            'login_account' => (string)$user->kamaho_login_id,
            'login_password' => $password,
        ];
    }

    private function resolveFromHeaders(ServerRequest $request): array
    {
        $account = trim($request->getHeaderLine('X-Kamaho-Login-Account'));
        $password = $request->getHeaderLine('X-Kamaho-Login-Password');
        $accountB64 = $request->getHeaderLine('X-Kamaho-Login-Account-B64');
        $passwordB64 = $request->getHeaderLine('X-Kamaho-Login-Password-B64');

        if ($accountB64 !== '' && $passwordB64 !== '') {
            $decodedAccount = base64_decode($accountB64, true);
            $decodedPassword = base64_decode($passwordB64, true);
            if ($decodedAccount !== false && $decodedPassword !== false) {
                $account = trim($decodedAccount);
                $password = $decodedPassword;
            }
        }

        if ($account === '' || $password === '') {
            return [];
        }

        return [
            'login_account' => $account,
            'login_password' => $password,
        ];
    }
}
