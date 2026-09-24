<?php
namespace App\Controller;

use App\Service\AuthService;
use Cake\Controller\Controller;
use Cake\Event\EventInterface;

class AppController extends Controller
{
    protected function requireAuthenticatedUser(): ?array
    {
        $authService = new AuthService();
        $token = $authService->extractBearerToken(
            $this->request->getHeaderLine('Authorization')
        );
        $result = $authService->getAuthenticatedUser($token);

        if (!$result['success']) {
            $this->response = $this->response->withStatus($result['status']);
            $this->set([
                'ok' => false,
                'message' => $result['message'],
            ]);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return null;
        }

        return $result['user'];
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
