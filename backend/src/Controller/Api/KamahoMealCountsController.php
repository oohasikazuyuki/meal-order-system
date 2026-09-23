<?php
namespace App\Controller\Api;

use App\Controller\AppController;
use App\Service\KamahoApiService;
use App\Service\CredentialDecryptionException;
use App\Service\KamahoCredentialResolverService;

/**
 * kamaho-shokusu.jp から食数を取得するプロキシエンドポイント
 *
 * GET /api/kamaho-meal-counts.json?date=YYYY-MM-DD
 *   → 指定日の食事種別ごとの合計食数を返す
 *   → {"ok": true, "date": "...", "user": {...}, "counts": {"1": 5, "2": 10, "3": 8, "4": 3}}
 */
class KamahoMealCountsController extends AppController
{
    private KamahoCredentialResolverService $kamahoCredentialResolverService;

    public function initialize(): void
    {
        parent::initialize();
        $this->kamahoCredentialResolverService = new KamahoCredentialResolverService();
    }

    /** GET /api/kamaho-meal-counts.json */
    public function index(): void
    {
        $user = $this->requireAuthenticatedUser();
        if ($user === null) {
            return;
        }

        $date = $this->request->getQuery('date', date('Y-m-d'));

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'message' => 'date パラメータが不正です（YYYY-MM-DD）']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        try {
            $options = $this->kamahoCredentialResolverService->resolveKamahoOptions($this->request);
            $counts  = (new KamahoApiService($options))->getMealCountsByDate($date);

            $this->set([
                'ok'     => true,
                'date'   => $date,
                'user'   => $user,
                'counts' => $counts,
            ]);
            $this->viewBuilder()->setOption('serialize', ['ok', 'date', 'user', 'counts']);
        } catch (CredentialDecryptionException $e) {
            $this->response = $this->response->withStatus(409);
            $this->set([
                'ok' => false,
                'message' => '保存されている連携情報を読み取れませんでした。連携をやり直してください。',
            ]);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
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
