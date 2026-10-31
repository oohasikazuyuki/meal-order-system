<?php
namespace App\Controller;

use App\Service\AuthService;
use Cake\Controller\Controller;
use Cake\Event\EventInterface;

class AppController extends Controller
{
    /**
     * ログインなしで呼べる操作（"Controller.action"）。ここ以外は全部ログイン必須。
     * logout はトークン切れでも端末側のログアウトを妨げないために開けておく。
     */
    private const PUBLIC_ACTIONS = [
        'Auth.login',
        'Auth.logout',
    ];

    /** beforeFilter で確認したログイン中のユーザー */
    protected ?array $authUser = null;

    protected function authService(): AuthService
    {
        return new AuthService();
    }

    public function beforeFilter(EventInterface $event): void
    {
        parent::beforeFilter($event);

        $key = $this->request->getParam('controller') . '.' . $this->request->getParam('action');
        if (in_array($key, self::PUBLIC_ACTIONS, true)) {
            return;
        }

        $authService = $this->authService();
        $result = $authService->getAuthenticatedUser(
            $authService->extractBearerToken($this->request->getHeaderLine('Authorization'))
        );
        if (!$result['success']) {
            $event->setResult($this->jsonError($result['status'], $result['message']));
            $event->stopPropagation();
            return;
        }

        $this->authUser = $result['user'];
    }

    /**
     * 管理者だけに許す操作の入口で呼ぶ。管理者でなければ 403 を返して止める。
     */
    protected function requireAdmin(EventInterface $event): void
    {
        if ($event->isStopped() || ($this->authUser['role'] ?? null) === 'admin') {
            return;
        }
        $event->setResult($this->jsonError(403, '管理者のみ操作できます'));
        $event->stopPropagation();
    }

    /**
     * ログイン確認は beforeFilter で済んでいる。ここは確認済みのユーザーを返すだけ。
     */
    protected function requireAuthenticatedUser(): ?array
    {
        return $this->authUser;
    }

    private function jsonError(int $status, string $message): \Cake\Http\Response
    {
        return $this->response
            ->withStatus($status)
            ->withType('application/json')
            ->withCharset('utf-8')
            ->withStringBody((string)json_encode(['ok' => false, 'message' => $message], JSON_UNESCAPED_UNICODE));
    }

    public function initialize(): void
    {
        parent::initialize();
    }

    public function beforeRender(EventInterface $event): void
    {
        parent::beforeRender($event);
        $path = $this->request->getPath();
        $isApiPath = str_starts_with($path, '/api/');

        // API配下は常にJsonViewを使用（拡張子/Acceptに依存しない）
        if (
            $isApiPath
            || $this->request->getParam('prefix') === 'Api'
            || $this->request->getParam('prefix') === 'api'
            || $this->request->getParam('_ext') === 'json'
            || str_contains($this->request->getHeaderLine('Accept'), 'application/json')
        ) {
            $this->viewBuilder()
                ->setClassName('App\View\JsonView')
                ->setOption('jsonOptions', JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT);
            
            // JSON応答のCharsetをUTF-8に指定
            $this->response = $this->response
                ->withType('application/json')
                ->withCharset('utf-8');

            // APIは更新直後の反映を優先し、ブラウザ/中間キャッシュを無効化
            $this->response = $this->response
                ->withHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
                ->withHeader('Pragma', 'no-cache')
                ->withHeader('Expires', '0');
        }
    }
}
