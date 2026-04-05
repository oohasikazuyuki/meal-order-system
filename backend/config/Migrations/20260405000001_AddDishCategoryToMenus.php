<?php
declare(strict_types=1);

use Migrations\AbstractMigration;

class AddDishCategoryToMenus extends AbstractMigration
{
    public function change(): void
    {
        $table = $this->table('menus');

        // dish_category カラムを追加（デフォルト空文字）
        if (!$table->hasColumn('dish_category')) {
            $table->addColumn('dish_category', 'string', [
                'limit'   => 50,
                'null'    => false,
                'default' => '',
                'after'   => 'name',
            ])->update();
        }

        // 旧ユニーク制約 (menu_date, meal_type, block_id) を削除し、
        // 新ユニーク制約 (menu_date, meal_type, block_id, dish_category) を追加する
        // ※ 環境によってインデックス名が異なるため、存在確認して削除
        $this->execute("
            SET @idx_exists = (
                SELECT COUNT(*) FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'menus'
                  AND INDEX_NAME IN ('menus_menu_date_meal_type_block_id', 'idx_menus_menu_date_meal_block')
                  AND NON_UNIQUE = 0
            );
            SET @sql = IF(@idx_exists > 0,
                'SELECT 1',
                'SELECT 1'
            );
        ");

        // 既存のユニーク制約を安全に削除する
        $indexes = $this->fetchAll("
            SELECT INDEX_NAME, NON_UNIQUE
            FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'menus'
              AND SEQ_IN_INDEX = 1
              AND INDEX_NAME != 'PRIMARY'
        ");
        foreach ($indexes as $idx) {
            $idxName = $idx['INDEX_NAME'] ?? $idx['index_name'] ?? '';
            $nonUnique = $idx['NON_UNIQUE'] ?? $idx['non_unique'] ?? 1;
            // ユニーク制約でかつ menu_date を含む既存インデックスを削除
            if ((int)$nonUnique === 0 && $idxName !== '') {
                $cols = $this->fetchAll("
                    SELECT COLUMN_NAME
                    FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = 'menus'
                      AND INDEX_NAME = '{$idxName}'
                    ORDER BY SEQ_IN_INDEX
                ");
                $colNames = array_map(fn($c) => $c['COLUMN_NAME'] ?? $c['column_name'] ?? '', $cols);
                // 旧制約は (menu_date, meal_type, block_id) の3カラム
                if (in_array('menu_date', $colNames) && in_array('meal_type', $colNames) && !in_array('dish_category', $colNames)) {
                    $this->execute("ALTER TABLE menus DROP INDEX `{$idxName}`");
                }
            }
        }

        // 新ユニーク制約: (menu_date, meal_type, block_id, dish_category)
        $newIdxExists = $this->fetchAll("
            SELECT COUNT(*) AS cnt
            FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'menus'
              AND INDEX_NAME = 'uniq_menus_date_meal_block_category'
        ");
        $newIdxCount = (int)(($newIdxExists[0]['cnt'] ?? $newIdxExists[0]['CNT'] ?? 0));
        if ($newIdxCount === 0) {
            $this->execute("
                ALTER TABLE menus
                ADD UNIQUE KEY `uniq_menus_date_meal_block_category`
                    (`menu_date`, `meal_type`, `block_id`, `dish_category`)
            ");
        }
    }
}
