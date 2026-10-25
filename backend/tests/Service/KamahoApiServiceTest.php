<?php
declare(strict_types=1);

namespace App\Test\Service;

use App\Service\KamahoApiService;
use PHPUnit\Framework\TestCase;

/**
 * kamaho の予約食数 API の応答を、日付 => 部屋ID => 食事種別 => 食数 に組み直す部分のテスト
 */
class KamahoApiServiceTest extends TestCase
{
    public function testParsesRoomsAndCounts(): void
    {
        $body = json_encode(['ok' => true, 'data' => [
            'rooms' => [['room_id' => 1, 'room_name' => 'ナザレの家'], ['room_id' => 2, 'room_name' => '空き部屋']],
            'items' => [
                ['date' => '2026-10-26', 'room_id' => 1, 'room_name' => 'ナザレの家', 'meal_type' => 1, 'count' => 5],
                ['date' => '2026-10-26', 'room_id' => 1, 'room_name' => 'ナザレの家', 'meal_type' => 3, 'count' => 4],
                ['date' => '2026-10-27', 'room_id' => 3, 'room_name' => '削除済み', 'meal_type' => 2, 'count' => 2],
            ],
        ]]);

        $result = KamahoApiService::parseMealCounts((string)$body, 200);

        $this->assertSame([1 => 'ナザレの家', 2 => '空き部屋', 3 => '削除済み'], $result['rooms']);
        $this->assertSame([
            '2026-10-26' => [1 => [1 => 5, 3 => 4]],
            '2026-10-27' => [3 => [2 => 2]],
        ], $result['counts']);
    }

    public function testIgnoresUnknownMealType(): void
    {
        $body = json_encode(['ok' => true, 'data' => ['rooms' => [], 'items' => [
            ['date' => '2026-10-26', 'room_id' => 1, 'room_name' => 'A', 'meal_type' => 9, 'count' => 5],
        ]]]);

        $this->assertSame([], KamahoApiService::parseMealCounts((string)$body, 200)['counts']);
    }

    /** 失敗を0で埋めると、0のまま発注されてしまう */
    public function testThrowsInsteadOfReturningZeros(): void
    {
        $this->expectException(\RuntimeException::class);
        KamahoApiService::parseMealCounts('{"ok":false,"message":"bad"}', 400);
    }

    public function testThrowsOnHtml(): void
    {
        $this->expectException(\RuntimeException::class);
        KamahoApiService::parseMealCounts('<html>login</html>', 200);
    }
}
