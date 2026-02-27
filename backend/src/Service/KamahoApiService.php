<?php
namespace App\Service;

use Cake\Log\Log;

/**
 * kamaho-shokusu.jp とのセッションベースAPI連携サービス
 *
 * 認証フロー:
 *   1. GET /MUserInfo/login でCSRFトークン取得
 *   2. POST /MUserInfo/login でセッション確立
 *   3. 以降のリクエストでCookieとCSRFトークンを引き継ぐ
 *
 * 実際のAPIレスポンス形式:
 *   GET /TReservationInfo/getAllRoomsMealCounts
 *     → {"ok":true,"data":{"result":[{"date":"YYYY-MM-DD","morning":N,"lunch":N,"dinner":N,"bento":N,"total":N}]}}
 *
 *   GET /TReservationInfo/getUsersByRoom/{roomId}?date=YYYY-MM-DD
 *     → {"ok":true,"data":{"usersByRoom":[{"id":N,"name":"...","morning":bool,"noon":bool,"night":bool,"bento":bool}]}}
 *
 *   GET /MRoomInfo/
 *     → HTML ページ（部屋一覧）
 */
class KamahoApiService
{
    private string $baseUrl;
    private string $loginAccount;
    private string $loginPassword;

    private mixed $ch = null;
    private string $cookieFile;
    private bool $loggedIn = false;

    /** キャッシュ: kamaho roomId => roomName */
    private ?array $roomsCache = null;

    public function __construct()
    {
        $this->baseUrl       = rtrim((string)(getenv('KAMAHO_BASE_URL') ?: 'https://kamaho-shokusu.jp'), '/');
        $this->loginAccount  = (string)(getenv('KAMAHO_LOGIN_ACCOUNT') ?: '');
        $this->loginPassword = (string)(getenv('KAMAHO_LOGIN_PASSWORD') ?: '');
        $this->cookieFile    = sys_get_temp_dir() . '/kamaho_cookie_' . getmypid() . '.txt';
    }

    /**
     * kamaho 上の全部屋を返す
     *
     * @return array<int, string> kamaho roomId => 部屋名
     */
    public function getRooms(): array
    {
        if ($this->roomsCache !== null) {
            return $this->roomsCache;
        }

        $this->ensureLoggedIn();

        $html = $this->get($this->baseUrl . '/MRoomInfo/');
        $rooms = $this->parseRoomsFromHtml($html);

        if (empty($rooms)) {
            Log::warning('KamahoApiService: getRooms() returned no rooms from MRoomInfo HTML');
        }

        $this->roomsCache = $rooms;
        return $rooms;
    }

    /**
     * 後方互換: 全施設の日付×食事種別の食数を取得する
     * ※ 実際のAPIは部屋別データを返さないため、部屋名 => [] のマップを返す
     *
     * @return array<string, array> 部屋名 => 空配列
     */
    public function getAllRoomsMealCounts(): array
    {
        $rooms = $this->getRooms();
        $result = [];
        foreach ($rooms as $roomName) {
            $result[$roomName] = [];
        }
        return $result;
    }

    /**
     * 指定日の部屋名別・食事種別別食数を返す
     * getUsersByRoom/{id}?date=YYYY-MM-DD を各部屋ごとに呼び出して集計する
     *
     * @param string $date YYYY-MM-DD
     * @return array<string, array<int, int>> 部屋名 => [meal_type => count]
     *   meal_type: 1=朝食, 2=昼食, 3=夕食, 4=弁当
     */
    public function getMealCountsByRoomForDate(string $date): array
    {
        $this->ensureLoggedIn();
        $rooms = $this->getRooms();
        $result = [];

        foreach ($rooms as $roomId => $roomName) {
            $url  = $this->baseUrl . "/TReservationInfo/getUsersByRoom/{$roomId}?date={$date}";
            $body = $this->get($url);
            $json = json_decode($body, true);

            if (json_last_error() !== JSON_ERROR_NONE || empty($json['ok'])) {
                Log::warning("KamahoApiService: getUsersByRoom/$roomId failed for $date");
                $result[$roomName] = [1 => 0, 2 => 0, 3 => 0, 4 => 0];
                continue;
            }

            $users = $json['data']['usersByRoom'] ?? [];
            $result[$roomName] = [
                1 => count(array_filter($users, fn($u) => !empty($u['morning']))),
                2 => count(array_filter($users, fn($u) => !empty($u['noon']))),
                3 => count(array_filter($users, fn($u) => !empty($u['night']))),
                4 => count(array_filter($users, fn($u) => !empty($u['bento']))),
            ];
        }

        return $result;
    }

    /**
     * 全施設の食数を日付で集計して返す
     * getAllRoomsMealCounts エンドポイントを使用（data.result 形式）
     *
     * @param string $date YYYY-MM-DD
     * @return array<int, int> meal_type => count (1=朝食, 2=昼食, 3=夕食, 4=弁当)
     */
    public function getMealCountsByDate(string $date): array
    {
        $this->ensureLoggedIn();

        $url  = $this->baseUrl . '/TReservationInfo/getAllRoomsMealCounts';
        $body = $this->get($url);

        $json = json_decode($body, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            Log::error('kamaho getMealCountsByDate: invalid JSON: ' . substr($body, 0, 200));
            return [1 => 0, 2 => 0, 3 => 0, 4 => 0];
        }

        if (empty($json['ok'])) {
            Log::error('kamaho getMealCountsByDate: ok=false: ' . ($json['message'] ?? ''));
            return [1 => 0, 2 => 0, 3 => 0, 4 => 0];
        }

        // レスポンス形式: {"ok":true,"data":{"result":[{"date":"...","morning":N,"lunch":N,"dinner":N,"bento":N}]}}
        $results = $json['data']['result'] ?? [];
        foreach ($results as $row) {
            if (($row['date'] ?? '') === $date) {
                return [
                    1 => (int)($row['morning'] ?? 0),
                    2 => (int)($row['lunch']   ?? 0),
                    3 => (int)($row['dinner']  ?? 0),
                    4 => (int)($row['bento']   ?? 0),
                ];
            }
        }

        // 当日データなし
        return [1 => 0, 2 => 0, 3 => 0, 4 => 0];
    }

    // -------------------------------------------------------
    // private helpers
    // -------------------------------------------------------

    private function ensureLoggedIn(): void
    {
        if ($this->loggedIn) {
            return;
        }
        $this->login();
    }

    private function login(): void
    {
        if (empty($this->loginAccount) || empty($this->loginPassword)) {
            throw new \RuntimeException(
                'KAMAHO_LOGIN_ACCOUNT / KAMAHO_LOGIN_PASSWORD が .env に設定されていません'
            );
        }

        $loginPageUrl = $this->baseUrl . '/MUserInfo/login';

        // 1. ログインページ取得 → CSRF トークン抽出
        $html = $this->get($loginPageUrl);
        if (empty(trim($html))) {
            throw new \RuntimeException(
                'kamaho ログインページの取得に失敗しました。' .
                'KAMAHO_BASE_URL (' . $this->baseUrl . ') を確認してください。'
            );
        }

        $csrfToken = $this->extractCsrfToken($html);

        // 2. ログイン POST
        $postData = http_build_query([
            '_csrfToken'      => $csrfToken,
            'c_login_account' => $this->loginAccount,
            'c_login_passwd'  => $this->loginPassword,
        ]);

        $responseBody = $this->post($loginPageUrl, $postData, $csrfToken);

        // ログインページが返ってきた場合は認証失敗
        if (
            str_contains($responseBody, 'c_login_account') &&
            str_contains($responseBody, 'name="_csrfToken"')
        ) {
            throw new \RuntimeException(
                'kamaho ログインに失敗しました。' .
                'アカウント名またはパスワードが正しくありません。'
            );
        }

        $this->loggedIn = true;
        Log::info('KamahoApiService: login succeeded for account=' . $this->loginAccount);
    }

    /**
     * MRoomInfo HTML から kamaho roomId => 部屋名 マップを生成する
     *
     * @return array<int, string>
     */
    private function parseRoomsFromHtml(string $html): array
    {
        $rooms = [];

        // <tr> 内のセルから ID と名前を抽出（テーブル行: 番号 | 部屋名 | ソート順）
        // 典型的なパターン: <td>1</td><td>ナザレの家</td><td>1</td>
        if (preg_match_all('/<tr[^>]*>(.*?)<\/tr>/s', $html, $rowMatches)) {
            foreach ($rowMatches[1] as $row) {
                preg_match_all('/<td[^>]*>(.*?)<\/td>/s', $row, $tdMatches);
                $cells = array_map('strip_tags', $tdMatches[1] ?? []);
                $cells = array_map('trim', $cells);
                $cells = array_values(array_filter($cells, fn($c) => $c !== ''));

                // 期待パターン: [id, 部屋名, sort_order] または [id, 部屋名]
                if (count($cells) >= 2 && ctype_digit($cells[0]) && !empty($cells[1])) {
                    $id   = (int)$cells[0];
                    $name = $cells[1];
                    // 数字のみの名前を除外（ヘッダー行など）
                    if ($id > 0 && !ctype_digit($name)) {
                        $rooms[$id] = $name;
                    }
                }
            }
        }

        // 上記で取得できない場合、インラインJSの __TRESP.currentRoom などを利用
        if (empty($rooms)) {
            // フォールバック: getUsersByRoom 1-20 を試して応答があるものを収集
            Log::warning('KamahoApiService: parseRoomsFromHtml failed, falling back to probe');
            for ($id = 1; $id <= 20; $id++) {
                $url  = $this->baseUrl . "/TReservationInfo/getUsersByRoom/{$id}";
                $body = $this->get($url);
                $json = json_decode($body, true);
                if (!empty($json['ok'])) {
                    // 部屋名は取得できないため、とりあえず ID を名前とする
                    $rooms[$id] = "部屋{$id}";
                } else {
                    break;
                }
            }
        }

        return $rooms;
    }

    private function extractCsrfToken(string $html): string
    {
        // <input type="hidden" name="_csrfToken" value="...">
        if (preg_match('/<input[^>]+name=["\']_csrfToken["\'][^>]+value=["\']([^"\']+)["\']/', $html, $m)) {
            return $m[1];
        }
        // 属性順が逆の場合
        if (preg_match('/<input[^>]+value=["\']([^"\']+)["\'][^>]+name=["\']_csrfToken["\']/', $html, $m)) {
            return $m[1];
        }
        // <meta name="csrfToken" content="...">
        if (preg_match('/<meta[^>]+name=["\']csrfToken["\'][^>]+content=["\']([^"\']+)["\']/', $html, $m)) {
            return $m[1];
        }

        Log::error('KamahoApiService: CSRF token not found. HTML preview: ' . substr($html, 0, 300));
        throw new \RuntimeException(
            'kamaho ログインページから CSRF トークンを取得できませんでした。' .
            'ページの構造が変更された可能性があります。'
        );
    }

    private function initCurl(): void
    {
        if ($this->ch !== null) {
            return;
        }
        $this->ch = curl_init();
        curl_setopt_array($this->ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_COOKIEFILE     => $this->cookieFile,
            CURLOPT_COOKIEJAR      => $this->cookieFile,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_USERAGENT      => 'Mozilla/5.0 (compatible; MealOrderSystem/1.0)',
        ]);
    }

    private function get(string $url): string
    {
        $this->initCurl();
        curl_setopt_array($this->ch, [
            CURLOPT_URL        => $url,
            CURLOPT_HTTPGET    => true,
            CURLOPT_HTTPHEADER => [
                'Accept: application/json, text/html, */*',
            ],
        ]);
        $body = curl_exec($this->ch);
        $this->checkCurlError($url);
        return (string)$body;
    }

    private function post(string $url, string $postData, string $csrfToken): string
    {
        $this->initCurl();
        curl_setopt_array($this->ch, [
            CURLOPT_URL        => $url,
            CURLOPT_POST       => true,
            CURLOPT_POSTFIELDS => $postData,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/x-www-form-urlencoded',
                'X-CSRF-Token: ' . $csrfToken,
                'Accept: application/json, text/html, */*',
            ],
        ]);
        $body = curl_exec($this->ch);
        $this->checkCurlError($url);
        return (string)$body;
    }

    private function checkCurlError(string $url): void
    {
        $errno = curl_errno($this->ch);
        if ($errno !== 0) {
            $error = curl_error($this->ch);
            Log::error(sprintf('KamahoApiService: curl error %d for %s: %s', $errno, $url, $error));
            throw new \RuntimeException(
                sprintf('kamaho への接続に失敗しました (curl error %d): %s', $errno, $error)
            );
        }

        $httpCode = curl_getinfo($this->ch, CURLINFO_HTTP_CODE);
        if ($httpCode >= 500) {
            Log::error(sprintf('KamahoApiService: HTTP %d for %s', $httpCode, $url));
            throw new \RuntimeException(
                sprintf('kamaho サーバーエラー (HTTP %d)', $httpCode)
            );
        }
    }

    public function __destruct()
    {
        if (file_exists($this->cookieFile)) {
            @unlink($this->cookieFile);
        }
    }
}
