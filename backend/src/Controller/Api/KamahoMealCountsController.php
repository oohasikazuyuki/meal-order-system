<?php
namespace App\Controller\Api;

use App\Controller\AppController;
use App\Service\KamahoApiService;

/**
 * kamaho-shokusu.jp から食数を取得するプロキシエンドポイント
 *
 * GET /api/kamaho-meal-counts.json?date=YYYY-MM-DD
 *   → 指定日の食事種別ごとの合計食数を返す
 *   → {"ok": true, "date": "...", "counts": {"1": 5, "2": 10, "3": 8, "4": 3}}
 */
class KamahoMealCountsController extends AppController
{

    /** GET /api/kamaho-meal-counts.json */
    public function index(): void
    {
        $date = $this->request->getQuery('date', date('Y-m-d'));

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'message' => 'date パラメータが不正です（YYYY-MM-DD）']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        try {
            $service = new KamahoApiService();
            $counts  = $service->getMealCountsByDate($date);

            $this->set([
                'ok'     => true,
                'date'   => $date,
                'counts' => $counts,
            ]);
            $this->viewBuilder()->setOption('serialize', ['ok', 'date', 'counts']);
        } catch (\Throwable $e) {
            $this->response = $this->response->withStatus(502);
            $this->set([
                'ok'      => false,
                'message' => 'kamaho からのデータ取得に失敗しました: ' . $e->getMessage(),
            ]);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
        }
    }
}
