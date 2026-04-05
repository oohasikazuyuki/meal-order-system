<?php
namespace App\Controller\Api;

use App\Controller\AppController;
use DateTime;

class AiController extends AppController
{
    private AiMenuLogicHelper $logic;

    public function initialize(): void
    {
        parent::initialize();
        $this->MenuMasters = $this->fetchTable('MenuMasters');
        $this->Suppliers = $this->fetchTable('Suppliers');
        $this->logic = new AiMenuLogicHelper();
    }

    private function ensureAiPublicEnabled(): bool
    {
        $enabled = strtolower((string)(getenv('AI_PUBLIC_ENABLED') ?: 'false')) === 'true';
        if ($enabled) {
            return true;
        }
        $this->response = $this->response->withStatus(404);
        $this->set(['ok' => false, 'message' => 'Not Found']);
        $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
        return false;
    }

    /**
     * POST /api/ai/menu-suggest
     * body: {
     *   date: "YYYY-MM-DD",
     *   block_id?: number,
     *   existing_by_meal?: { "1": string[], "2": string[], "3": string[], "4": string[] }
     * }
     */
    public function menuSuggest(): void
    {
        if (!$this->ensureAiPublicEnabled()) {
            return;
        }
        $date = (string)($this->request->getData('date') ?? '');
        if (!$this->isValidDate($date)) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'message' => 'date (YYYY-MM-DD) は必須です']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        $blockId = $this->request->getData('block_id');
        $blockId = ($blockId !== null && $blockId !== '') ? (int)$blockId : null;
        $existingByMeal = (array)($this->request->getData('existing_by_meal') ?? []);

        $candidateItems = $this->fetchCandidateMenuNames($blockId);
        if (empty($candidateItems)) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'message' => '提案対象のメニューマスタがありません']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        [$suggestions, $rawText] = $this->generateSuggestionsWithOllama($date, $candidateItems, $existingByMeal);
        if ($suggestions === null) {
            $this->response = $this->response->withStatus(502);
            $this->set(['ok' => false, 'message' => 'AI提案の生成に時間がかかっています。しばらくしてから再実行してください。']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        $this->set([
            'ok' => true,
            'date' => $date,
            'block_id' => $blockId,
            'suggestions' => $suggestions,
            'candidate_count' => count($candidateItems),
            'raw' => $rawText,
        ]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'date', 'block_id', 'suggestions', 'candidate_count', 'raw']);
    }

    /**
     * POST /api/ai/menu-master-draft
     * body: { name: string, block_id?: number|null }
     */
    public function menuMasterDraft(): void
    {
        if (!$this->ensureAiPublicEnabled()) {
            return;
        }
        $blockId = $this->request->getData('block_id');
        $blockId = ($blockId !== null && $blockId !== '') ? (int)$blockId : null;
        $candidateItems = $this->fetchCandidateMenuNames($blockId);
        $candidateNames = $this->candidateItemsToNames($candidateItems);
        $name = trim((string)($this->request->getData('name') ?? ''));
        $nameGenerated = false;
        if ($name === '') {
            $name = $this->generateMenuNameWithOllama($candidateNames) ?? '';
            $nameGenerated = $name !== '';
            if ($name === '') {
                $this->response = $this->response->withStatus(502);
                $this->set(['ok' => false, 'message' => '料理名のAI生成に失敗しました']);
                $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
                return;
            }
        }

        $suppliers = $this->Suppliers->find()
            ->select(['id', 'name', 'code'])
            ->orderBy(['id' => 'ASC'])
            ->toArray();

        [$draft, $rawText] = $this->generateMenuMasterDraftWithOllama($name, $candidateNames, $suppliers);
        if ($draft === null) {
            $this->response = $this->response->withStatus(502);
            $this->set(['ok' => false, 'message' => 'AI下書きの生成に時間がかかっています。しばらくしてから再実行してください。', 'raw' => $rawText ?: '']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message', 'raw']);
            return;
        }

        $this->set([
            'ok' => true,
            'name' => $name,
            'name_generated' => $nameGenerated,
            'draft' => $draft,
            'raw' => $rawText,
        ]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'name', 'name_generated', 'draft', 'raw']);
    }

    /**
     * メニューマスタから候補アイテムリストを取得する。
     * 各アイテムは ['name' => string, 'dish_category' => string|null] の形式。
     */
    private function fetchCandidateMenuNames(?int $blockId): array
    {
        $query = $this->MenuMasters->find()
            ->select(['name', 'dish_category'])
            ->orderBy(['MenuMasters.name' => 'ASC']);
        if ($blockId !== null) {
            $query->where(function ($exp) use ($blockId) {
                return $exp->or([
                    'MenuMasters.block_id' => $blockId,
                    'MenuMasters.block_id IS' => null,
                ]);
            });
        }

        $items = [];
        $seen = [];
        foreach ($query->toArray() as $row) {
            $name = trim((string)($row->name ?? ''));
            if ($name !== '' && !isset($seen[$name])) {
                $seen[$name] = true;
                $items[] = [
                    'name'          => $name,
                    'dish_category' => $row->dish_category ?? null,
                ];
            }
        }
        return $items;
    }

    /** 候補アイテムから名前のみの配列を返す（menu-master-draft 等で使用） */
    private function candidateItemsToNames(array $items): array
    {
        return $this->logic->candidateItemsToNames($items);
    }

    /**
     * AI献立提案（複数料理区分対応）
     *
     * @param array $candidateItems [{name: string, dish_category: string|null}, ...]
     * @param array $existingByMeal {meal_type_str: string[]}
     * @return array [suggestions, rawText]
     *   suggestions: {meal_type_str: {dish_category: name}}
     */
    private function generateSuggestionsWithOllama(string $date, array $candidateItems, array $existingByMeal): array
    {
        $season = $this->seasonLabel($date);

        // 名前→dish_category のマップ（バリデーション用）
        $candidateSet = [];
        foreach ($candidateItems as $item) {
            $candidateSet[$item['name']] = $item['dish_category'] ?? '';
        }

        // 候補リストを「名前:区分」形式で最大30件
        $candidateLines = [];
        foreach (array_slice($candidateItems, 0, 30) as $item) {
            $cat = $item['dish_category'] ?? '';
            $candidateLines[] = $cat !== '' ? "{$item['name']}:{$cat}" : $item['name'];
        }

        $existingText = [];
        foreach ([1, 2, 3, 4] as $mt) {
            $vals = isset($existingByMeal[(string)$mt]) ? (array)$existingByMeal[(string)$mt] : (array)($existingByMeal[$mt] ?? []);
            $vals = array_values(array_filter(array_map(fn($v) => trim((string)$v), $vals), fn($v) => $v !== ''));
            $existingText[] = "{$mt}: " . (empty($vals) ? 'なし' : implode('、', $vals));
        }

        $prompt = implode("\n", [
            "あなたは保育施設の献立提案アシスタントです。",
            "日付: {$date}（{$season}）",
            "食事種別: 1=朝食, 2=昼食, 3=夕食, 4=おやつ",
            "料理区分: 主食（ご飯・パンなど）、主菜（メインのおかず）、副菜（サブのおかず）、汁物（味噌汁など）、おやつ、丼物（主食と主菜が一体）",
            "既存メニュー（避けること）:",
            implode("\n", $existingText),
            "候補メニュー一覧（名前:区分の形式、この中からのみ選ぶ）:",
            implode('、', $candidateLines),
            "出力はJSONのみ。各食事種別を料理区分ごとに提案する。",
            "丼物の場合は 主食・主菜 の代わりに 丼物 として1件提案。",
            '{"suggestions":{"1":{"主食":"...","主菜":"..."},"2":{"主食":"...","主菜":"...","副菜":"...","汁物":"..."},"3":{"主食":"...","主菜":"...","副菜":"...","汁物":"..."},"4":{"おやつ":"..."}}}',
            "既存メニュー名は避け、候補にある名前のみ使用すること。",
        ]);

        $res = $this->callOllama($prompt, 120, ['num_predict' => 320, 'num_ctx' => 1024, 'temperature' => 0.2]);
        if (!$res['ok']) {
            // 短縮プロンプトで再試行
            $shortCandidates = implode('、', array_map(fn($i) => $i['name'], array_slice($candidateItems, 0, 15)));
            $retryPrompt = implode("\n", [
                "保育施設の献立を料理区分ごとに提案。候補のみ使用。",
                "候補: {$shortCandidates}",
                '{"suggestions":{"1":{"主食":"...","主菜":"..."},"2":{"主食":"...","主菜":"...","副菜":"...","汁物":"..."},"3":{"主食":"...","主菜":"...","副菜":"...","汁物":"..."},"4":{"おやつ":"..."}}}',
            ]);
            $res = $this->callOllama($retryPrompt, 80, ['num_predict' => 256, 'num_ctx' => 768, 'temperature' => 0.1]);
        }
        if (!$res['ok']) {
            return [$this->fallbackSuggestions($date, $candidateItems, $existingByMeal), 'fallback:no_response'];
        }

        $rawText = trim((string)($res['text'] ?? ''));
        $parsed = json_decode($rawText, true);
        if (!is_array($parsed)) {
            $parsed = $this->extractJsonObject($rawText);
        }
        if (is_array($parsed)) {
            $normalized = $this->normalizeCategorySuggestions((array)($parsed['suggestions'] ?? []), $candidateSet);
            if (!empty(array_filter($normalized, fn($v) => !empty($v)))) {
                return [$normalized, $rawText];
            }
        }

        return [$this->fallbackSuggestions($date, $candidateItems, $existingByMeal), $rawText];
    }

    /**
     * AI提案レスポンスを正規化する。
     * @param array $raw AI返却のsuggestionsオブジェクト
     * @param array $candidateSet [name => dish_category]
     * @return array {meal_type_str: {dish_category: name}}
     */
    private function normalizeCategorySuggestions(array $raw, array $candidateSet): array
    {
        return $this->logic->normalizeCategorySuggestions($raw, $candidateSet);
    }

    private function generateMenuMasterDraftWithOllama(string $name, array $candidates, array $suppliers): array
    {
        $supplierNames = array_map(fn($s) => (string)$s->name, $suppliers);
        $prompt = implode("\n", [
            "あなたは保育施設向けメニューマスタ作成アシスタントです。",
            "対象メニュー名: {$name}",
            "既存メニュー参考: " . (empty($candidates) ? 'なし' : implode('、', array_slice($candidates, 0, 30))),
            "仕入先候補: " . (empty($supplierNames) ? 'なし' : implode('、', $supplierNames)),
            "出力はJSONのみ。形式:",
            '{"grams_per_person":0,"memo":"","ingredients":[{"name":"","amount":0,"unit":"g","supplier_name":"","persons_per_unit":null}]}',
            "ingredientsは3〜6件程度。amountは数値。unitは g,kg,ml,L,個,枚,本,袋,缶,束,合,大さじ,小さじ,切れ,適量 から選ぶ。",
        ]);

        $res = $this->callOllama($prompt, 150, ['num_predict' => 180, 'num_ctx' => 1024, 'temperature' => 0.3]);
        if (!$res['ok']) {
            return [null, ''];
        }

        $rawText = trim((string)($res['text'] ?? ''));
        $parsed = json_decode($rawText, true);
        if (!is_array($parsed)) {
            $parsed = $this->extractJsonObject($rawText);
        }
        if (!is_array($parsed)) {
            error_log('menuMasterDraft parse failed: ' . mb_substr($rawText, 0, 240));
            return [null, $rawText];
        }

        $draft = $this->normalizeMenuMasterDraft($parsed, $suppliers);
        return [$draft, $rawText];
    }

    private function normalizeMenuMasterDraft(array $raw, array $suppliers): array
    {
        return $this->logic->normalizeMenuMasterDraft($raw, $suppliers);
    }

    private function resolveSupplierIdByName(string $name, array $suppliers): ?int
    {
        return $this->logic->resolveSupplierIdByName($name, $suppliers);
    }

    private function generateMenuNameWithOllama(array $candidates): ?string
    {
        $prompt = implode("\n", [
            "保育施設の献立で使える料理名を1つだけ提案してください。",
            "出力はJSONのみ。形式:",
            '{"name":"..."}',
            "似た料理例:",
            implode('、', array_slice($candidates, 0, 20)),
        ]);

        $res = $this->callOllama($prompt, 60, ['num_predict' => 32, 'num_ctx' => 384, 'temperature' => 0.4]);
        if (!$res['ok']) return null;
        $rawText = trim((string)($res['text'] ?? ''));
        $parsed = json_decode($rawText, true);
        if (!is_array($parsed)) {
            $parsed = $this->extractJsonObject($rawText);
        }
        if (is_array($parsed)) {
            $name = trim((string)($parsed['name'] ?? ''));
            if ($name !== '') return $name;
        }

        if (preg_match('/[ぁ-んァ-ヶ一-龥A-Za-z0-9][^\\n\\r]{1,40}/u', $rawText, $m)) {
            $name = trim($m[0]);
            if ($name !== '') return $name;
        }
        return null;
    }


    private function callOllama(string $prompt, int $timeoutSec = 90, array $options = []): array
    {
        $provider = strtolower((string)(getenv('AI_PROVIDER') ?: 'ollama'));
        if ($provider === 'openrouter') {
            return $this->callOpenRouter($prompt, $timeoutSec, $options);
        }
        if ($provider === 'groq') {
            return $this->callGroq($prompt, $timeoutSec, $options);
        }
        return $this->callOllamaLocal($prompt, $timeoutSec, $options);
    }

    private function callOllamaLocal(string $prompt, int $timeoutSec = 90, array $options = []): array
    {
        $baseUrl = rtrim((string)(getenv('OLLAMA_BASE_URL') ?: 'http://ollama:11434'), '/');
        $model = (string)(getenv('OLLAMA_MODEL') ?: 'qwen2.5:1.5b-instruct-q4_K_S');
        $url = $baseUrl . '/api/generate';

        $payload = [
            'model' => $model,
            'prompt' => $prompt,
            'stream' => false,
            'format' => 'json',
            'options' => array_merge(['temperature' => 0.4], $options),
        ];

        for ($attempt = 0; $attempt < 2; $attempt++) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
                CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
                CURLOPT_TIMEOUT => $timeoutSec,
                CURLOPT_CONNECTTIMEOUT => 10,
            ]);
            $body = curl_exec($ch);
            $errno = curl_errno($ch);
            $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            curl_close($ch);

            if ($errno === 0 && $status >= 200 && $status < 300 && is_string($body)) {
                $decoded = json_decode($body, true);
                if (is_array($decoded)) {
                    return ['ok' => true, 'text' => (string)($decoded['response'] ?? '')];
                }
            }

            error_log("Ollama call failed: attempt={$attempt} status={$status} errno={$errno} err={$error}");
            if ($attempt === 0) {
                usleep(300000); // 300ms
            }
        }

        return ['ok' => false, 'text' => ''];
    }

    private function callOpenRouter(string $prompt, int $timeoutSec = 90, array $options = []): array
    {
        $apiKey = trim((string)(getenv('OPENROUTER_API_KEY') ?: ''));
        if ($apiKey === '') {
            error_log('OpenRouter call failed: missing OPENROUTER_API_KEY');
            return ['ok' => false, 'text' => ''];
        }

        $baseUrl = rtrim((string)(getenv('OPENROUTER_BASE_URL') ?: 'https://openrouter.ai/api/v1'), '/');
        $model = (string)(getenv('OPENROUTER_MODEL') ?: 'qwen/qwen3-4b:free');
        $siteUrl = (string)(getenv('OPENROUTER_SITE_URL') ?: 'http://localhost');
        $appName = (string)(getenv('OPENROUTER_APP_NAME') ?: 'meal-order-system');
        $url = $baseUrl . '/chat/completions';

        $maxTokens = isset($options['num_predict']) ? max(64, (int)$options['num_predict']) : 256;
        $temperature = isset($options['temperature']) ? (float)$options['temperature'] : 0.4;
        $payload = [
            'model' => $model,
            'messages' => [
                ['role' => 'user', 'content' => $prompt],
            ],
            'temperature' => $temperature,
            'max_tokens' => $maxTokens,
        ];

        for ($attempt = 0; $attempt < 2; $attempt++) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => [
                    'Authorization: Bearer ' . $apiKey,
                    'Content-Type: application/json',
                    'HTTP-Referer: ' . $siteUrl,
                    'X-Title: ' . $appName,
                ],
                CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
                CURLOPT_TIMEOUT => $timeoutSec,
                CURLOPT_CONNECTTIMEOUT => 10,
            ]);
            $body = curl_exec($ch);
            $errno = curl_errno($ch);
            $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            curl_close($ch);

            if ($errno === 0 && $status >= 200 && $status < 300 && is_string($body)) {
                $decoded = json_decode($body, true);
                $content = (string)($decoded['choices'][0]['message']['content'] ?? '');
                if ($content !== '') {
                    return ['ok' => true, 'text' => $content];
                }
            }

            $bodySnippet = is_string($body) ? mb_substr($body, 0, 240) : '';
            error_log("OpenRouter call failed: attempt={$attempt} status={$status} errno={$errno} err={$error} body={$bodySnippet}");
            if ($attempt === 0) {
                usleep(300000);
            }
        }

        return ['ok' => false, 'text' => ''];
    }

    private function callGroq(string $prompt, int $timeoutSec = 90, array $options = []): array
    {
        $apiKey = trim((string)(getenv('GROQ_API_KEY') ?: ''));
        if ($apiKey === '') {
            error_log('Groq call failed: missing GROQ_API_KEY');
            return ['ok' => false, 'text' => ''];
        }

        $baseUrl = 'https://api.groq.com/openai/v1';
        $model = (string)(getenv('GROQ_MODEL') ?: 'llama-3.1-8b-instant');
        $url = $baseUrl . '/chat/completions';

        $maxTokens = isset($options['num_predict']) ? max(64, (int)$options['num_predict']) : 256;
        $temperature = isset($options['temperature']) ? (float)$options['temperature'] : 0.4;
        $payload = [
            'model' => $model,
            'messages' => [
                ['role' => 'user', 'content' => $prompt],
            ],
            'temperature' => $temperature,
            'max_tokens' => $maxTokens,
        ];

        for ($attempt = 0; $attempt < 2; $attempt++) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => [
                    'Authorization: Bearer ' . $apiKey,
                    'Content-Type: application/json',
                ],
                CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
                CURLOPT_TIMEOUT => $timeoutSec,
                CURLOPT_CONNECTTIMEOUT => 10,
            ]);
            $body = curl_exec($ch);
            $errno = curl_errno($ch);
            $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            curl_close($ch);

            if ($errno === 0 && $status >= 200 && $status < 300 && is_string($body)) {
                $decoded = json_decode($body, true);
                $content = (string)($decoded['choices'][0]['message']['content'] ?? '');
                if ($content !== '') {
                    return ['ok' => true, 'text' => $content];
                }
            }

            $bodySnippet = is_string($body) ? mb_substr($body, 0, 240) : '';
            error_log("Groq call failed: attempt={$attempt} status={$status} errno={$errno} err={$error} body={$bodySnippet}");
            if ($attempt === 0) {
                usleep(300000);
            }
        }

        return ['ok' => false, 'text' => ''];
    }

    private function extractJsonObject(string $text): ?array
    {
        if (!preg_match('/\{[\s\S]*\}/', $text, $m)) {
            return null;
        }
        $decoded = json_decode($m[0], true);
        return is_array($decoded) ? $decoded : null;
    }

    private function extractSuggestionsFromPartialText(string $text, array $candidateSet): ?array
    {
        return $this->logic->extractSuggestionsFromPartialText($text, $candidateSet);
    }

    private function seasonLabel(string $date): string
    {
        return $this->logic->seasonLabel($date);
    }

    private function isValidDate(string $date): bool
    {
        return $this->logic->isValidDate($date);
    }

    /**
     * AI呼び出し失敗時のフォールバック。
     *
     * @param array $candidateItems [{name, dish_category}, ...]
     */
    private function fallbackSuggestions(string $date, array $candidateItems, array $existingByMeal): array
    {
        return $this->logic->fallbackSuggestions($date, $candidateItems, $existingByMeal);
    }
}
