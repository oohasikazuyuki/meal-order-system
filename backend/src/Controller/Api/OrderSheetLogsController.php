<?php
namespace App\Controller\Api;

use App\Controller\AppController;

class OrderSheetLogsController extends AppController
{
    public function initialize(): void
    {   
        
        parent::initialize();
        $this->Suppliers = $this->fetchTable('Suppliers');
    }

    /**
     * GET /api/order-sheet-logs.json
     * 発注書発行履歴を取得（管理者のみ）
     */
    public function index(): void
    {
        $page = (int)($this->request->getQuery('page') ?? 1);
        $limit = (int)($this->request->getQuery('limit') ?? 50);
        $limit = min($limit, 100); // 最大100件
        
        $conn = $this->Suppliers->getConnection();
        $this->orderSheetLogs = $this->fetchTable('OrderSheetLogs');
        
        // 総件数を取得
        $totalCount = orderSheetLogs->find()->count();
        
        // ログを取得（JOINでユーザー名・業者名も取得）
        $offset = ($page - 1) * $limit;
        $logs = $this->orderSheetLogs
            ->find()
            ->select([
                'id' => 'OrderSheetLogs.id',
                'user_id' => 'OrderSheetLogs.user_id',
                'user_login_id' => 'Users.login_id',
                'user_name' => 'Users.name',
                'supplier_id' => 'OrderSheetLogs.supplier_id',
                'supplier_name' => 'Suppliers.name',
                'week_start' => 'OrderSheetLogs.week_start',
                'block_name' => 'OrderSheetLogs.block_name',
                'action' => 'OrderSheetLogs.action',
                'ip_address' => 'OrderSheetLogs.ip_address',
                'created' => 'OrderSheetLogs.created',
            ])
            ->leftJoinWith('Users')
            ->leftJoinWith('Suppliers')
            ->orderBy(['OrderSheetLogs.created' => 'DESC'])
            ->limit($limit)
            ->offset($offset)
            ->enableHydration(false)
            ->all()
            ->toList();
        $this->set([
            'ok' => true,
            'logs' => $logs,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => (int)$totalCount,
                'pages' => (int)ceil($totalCount / $limit),
            ],
        ]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'logs', 'pagination']);
    }
    
}