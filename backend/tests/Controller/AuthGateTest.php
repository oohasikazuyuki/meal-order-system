<?php
declare(strict_types=1);

namespace App\Test\Controller;

use App\Controller\Api\BlocksController;
use App\Controller\Api\UsersController;
use App\Controller\AppController;
use App\Service\AuthService;
use Cake\Core\Configure;
use Cake\Database\Driver\Mysql;
use Cake\Datasource\ConnectionManager;
use Cake\Http\ServerRequest;
use PHPUnit\Framework\TestCase;

/**
 * AppController::beforeFilter のログイン確認と、利用者管理の管理者確認。
 *
 * CI の PHPUnit には DB が無いので、トークン照合（AuthService）だけ差し替えて
 * 認証の入口（Controller::startupProcess）を直接通す。
 */
class AuthGateTest extends TestCase
{
    private const TOKENS = [
        'admin-token' => ['id' => 1, 'role' => 'admin'],
        'user-token' => ['id' => 2, 'role' => 'user'],
    ];

    protected function setUp(): void
    {
        // Response の文字コード。アプリ起動時は config/app.php が入れる
        Configure::write('App.encoding', 'UTF-8');
        Configure::write('App.namespace', 'App');
        // fetchTable に接続設定が要る。実際には接続しない（届かない先にしてある）
        if (!ConnectionManager::getConfig('default')) {
            ConnectionManager::setConfig('default', [
                'className' => \Cake\Database\Connection::class,
                'driver' => Mysql::class,
                'host' => '0.0.0.0',
                'database' => 'unused',
            ]);
        }
    }

    private function stubAuthService(): AuthService
    {
        return new class (self::TOKENS) extends AuthService {
            public function __construct(private array $tokens)
            {
                // 親は UserRepository（DB）を作るので呼ばない
            }

            public function getAuthenticatedUser(?string $token): array
            {
                if ($token !== null && isset($this->tokens[$token])) {
                    return ['success' => true, 'user' => $this->tokens[$token]];
                }

                return ['success' => false, 'status' => 401, 'message' => '未認証'];
            }
        };
    }

    private function request(string $controller, string $action, ?string $token): ServerRequest
    {
        return new ServerRequest([
            'params' => ['prefix' => 'Api', 'controller' => $controller, 'action' => $action, 'pass' => []],
            'environment' => $token === null ? [] : ['HTTP_AUTHORIZATION' => "Bearer {$token}"],
        ]);
    }

    // initialize() は fetchTable するだけで DB には触れない
    private function blocks(string $action, ?string $token): AppController
    {
        return new class ($this->request('Blocks', $action, $token), $this->stubAuthService()) extends BlocksController {
            /** 本体は動的プロパティに入れている。テスト側で宣言して非推奨警告を避ける */
            public $Blocks;

            public function __construct(ServerRequest $request, private AuthService $stub)
            {
                parent::__construct($request, 'Blocks');
            }

            protected function authService(): AuthService
            {
                return $this->stub;
            }
        };
    }

    private function users(string $action, ?string $token): AppController
    {
        return new class ($this->request('Users', $action, $token), $this->stubAuthService()) extends UsersController {
            public function __construct(ServerRequest $request, private AuthService $stub)
            {
                parent::__construct($request, 'Users');
            }

            protected function authService(): AuthService
            {
                return $this->stub;
            }
        };
    }

    public function testUnauthenticatedRequestIsRejectedWith401(): void
    {
        $response = $this->blocks('index', null)->startupProcess();

        $this->assertNotNull($response);
        $this->assertSame(401, $response->getStatusCode());
        $this->assertSame(['ok' => false, 'message' => '未認証'], json_decode((string)$response->getBody(), true));
    }

    public function testInvalidTokenIsRejectedWith401(): void
    {
        $response = $this->blocks('index', 'bogus')->startupProcess();

        $this->assertSame(401, $response?->getStatusCode());
    }

    public function testAuthenticatedRequestPassesWith200(): void
    {
        $controller = $this->blocks('index', 'user-token');

        $this->assertNull($controller->startupProcess());
        $this->assertSame(200, $controller->getResponse()->getStatusCode());
    }

    public function testNonAdminCannotAddUser(): void
    {
        $response = $this->users('add', 'user-token')->startupProcess();

        $this->assertSame(403, $response?->getStatusCode());
    }

    public function testUnauthenticatedCannotAddUser(): void
    {
        $this->assertSame(401, $this->users('add', null)->startupProcess()?->getStatusCode());
    }

    public function testAdminCanAddUser(): void
    {
        $this->assertNull($this->users('add', 'admin-token')->startupProcess());
    }
}
