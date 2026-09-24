<?php
declare(strict_types=1);

use Migrations\AbstractMigration;

class SeedSupplierAndCoopDefaults extends AbstractMigration
{
    public function up(): void
    {
        $this->seedSuppliers();
        $this->seedCoopItems();
    }

    public function down(): void
    {
        // 運用投入データのためロールバックしない
    }

    private function seedSuppliers(): void
    {
        if (!$this->hasTable('suppliers')) {
            return;
        }

        $suppliers = $this->table('suppliers');
        $now = date('Y-m-d H:i:s');

        // 魚屋: 火曜発注 -> 翌週の水・金納品
        $exists = $this->fetchRow("SELECT id FROM suppliers WHERE name = '魚屋' LIMIT 1");
        if (!$exists) {
            $suppliers->insert([
                'name' => '魚屋',
                'code' => 'F',
                'has_order_sheet' => 1,
                'delivery_days' => '2,4',
                'order_day' => 1,
                'delivery_lead_weeks' => 1,
                'file_ext' => 'xlsx',
                'notes' => '火曜発注・翌週水金納品',
                'created' => $now,
                'modified' => $now,
            ])->save();
        }

        // 肉屋: 火曜発注 -> 今週金 + 翌週月火木納品（パイプ形式）
        $exists = $this->fetchRow("SELECT id FROM suppliers WHERE name = '肉屋' LIMIT 1");
        if (!$exists) {
            $suppliers->insert([
                'name' => '肉屋',
                'code' => 'M',
                'has_order_sheet' => 1,
                'delivery_days' => '4|0,1,3',
                'order_day' => 1,
                'delivery_lead_weeks' => 0,
                'file_ext' => 'xlsx',
                'notes' => '火曜発注・今週金/翌週月火木納品',
                'created' => $now,
                'modified' => $now,
            ])->save();
        }

        // 八百屋: 火曜発注 -> 今週金土 + 翌週月火木納品（パイプ形式）
        $exists = $this->fetchRow("SELECT id FROM suppliers WHERE name = '八百屋' LIMIT 1");
        if (!$exists) {
            $suppliers->insert([
                'name' => '八百屋',
                'code' => 'Y',
                'has_order_sheet' => 1,
                'delivery_days' => '4,5|0,1,3',
                'order_day' => 1,
                'delivery_lead_weeks' => 0,
                'file_ext' => 'xlsx',
                'notes' => '火曜発注・今週金土/翌週月火木納品',
                'created' => $now,
                'modified' => $now,
            ])->save();
        }

        // 生協: 発注書と非連動
        $exists = $this->fetchRow("SELECT id FROM suppliers WHERE name = '生協' LIMIT 1");
        if (!$exists) {
            $suppliers->insert([
                'name' => '生協',
                'code' => 'C',
                'has_order_sheet' => 0,
                'delivery_days' => '',
                'order_day' => null,
                'delivery_lead_weeks' => 0,
                'file_ext' => 'xlsx',
                'notes' => '発注書とは連動しない（生協発注画面で管理）',
                'created' => $now,
                'modified' => $now,
            ])->save();
        }

        // 在庫業者（既存ロジックで code='Z' を使用）
        $exists = $this->fetchRow("SELECT id FROM suppliers WHERE code = 'Z' LIMIT 1");
        if (!$exists) {
            $suppliers->insert([
                'name' => '在庫',
                'code' => 'Z',
                'has_order_sheet' => 0,
                'delivery_days' => '',
                'order_day' => null,
                'delivery_lead_weeks' => 0,
                'file_ext' => 'xlsx',
                'notes' => '在庫食材計算用（発注書非連動）',
                'created' => $now,
                'modified' => $now,
            ])->save();
        }
    }

    private function seedCoopItems(): void
    {
        if (!$this->hasTable('coop_items')) {
            return;
        }

        $coopItems = $this->table('coop_items');
        $now = date('Y-m-d H:i:s');

        // 週次発注（余剰を見込んで一括発注）
        $exists = $this->fetchRow("SELECT id FROM coop_items WHERE name = '卵' LIMIT 1");
        if (!$exists) {
            $coopItems->insert([
                'name' => '卵',
                'unit' => 'パック',
                'order_type' => 'weekly',
                'sort_order' => 10,
                'created' => $now,
                'modified' => $now,
            ])->save();
        }

        if (!$this->fetchRow("SELECT id FROM coop_items WHERE name = '牛乳' LIMIT 1")) {
            $coopItems->insert([
                'name' => '牛乳',
                'unit' => '本',
                'order_type' => 'weekly',
                'sort_order' => 20,
                'created' => $now,
                'modified' => $now,
            ])->save();
        }

        // 日別個数指定
        if (!$this->fetchRow("SELECT id FROM coop_items WHERE name = '冷凍チャーハン' LIMIT 1")) {
            $coopItems->insert([
                'name' => '冷凍チャーハン',
                'unit' => '袋',
                'order_type' => 'daily',
                'sort_order' => 30,
                'created' => $now,
                'modified' => $now,
            ])->save();
        }
    }
}