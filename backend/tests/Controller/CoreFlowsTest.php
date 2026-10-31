<?php
declare(strict_types=1);

namespace App\Test\Controller;

use App\Service\AuthService;
use Cake\Database\Connection;
use Cake\Datasource\ConnectionManager;
use Cake\TestSuite\IntegrationTestTrait;
use Cake\TestSuite\TestCase;
use DateTimeImmutable;
use Migrations\TestSuite\Migrator;

/**
 * 発注の中心になる流れを、実際のDBとAPIを通して確かめる。
 *
 * 入力した発注数（block_order_quantities.order_quantity）が
 *   - そのまま保存・上書きされること
 *   - 発注書の数量・献立表の数量の元になること
 *   - 1人あたり量 × 人数 の計算が合っていること
 * のどれかが崩れると、仕入先に間違った数が届く。
 *
 * テスト用DB（DB_NAME + '_test'）が必要。各テストはトランザクション内で動かし最後に戻す。
 */
class CoreFlowsTest extends TestCase
{
    use IntegrationTestTrait;

    private static bool $migrated = false;

    private Connection $conn;
    private string $token;

    protected function setUp(): void
    {
        parent::setUp();
        if (!self::$migrated) {
            (new Migrator())->run();
            self::$migrated = true;
        }
        $this->conn = ConnectionManager::get('test');
        $this->conn->begin();

        // ログインと同じ手順でトークンを得る（全APIに認証がかかっても通るように）
        $this->insert('users', [
            'name' => 'テスト', 'email' => 't@example.com', 'login_id' => 'core-flows',
            'password' => password_hash('pass1234', PASSWORD_DEFAULT), 'role' => 'admin',
        ]);
        $this->token = (new AuthService())->login('core-flows', 'pass1234')['token'];
    }

    protected function tearDown(): void
    {
        $this->conn->rollback();
        parent::tearDown();
    }

    // ── 発注数の保存 ────────────────────────────────────────────

    public function testSavingTwiceOverwritesTheSameCell(): void
    {
        $blockId = $this->insert('blocks', ['name' => 'Aブロック']);

        $this->postJson('/api/block-order-quantities.json', [
            'order_date' => '2030-01-07',
            'items' => [['block_id' => $blockId, 'meal_type' => 2, 'order_quantity' => 10]],
        ]);
        $this->assertResponseOk();
        $this->postJson('/api/block-order-quantities.json', [
            'order_date' => '2030-01-07',
            'items' => [['block_id' => $blockId, 'meal_type' => 2, 'order_quantity' => 12, 'notes' => '追加']],
        ]);
        $this->assertResponseOk();

        $rows = $this->conn->execute(
            'SELECT order_quantity, notes FROM block_order_quantities WHERE block_id = ?',
            [$blockId]
        )->fetchAll('assoc');
        $this->assertSame([['order_quantity' => 12, 'notes' => '追加']], $this->intify($rows, 'order_quantity'));
    }

    /** 画面の「合計グラム」= 人数 × 献立の1人あたりグラム。人数は保存済みの部屋別食数から */
    public function testIndexComputesTotalGramsFromSavedCounts(): void
    {
        $blockId = $this->insert('blocks', ['name' => 'Aブロック']);
        $this->insert('menus', [
            'name' => 'カレー', 'menu_date' => '2030-01-07', 'date' => '2030-01-07', 'meal_type' => 3,
            'block_id' => $blockId, 'grams_per_person' => 250.5,
        ]);
        // 4食分すべて保存しておくと kamaho には問い合わせない
        foreach ([1, 2, 3, 4] as $mt) {
            $this->insert('block_order_quantities', [
                'order_date' => '2030-01-07', 'block_id' => $blockId, 'meal_type' => $mt,
                'room1_kamaho_count' => 3, 'room2_kamaho_count' => 4, 'order_quantity' => 9,
            ]);
        }

        $this->apiGet('/api/block-order-quantities.json?date=2030-01-07');
        $this->assertResponseOk();
        $dinner = json_decode((string)$this->_response->getBody(), true)['blocks'][0]['quantities'][2];

        $this->assertSame(7, $dinner['total_kamaho_count']);
        $this->assertEqualsWithDelta(7 * 250.5, $dinner['total_grams'], 0.001);
        $this->assertSame(9, $dinner['order_quantity']);
    }

    // ── 発注書・献立表の数量 ────────────────────────────────────

    /**
     * 2ブロックが同じ献立を出す日。発注書は order_quantity を合計して
     * 「1人あたり量 × 人数」、「N人で1本」は合計人数から切り上げる。
     * 部屋別食数（room*_kamaho_count）は使わない。
     */
    public function testOrderSheetQuantitiesComeFromOrderQuantity(): void
    {
        $monday = $this->futureMonday();
        $supplierId = $this->seedSharedMenu($monday);

        $this->apiGet('/api/order-sheets/calculate.json?week_start=' . $monday);
        $this->assertResponseOk();
        $body = json_decode((string)$this->_response->getBody(), true);
        $mine = array_values(array_filter($body['suppliers'], fn($s) => $s['supplier_id'] === $supplierId));

        $this->assertSame([
            ['name' => 'たまねぎ', 'amount' => 2750.0, 'unit' => 'g'],  // 50g × (25+30)
            ['name' => 'ルウ', 'amount' => 3.0, 'unit' => '箱'],         // ceil(55/20)。ブロック別に切り上げると4
        ], $this->numify($mine[0]['days'][$monday]));
    }

    /** 献立表も同じ数字を出す（発注書と1つでもずれると現場で気づかれない） */
    public function testMenuTableShowsSameQuantitiesAsOrderSheet(): void
    {
        $monday = $this->futureMonday();
        $this->seedSharedMenu($monday);

        $this->apiGet('/api/menu-table.json?week_start=' . $monday);
        $this->assertResponseOk();
        $body = json_decode((string)$this->_response->getBody(), true);
        $curry = $body['days'][0]['meals'][3][0];

        $this->assertSame('カレー', $curry['menu_name']);
        $got = array_map(fn($i) => [$i['name'], (float)$i['amount'], $i['head_count']], $curry['ingredients']);
        $this->assertSame([['たまねぎ', 2750.0, 55], ['ルウ', 3.0, 55], ['豚肉', 4400.0, 55]], $got);
    }

    // ── helpers ────────────────────────────────────────────────

    /** 2ブロックが同じ日の夕食にカレーを出す。返り値は仕入先ID */
    private function seedSharedMenu(string $date): int
    {
        $supplierId = $this->insert('suppliers', ['name' => 'テスト業者', 'code' => 'T', 'delivery_days' => '0']);
        $otherId = $this->insert('suppliers', ['name' => '別業者', 'code' => 'U', 'delivery_days' => '0']);
        $mm = $this->insert('menu_masters', ['name' => 'カレー', 'block_id' => null]);
        $this->insert('menu_ingredients', [
            'menu_master_id' => $mm, 'name' => 'たまねぎ', 'amount' => 50, 'unit' => 'g', 'supplier_id' => $supplierId, 'sort_order' => 1,
        ]);
        $this->insert('menu_ingredients', [
            'menu_master_id' => $mm, 'name' => 'ルウ', 'amount' => 0, 'unit' => '箱', 'persons_per_unit' => 20,
            'supplier_id' => $supplierId, 'sort_order' => 2,
        ]);
        $this->insert('menu_ingredients', [
            'menu_master_id' => $mm, 'name' => '豚肉', 'amount' => 80, 'unit' => 'g', 'supplier_id' => $otherId, 'sort_order' => 3,
        ]);
        foreach (['Aブロック' => 25, 'Bブロック' => 30] as $name => $qty) {
            $blockId = $this->insert('blocks', ['name' => $name]);
            $this->insert('menus', ['name' => 'カレー', 'menu_date' => $date, 'date' => $date, 'meal_type' => 3, 'block_id' => $blockId]);
            $this->insert('block_order_quantities', [
                'order_date' => $date, 'block_id' => $blockId, 'meal_type' => 3,
                'room1_kamaho_count' => 99, 'room2_kamaho_count' => 99, 'order_quantity' => $qty,
            ]);
        }
        return $supplierId;
    }

    /** 発注書は今日より前の納品日を省くので、十分先の月曜を使う */
    private function futureMonday(): string
    {
        return (new DateTimeImmutable('monday this week'))->modify('+8 weeks')->format('Y-m-d');
    }

    private function insert(string $table, array $row): int
    {
        $this->conn->insert($table, $row);
        return (int)$this->conn->getDriver()->lastInsertId();
    }

    private function postJson(string $url, array $data): void
    {
        $this->authHeaders(['Content-Type' => 'application/json']);
        $this->post($url, json_encode($data));
    }

    private function apiGet(string $url): void
    {
        $this->authHeaders();
        $this->get($url);
    }

    private function authHeaders(array $extra = []): void
    {
        $this->configRequest(['headers' => ['Authorization' => 'Bearer ' . $this->token, 'Accept' => 'application/json'] + $extra]);
    }

    private function intify(array $rows, string $key): array
    {
        return array_map(fn($r) => [$key => (int)$r[$key]] + $r, $rows);
    }

    /** JSON の 2750 と 2750.0 を同じに扱う */
    private function numify(array $items): array
    {
        return array_map(fn($i) => ['name' => $i['name'], 'amount' => (float)$i['amount'], 'unit' => $i['unit']], $items);
    }
}
