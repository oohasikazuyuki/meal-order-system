<?php
namespace App\Service;

use Cake\Log\Log;

/**
 * 食数管理システム（kamaho）の予約食数 API を呼ぶ。
 *
 *   GET {KAMAHO_BASE_URL}/api/meal-counts?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   Authorization: Bearer {KAMAHO_API_TOKEN}
 *     → {"ok":true,"data":{
 *          "rooms":[{"room_id":1,"room_name":"..."}],
 *          "items":[{"date":"...","room_id":1,"room_name":"...","meal_type":1,"count":5}]}}
 *
 * 食数は kamaho 側で ReservationDatePolicy に沿って数えたもの（画面の集計と同じ）。
 * 期間ごと1回で取れるので、ログインも部屋ごとの問い合わせも要らない。
 *
 * 失敗は0で埋めずに RuntimeException を投げる。0のまま発注されるのを防ぐため。
 */
class KamahoApiService
{
    private string $baseUrl;
    private string $token;

    public function __construct()
    {
        $this->baseUrl = rtrim((string)(getenv('KAMAHO_BASE_URL') ?: 'https://kamaho-shokusu.jp'), '/');
        $this->token   = (string)(getenv('KAMAHO_API_TOKEN') ?: '');
    }

    /**
     * @return array{rooms: array<int, string>, counts: array<string, array<int, array<int, int>>>}
     *   rooms:  kamaho の部屋ID => 部屋名
     *   counts: 日付 => kamaho の部屋ID => 食事種別(1=朝 2=昼 3=夕 4=弁当) => 食数
     */
    public function fetchMealCounts(string $from, string $to): array
    {
        if ($this->token === '') {
            throw new \RuntimeException('KAMAHO_API_TOKEN が設定されていません');
        }

        $url = $this->baseUrl . '/api/meal-counts?' . http_build_query(['from' => $from, 'to' => $to]);
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $this->token, 'Accept: application/json'],
        ]);
        $body = curl_exec($ch);
        $errno = curl_errno($ch);
        $error = curl_error($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($errno !== 0) {
            Log::error(sprintf('KamahoApiService: curl error %d: %s', $errno, $error));
            throw new \RuntimeException('食数管理システムに接続できませんでした');
        }
        if ($status === 401) {
            throw new \RuntimeException('食数管理システムの API トークンが正しくありません');
        }

        return self::parseMealCounts((string)$body, $status);
    }

    /**
     * kamaho の部屋一覧（今日の分だけ問い合わせる）
     *
     * @return array<int, string> kamaho の部屋ID => 部屋名
     */
    public function getRooms(): array
    {
        $today = date('Y-m-d');
        return $this->fetchMealCounts($today, $today)['rooms'];
    }

    /**
     * 指定日の全部屋合計
     *
     * @return array<int, int> 食事種別 => 食数
     */
    public function getMealCountsByDate(string $date): array
    {
        $totals = [1 => 0, 2 => 0, 3 => 0, 4 => 0];
        foreach ($this->fetchMealCounts($date, $date)['counts'][$date] ?? [] as $byMeal) {
            foreach ($byMeal as $mt => $n) {
                $totals[$mt] += $n;
            }
        }
        return $totals;
    }

    /**
     * API の応答を rooms / counts に組み直す（通信なしで検証できるよう分けてある）
     *
     * @return array{rooms: array<int, string>, counts: array<string, array<int, array<int, int>>>}
     */
    public static function parseMealCounts(string $body, int $status): array
    {
        $json = json_decode($body, true);
        if ($status !== 200 || !is_array($json) || empty($json['ok'])) {
            Log::error(sprintf('KamahoApiService: HTTP %d: %s', $status, substr($body, 0, 200)));
            throw new \RuntimeException(sprintf('食数管理システムから食数を取得できませんでした (HTTP %d)', $status));
        }

        $rooms = [];
        foreach ($json['data']['rooms'] ?? [] as $r) {
            $rooms[(int)$r['room_id']] = (string)$r['room_name'];
        }
        $counts = [];
        foreach ($json['data']['items'] ?? [] as $i) {
            $mt = (int)$i['meal_type'];
            if (!in_array($mt, [1, 2, 3, 4], true)) {
                continue;
            }
            $counts[(string)$i['date']][(int)$i['room_id']][$mt] = (int)$i['count'];
            $rooms[(int)$i['room_id']] ??= (string)$i['room_name'];
        }

        return ['rooms' => $rooms, 'counts' => $counts];
    }
}
