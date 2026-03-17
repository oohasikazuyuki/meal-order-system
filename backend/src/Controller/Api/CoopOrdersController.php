<?php
namespace App\Controller\Api;

use App\Controller\AppController;
use DateTime;

/**
 * 生協発注 API
 *
 * GET  /api/coop-orders.json?week_start=YYYY-MM-DD
 *   → 週のアイテム一覧と発注数量を返す
 *
 * POST /api/coop-orders.json
 *   { week_start, items: [{ item_id, quantity, notes?, daily?: {date: qty} }] }
 *   → 保存
 *
 * GET  /api/coop-orders/items.json
 *   → アイテムマスタ一覧
 */
class CoopOrdersController extends AppController
{
    public function initialize(): void
    {
        parent::initialize();
        $this->CoopItems = $this->fetchTable('CoopItems');
    }

    /** GET /api/coop-orders/items.json */
    public function items(): void
    {
        $rows = $this->CoopItems->find()->orderBy(['sort_order' => 'ASC'])->toArray();

        $this->set(['ok' => true, 'items' => $rows]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'items']);
    }

    /**
     * GET /api/coop-orders.json?week_start=YYYY-MM-DD
     * 週のアイテム一覧 + 保存済み数量を返す
     */
    public function index(): void
    {
        // ルーティング差異で POST が index に到達した場合の後方互換
        if ($this->request->is('post')) {
            $this->add();
            return;
        }

        $weekStartStr = $this->request->getQuery('week_start');
        if (!$weekStartStr || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $weekStartStr)) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'message' => 'week_start は必須です (YYYY-MM-DD)']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        $weekStart = new DateTime($weekStartStr);
        $weekEnd   = (clone $weekStart)->modify('+6 days');

        // アイテムマスタ
        $itemRows = $this->CoopItems->find()->orderBy(['sort_order' => 'ASC'])->toArray();

        // 保存済み発注データ
        $conn   = $this->CoopItems->getConnection();
        $orders = $conn->execute(
            "SELECT item_id, order_date, quantity, notes
             FROM coop_orders
             WHERE week_start = :ws",
            ['ws' => $weekStartStr]
        )->fetchAll('assoc');

        // item_id => [order_date => {quantity, notes}]
        $orderMap = [];
        foreach ($orders as $o) {
            $key               = $o['order_date'] ?? 'weekly';
            $orderMap[(int)$o['item_id']][$key] = [
                'quantity' => (int)$o['quantity'],
                'notes'    => $o['notes'] ?? '',
            ];
        }

        // レスポンス組み立て
        $result = [];
        foreach ($itemRows as $item) {
            $row = [
                'id'         => $item->id,
                'name'       => $item->name,
                'unit'       => $item->unit,
                'order_type' => $item->order_type,
                'sort_order' => $item->sort_order,
            ];

            if ($item->order_type === 'weekly') {
                $saved           = $orderMap[$item->id]['weekly'] ?? null;
                $row['quantity'] = $saved ? $saved['quantity'] : 0;
                $row['notes']    = $saved ? $saved['notes']    : '';
            } else {
                // daily: 月〜日の7日分
                $daily = [];
                for ($i = 0; $i < 7; $i++) {
                    $dateStr        = (clone $weekStart)->modify("+{$i} days")->format('Y-m-d');
                    $saved          = $orderMap[$item->id][$dateStr] ?? null;
                    $daily[$dateStr] = $saved ? $saved['quantity'] : 0;
                }
                $row['daily'] = $daily;
            }

            $result[] = $row;
        }

        $this->set([
            'ok'         => true,
            'week_start' => $weekStartStr,
            'week_end'   => $weekEnd->format('Y-m-d'),
            'items'      => $result,
        ]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'week_start', 'week_end', 'items']);
    }

    /**
     * POST /api/coop-orders.json
     * { week_start, items: [{item_id, quantity?, notes?, daily?:{date:qty}}] }
     */
    public function add(): void
    {
        $data      = $this->request->getData();
        $weekStart = $data['week_start'] ?? '';
        $items     = $data['items'] ?? [];

        if (!$weekStart || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $weekStart)) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'message' => 'week_start は必須です']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        $conn  = $this->CoopItems->getConnection();
        $saved = 0;

        foreach ((array)$items as $item) {
            $itemId = (int)($item['item_id'] ?? 0);
            if (!$itemId) continue;

            if (!empty($item['daily']) && is_array($item['daily'])) {
                // 日別保存
                foreach ($item['daily'] as $date => $qty) {
                    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$date)) continue;
                    $conn->execute(
                        "INSERT INTO coop_orders (week_start, item_id, order_date, quantity)
                         VALUES (:ws, :iid, :od, :qty)
                         ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), modified = NOW()",
                        ['ws' => $weekStart, 'iid' => $itemId, 'od' => $date, 'qty' => (int)$qty]
                    );
                    $saved++;
                }
            } else {
                // 週次保存
                $qty   = (int)($item['quantity'] ?? 0);
                $notes = (string)($item['notes'] ?? '');
                $conn->execute(
                    "INSERT INTO coop_orders (week_start, item_id, order_date, quantity, notes)
                     VALUES (:ws, :iid, NULL, :qty, :notes)
                     ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), notes = VALUES(notes), modified = NOW()",
                    ['ws' => $weekStart, 'iid' => $itemId, 'qty' => $qty, 'notes' => $notes]
                );
                $saved++;
            }
        }

        $this->set(['ok' => true, 'saved' => $saved]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'saved']);
    }
}
