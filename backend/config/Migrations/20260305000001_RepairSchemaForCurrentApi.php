<?php
declare(strict_types=1);

use Migrations\AbstractMigration;

class RepairSchemaForCurrentApi extends AbstractMigration
{
    public function change(): void
    {
        $this->ensureUsersTableColumns();
        $this->ensureMenusTableShape();
        $this->ensureRoomsAndBlocks();
        $this->ensureOrderQuantityTables();
        $this->ensureSupplierAndMenuMasterTables();
        $this->ensureCoopTables();
    }

    private function ensureUsersTableColumns(): void
    {
        if (!$this->hasTable('users')) {
            return;
        }

        $table = $this->table('users');

        if (!$table->hasColumn('login_id')) {
            $table->addColumn('login_id', 'string', [
                'limit' => 100,
                'null' => true,
                'default' => null,
                'after' => 'name',
            ])->update();
        }

        if (!$table->hasColumn('block_id')) {
            $table->addColumn('block_id', 'integer', [
                'null' => true,
                'default' => null,
                'after' => 'role',
            ])->update();
        }

        // 既存ユーザーにログインIDを補完
        $this->execute("
            UPDATE users
            SET login_id = CASE
                WHEN id = 1 THEN 'admin'
                WHEN id = 2 THEN 'user'
                WHEN email IS NOT NULL AND email <> '' THEN SUBSTRING_INDEX(email, '@', 1)
                ELSE CONCAT('user', id)
            END
            WHERE login_id IS NULL OR login_id = ''
        ");
    }

    private function ensureMenusTableShape(): void
    {
        if (!$this->hasTable('menus')) {
            $this->table('menus')
                ->addColumn('name', 'string', ['limit' => 100, 'null' => false])
                ->addColumn('menu_date', 'date', ['null' => false])
                ->addColumn('meal_type', 'integer', ['null' => false])
                ->addColumn('block_id', 'integer', ['null' => false, 'default' => 1])
                ->addColumn('grams_per_person', 'decimal', [
                    'precision' => 10,
                    'scale' => 2,
                    'null' => false,
                    'default' => 0,
                ])
                ->addColumn('created', 'datetime', ['null' => true])
                ->addColumn('modified', 'datetime', ['null' => true])
                ->addIndex(['menu_date', 'meal_type', 'block_id'], ['unique' => true])
                ->create();
            return;
        }

        $table = $this->table('menus');
        if (!$table->hasColumn('menu_date')) {
            $table->addColumn('menu_date', 'date', ['null' => true, 'default' => null, 'after' => 'name'])->update();
            if ($table->hasColumn('date')) {
                $this->execute("UPDATE menus SET menu_date = `date` WHERE menu_date IS NULL");
            }
        }
        if (!$table->hasColumn('block_id')) {
            $table->addColumn('block_id', 'integer', ['null' => false, 'default' => 1, 'after' => 'meal_type'])->update();
        }
        if (!$table->hasColumn('grams_per_person')) {
            $table->addColumn('grams_per_person', 'decimal', [
                'precision' => 10,
                'scale' => 2,
                'null' => false,
                'default' => 0,
                'after' => 'block_id',
            ])->update();
        }

        // 既存の enum meal_type を数値型運用へ寄せる
        $this->execute("
            UPDATE menus
            SET meal_type = CASE meal_type
                WHEN 'breakfast' THEN 1
                WHEN 'lunch' THEN 2
                WHEN 'dinner' THEN 3
                ELSE meal_type
            END
        ");
        $this->execute("ALTER TABLE menus MODIFY meal_type INT NOT NULL");
        $this->execute("ALTER TABLE menus MODIFY menu_date DATE NOT NULL");
        $this->execute("ALTER TABLE menus ADD INDEX idx_menus_menu_date_meal_block (menu_date, meal_type, block_id)");
    }

    private function ensureRoomsAndBlocks(): void
    {
        if (!$this->hasTable('rooms')) {
            $this->table('rooms')
                ->addColumn('name', 'string', ['limit' => 100, 'null' => false])
                ->addColumn('sort_order', 'integer', ['null' => false, 'default' => 0])
                ->addColumn('created', 'datetime', ['null' => true])
                ->addColumn('modified', 'datetime', ['null' => true])
                ->create();
        }

        if (!$this->hasTable('blocks')) {
            $this->table('blocks')
                ->addColumn('name', 'string', ['limit' => 100, 'null' => false])
                ->addColumn('room1_id', 'integer', ['null' => true, 'default' => null])
                ->addColumn('room2_id', 'integer', ['null' => true, 'default' => null])
                ->addColumn('sort_order', 'integer', ['null' => false, 'default' => 0])
                ->addColumn('created', 'datetime', ['null' => true])
                ->addColumn('modified', 'datetime', ['null' => true])
                ->create();
        }
    }

    private function ensureOrderQuantityTables(): void
    {
        if (!$this->hasTable('room_gram_settings')) {
            $this->table('room_gram_settings')
                ->addColumn('room_id', 'integer', ['null' => false])
                ->addColumn('meal_type', 'integer', ['null' => false])
                ->addColumn('grams_per_person', 'decimal', [
                    'precision' => 10,
                    'scale' => 2,
                    'null' => false,
                    'default' => 0,
                ])
                ->addColumn('created', 'datetime', ['null' => true])
                ->addColumn('modified', 'datetime', ['null' => true])
                ->addIndex(['room_id', 'meal_type'], ['unique' => true])
                ->create();
        }

        if (!$this->hasTable('block_order_quantities')) {
            $this->table('block_order_quantities')
                ->addColumn('order_date', 'date', ['null' => false])
                ->addColumn('block_id', 'integer', ['null' => false])
                ->addColumn('meal_type', 'integer', ['null' => false])
                ->addColumn('room1_kamaho_count', 'integer', ['null' => false, 'default' => 0])
                ->addColumn('room2_kamaho_count', 'integer', ['null' => false, 'default' => 0])
                ->addColumn('order_quantity', 'integer', ['null' => false, 'default' => 0])
                ->addColumn('notes', 'string', ['limit' => 255, 'null' => true, 'default' => null])
                ->addColumn('created', 'datetime', ['null' => true])
                ->addColumn('modified', 'datetime', ['null' => true])
                ->addIndex(['order_date', 'block_id', 'meal_type'], ['unique' => true])
                ->create();
        }
    }

    private function ensureSupplierAndMenuMasterTables(): void
    {
        if (!$this->hasTable('suppliers')) {
            $this->table('suppliers')
                ->addColumn('name', 'string', ['limit' => 100, 'null' => false])
                ->addColumn('code', 'string', ['limit' => 20, 'null' => true, 'default' => null])
                ->addColumn('has_order_sheet', 'boolean', ['null' => false, 'default' => 1])
                ->addColumn('delivery_days', 'string', ['limit' => 100, 'null' => false, 'default' => ''])
                ->addColumn('order_day', 'integer', ['null' => true, 'default' => null])
                ->addColumn('delivery_lead_weeks', 'integer', ['null' => false, 'default' => 0])
                ->addColumn('file_ext', 'string', ['limit' => 10, 'null' => false, 'default' => 'xlsx'])
                ->addColumn('notes', 'text', ['null' => true, 'default' => null])
                ->addColumn('created', 'datetime', ['null' => true])
                ->addColumn('modified', 'datetime', ['null' => true])
                ->create();
        } else {
            $table = $this->table('suppliers');
            if (!$table->hasColumn('code')) {
                $table->addColumn('code', 'string', ['limit' => 20, 'null' => true, 'default' => null, 'after' => 'name'])->update();
            }
            if (!$table->hasColumn('has_order_sheet')) {
                $table->addColumn('has_order_sheet', 'boolean', ['null' => false, 'default' => 1, 'after' => 'code'])->update();
            }
            if (!$table->hasColumn('delivery_days')) {
                $table->addColumn('delivery_days', 'string', ['limit' => 100, 'null' => false, 'default' => '', 'after' => 'has_order_sheet'])->update();
            }
            if (!$table->hasColumn('file_ext')) {
                $table->addColumn('file_ext', 'string', ['limit' => 10, 'null' => false, 'default' => 'xlsx', 'after' => 'delivery_lead_weeks'])->update();
            }
            if (!$table->hasColumn('notes')) {
                $table->addColumn('notes', 'text', ['null' => true, 'default' => null, 'after' => 'file_ext'])->update();
            }
        }

        if (!$this->hasTable('menu_masters')) {
            $this->table('menu_masters')
                ->addColumn('name', 'string', ['limit' => 100, 'null' => false])
                ->addColumn('block_id', 'integer', ['null' => true, 'default' => null])
                ->addColumn('grams_per_person', 'decimal', [
                    'precision' => 10,
                    'scale' => 2,
                    'null' => false,
                    'default' => 0,
                ])
                ->addColumn('memo', 'text', ['null' => true, 'default' => null])
                ->addColumn('created', 'datetime', ['null' => true])
                ->addColumn('modified', 'datetime', ['null' => true])
                ->addIndex(['name'])
                ->create();
        }

        if (!$this->hasTable('menu_ingredients')) {
            $this->table('menu_ingredients')
                ->addColumn('menu_master_id', 'integer', ['null' => false])
                ->addColumn('name', 'string', ['limit' => 100, 'null' => false])
                ->addColumn('amount', 'decimal', [
                    'precision' => 10,
                    'scale' => 2,
                    'null' => false,
                    'default' => 0,
                ])
                ->addColumn('unit', 'string', ['limit' => 20, 'null' => false, 'default' => 'g'])
                ->addColumn('persons_per_unit', 'integer', ['null' => true, 'default' => null])
                ->addColumn('supplier_id', 'integer', ['null' => true, 'default' => null])
                ->addColumn('sort_order', 'integer', ['null' => false, 'default' => 0])
                ->addColumn('created', 'datetime', ['null' => true])
                ->addColumn('modified', 'datetime', ['null' => true])
                ->addIndex(['menu_master_id'])
                ->addIndex(['supplier_id'])
                ->create();
        }
    }

    private function ensureCoopTables(): void
    {
        if (!$this->hasTable('coop_items')) {
            $this->table('coop_items')
                ->addColumn('name', 'string', ['limit' => 100, 'null' => false])
                ->addColumn('unit', 'string', ['limit' => 20, 'null' => false, 'default' => '個'])
                ->addColumn('order_type', 'enum', [
                    'values' => ['weekly', 'daily'],
                    'default' => 'weekly',
                    'null' => false,
                ])
                ->addColumn('sort_order', 'integer', ['null' => false, 'default' => 0])
                ->addColumn('created', 'datetime', ['null' => true])
                ->addColumn('modified', 'datetime', ['null' => true])
                ->create();
        }

        if (!$this->hasTable('coop_orders')) {
            $this->table('coop_orders')
                ->addColumn('week_start', 'date', ['null' => false])
                ->addColumn('item_id', 'integer', ['null' => false])
                ->addColumn('order_date', 'date', ['null' => true, 'default' => null])
                ->addColumn('order_date_norm', 'date', [
                    'null' => false,
                    'update' => 'GENERATED ALWAYS AS (COALESCE(order_date, \'1000-01-01\')) STORED'
                ])
                ->addColumn('quantity', 'integer', ['null' => false, 'default' => 0])
                ->addColumn('notes', 'string', ['limit' => 255, 'null' => true, 'default' => null])
                ->addColumn('created', 'datetime', ['null' => true])
                ->addColumn('modified', 'datetime', ['null' => true])
                ->addIndex(['week_start', 'item_id', 'order_date_norm'], ['unique' => true, 'name' => 'uniq_week_item_date'])
                ->addIndex(['week_start'], ['name' => 'idx_coop_orders_week_start'])
                ->addIndex(['item_id'], ['name' => 'idx_coop_orders_item_id'])
                ->create();
        }
    }
}