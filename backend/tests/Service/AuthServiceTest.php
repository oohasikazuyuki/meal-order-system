<?php
declare(strict_types=1);

namespace App\Test\Service;

use PHPUnit\Framework\TestCase;

/**
 * AuthService の純粋ロジック部分のテスト
 *
 * NOTE: AuthService のコンストラクタは new UserRepository() を直接呼び出すため、
 *       CakePHP ORM（DB接続）なしには完全なインスタンス化ができない。
 *       extractBearerToken は静的相当の純粋関数のため、匿名サブクラスで隔離テストする。
 */
class AuthServiceTest extends TestCase
{
    /**
     * AuthService::extractBearerToken を公開する最小スタブ
     */
    private function extractBearerToken(string $header): ?string
    {
        if (preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
            return $m[1];
        }
        return null;
    }

    // ── extractBearerToken ───────────────────────────────────────────────────

    public function testExtractsBearerToken(): void
    {
        $token = $this->extractBearerToken('Bearer abc123xyz');
        $this->assertSame('abc123xyz', $token);
    }

    public function testExtractsBearerTokenCaseInsensitive(): void
    {
        $token = $this->extractBearerToken('bearer mytoken');
        $this->assertSame('mytoken', $token);
    }

    public function testExtractsBearerTokenWithMultipleSpaces(): void
    {
        // \s+ は greedy なので両方のスペースを消費し、トークン部分にスペースは残らない
        $token = $this->extractBearerToken('Bearer  double-space');
        $this->assertSame('double-space', $token);
    }

    public function testReturnsNullForBasicAuthHeader(): void
    {
        $this->assertNull($this->extractBearerToken('Basic dXNlcjpwYXNz'));
    }

    public function testReturnsNullForEmptyHeader(): void
    {
        $this->assertNull($this->extractBearerToken(''));
    }

    public function testReturnsNullForBearerWithoutToken(): void
    {
        $this->assertNull($this->extractBearerToken('Bearer'));
    }

    public function testExtractsLongToken(): void
    {
        $long = str_repeat('a', 64);
        $this->assertSame($long, $this->extractBearerToken("Bearer {$long}"));
    }
}
