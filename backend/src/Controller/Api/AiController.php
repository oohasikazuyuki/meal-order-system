<?php
namespace App\Controller\Api;

use App\Controller\AppController;
use DateTime;

class AiController extends AppController
{
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

    public function initialize(): void
    {
        parent::initialize();
        $this->MenuMasters = $this->fetchTable('MenuMasters');
        $this->Suppliers = $this->fetchTable('Suppliers');
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

        $candidates = $this->fetchCandidateMenuNames($blockId);

        [$suggestions, $rawText] = $this->generateSuggestionsWithOllama($date, $candidates, $existingByMeal);
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
            'candidate_count' => count($candidates),
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
        $candidates = $this->fetchCandidateMenuNames($blockId);
        $name = trim((string)($this->request->getData('name') ?? ''));
        $nameGenerated = false;
        if ($name === '') {
            $name = $this->generateMenuNameWithOllama($candidates) ?? '';
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

        [$draft, $rawText] = $this->generateMenuMasterDraftWithOllama($name, $candidates, $suppliers);
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

    private function fetchCandidateMenuNames(?int $blockId): array
    {
        $query = $this->MenuMasters->find()->select(['name'])->orderBy(['MenuMasters.name' => 'ASC']);
        if ($blockId !== null) {
            $query->where(function ($exp) use ($blockId) {
                return $exp->or([
                    'MenuMasters.block_id' => $blockId,
                    'MenuMasters.block_id IS' => null,
                ]);
            });
        }

        $names = [];
        foreach ($query->toArray() as $row) {
            $name = trim((string)($row->name ?? ''));
            if ($name !== '') {
                $names[$name] = true;
            }
        }
        return array_keys($names);
    }

    private function generateSuggestionsWithOllama(string $date, array $candidates, array $existingByMeal): array
    {
        $season = $this->seasonLabel($date);
        $existingNames = $this->collectExistingMenuNames($existingByMeal);

        $existingText = [];
        foreach ([1, 2, 3, 4] as $mt) {
            $vals = isset($existingByMeal[(string)$mt]) ? (array)$existingByMeal[(string)$mt] : (array)($existingByMeal[$mt] ?? []);
            $vals = array_values(array_filter(array_map(fn($v) => trim((string)$v), $vals), fn($v) => $v !== ''));
            $existingText[] = "{$mt}: " . (empty($vals) ? 'なし' : implode('、', $vals));
        }

        $referenceMenus = empty($candidates)
            ? 'なし'
            : implode('、', array_slice($candidates, 0, 30));

        $prompt = implode("\n", [
            "あなたは保育施設の献立提案アシスタントです。",
            "日付: {$date}（{$season}）",
            "食事種別: 1=朝食, 2=昼食, 3=夕食, 4=おやつ",
            "この日の既存献立（同じ名前は使わないこと）:",
            implode("\n", $existingText),
            "過去の献立例（参考のみ。そのまま選ばず、新しいメニュー名を考えること）:",
            $referenceMenus,
            "各食事種別に、保育施設向けの新しい献立名を1つずつ考えてください。",
            "メニューマスタに無い新規の料理名で構いません。",
            "献立名は日本語で20文字以内、具体的な料理名にしてください。",
            "出力はJSONのみ。形式:",
            '{"suggestions":{"1":["..."],"2":["..."],"3":["..."],"4":["..."]}}',
            "各食事は最大1件。",
        ]);

        $res = $this->callOllama($prompt, 120, ['num_predict' => 160, 'num_ctx' => 768, 'temperature' => 0.7]);
        if (!$res['ok']) {
            $retryPrompt = implode("\n", [
                "保育施設向けに、朝食・昼食・夕食・おやつの新しい献立名を1件ずつ考えてJSONだけ返してください。",
                "既存献立: " . (empty($existingNames) ? 'なし' : implode('、', array_slice($existingNames, 0, 12))),
                '{"suggestions":{"1":["..."],"2":["..."],"3":["..."],"4":["..."]}}',
            ]);
            $res = $this->callOllama($retryPrompt, 80, ['num_predict' => 120, 'num_ctx' => 512, 'temperature' => 0.5]);
        }
        if (!$res['ok']) {
            return [null, ''];
        }

        $rawText = trim((string)($res['text'] ?? ''));
        $parsed = json_decode($rawText, true);
        if (!is_array($parsed)) {
            $parsed = $this->extractJsonObject($rawText);
        }
        if (is_array($parsed)) {
            $rawSuggestions = (array)($parsed['suggestions'] ?? []);
            $normalized = $this->normalizeAiSuggestions($rawSuggestions, $existingByMeal);
            if ($this->hasAnySuggestion($normalized)) {
                return [$normalized, $rawText];
            }
        }

        $loose = $this->extractSuggestionsFromPartialText($rawText, $existingByMeal);
        if ($loose !== null) {
            return [$loose, $rawText];
        }

        return [null, $rawText];
    }

    private function collectExistingMenuNames(array $existingByMeal): array
    {
        $names = [];
        foreach ([1, 2, 3, 4] as $mt) {
            $vals = isset($existingByMeal[(string)$mt]) ? (array)$existingByMeal[(string)$mt] : (array)($existingByMeal[$mt] ?? []);
            foreach ($vals as $name) {
                $name = trim((string)$name);
                if ($name !== '') {
                    $names[$name] = true;
                }
            }
        }
        return array_keys($names);
    }

    private function normalizeAiSuggestions(array $rawSuggestions, array $existingByMeal): array
    {
        $normalized = [];
        $usedInDay = [];
        foreach ([1, 2, 3, 4] as $mt) {
            $existingForMeal = array_fill_keys($this->collectMealMenuNames($existingByMeal, $mt), true);
            $vals = isset($rawSuggestions[(string)$mt]) ? (array)$rawSuggestions[(string)$mt] : (array)($rawSuggestions[$mt] ?? []);
            $filtered = [];
            foreach ($vals as $name) {
                $name = $this->normalizeSuggestionName((string)$name);
                if ($name === '') continue;
                if (isset($existingForMeal[$name]) || isset($usedInDay[$name])) continue;
                $filtered[$name] = true;
                $usedInDay[$name] = true;
                if (count($filtered) >= 1) break;
            }
            $normalized[(string)$mt] = array_keys($filtered);
        }
        return $normalized;
    }

    private function collectMealMenuNames(array $existingByMeal, int $mealType): array
    {
        $vals = isset($existingByMeal[(string)$mealType]) ? (array)$existingByMeal[(string)$mealType] : (array)($existingByMeal[$mealType] ?? []);
        return array_values(array_filter(array_map(fn($v) => trim((string)$v), $vals), fn($v) => $v !== ''));
    }

    private function normalizeSuggestionName(string $name): string
    {
        $name = trim(preg_replace('/\s+/u', ' ', $name) ?? '');
        if ($name === '') {
            return '';
        }
        if (mb_strlen($name) > 40) {
            $name = mb_substr($name, 0, 40);
        }
        return $name;
    }

    private function hasAnySuggestion(array $suggestions): bool
    {
        foreach ($suggestions as $vals) {
            if (!empty($vals)) {
                return true;
            }
        }
        return false;
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
        $unitAllowed = array_fill_keys(['g', 'kg', 'ml', 'L', '個', '枚', '本', '袋', '缶', '束', '合', '大さじ', '小さじ', '切れ', '適量'], true);
        $grams = (float)($raw['grams_per_person'] ?? 0);
        if (!is_finite($grams) || $grams < 0 || $grams > 5000) {
            $grams = 0;
        }
        $memo = trim((string)($raw['memo'] ?? ''));
        $ingredientsRaw = (array)($raw['ingredients'] ?? []);
        $ingredients = [];

        foreach ($ingredientsRaw as $item) {
            if (!is_array($item)) continue;
            $ingName = trim((string)($item['name'] ?? ''));
            if ($ingName === '') continue;

            $amount = (float)($item['amount'] ?? 0);
            if (!is_finite($amount) || $amount < 0 || $amount > 100000) {
                $amount = 0;
            }

            $unit = trim((string)($item['unit'] ?? 'g'));
            if (!isset($unitAllowed[$unit])) {
                $unit = 'g';
            }

            $personsPerUnit = $item['persons_per_unit'] ?? null;
            $personsPerUnit = ($personsPerUnit !== null && $personsPerUnit !== '') ? (int)$personsPerUnit : null;
            if ($personsPerUnit !== null && $personsPerUnit <= 0) {
                $personsPerUnit = null;
            }

            $supplierName = trim((string)($item['supplier_name'] ?? ''));
            $supplierId = $this->resolveSupplierIdByName($supplierName, $suppliers);

            $ingredients[] = [
                'name' => $ingName,
                'amount' => $amount,
                'unit' => $unit,
                'persons_per_unit' => $personsPerUnit,
                'supplier_id' => $supplierId,
            ];
            if (count($ingredients) >= 12) break;
        }

        return [
            'grams_per_person' => $grams,
            'memo' => $memo,
            'ingredients' => $ingredients,
        ];
    }

    private function resolveSupplierIdByName(string $name, array $suppliers): ?int
    {
        if ($name === '') return null;
        foreach ($suppliers as $s) {
            $sName = (string)($s->name ?? '');
            if ($sName !== '' && ($sName === $name || str_contains($name, $sName) || str_contains($sName, $name))) {
                return (int)$s->id;
            }
        }
        return null;
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
        $provider = strtolower((string)(getenv('AI_PROVIDER') ?: 'openrouter'));
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
        $model = (string)(getenv('OPENROUTER_MODEL') ?: 'openai/gpt-oss-20b:free');
        $siteUrl = (string)(getenv('OPENROUTER_SITE_URL') ?: 'http://localhost');
        $appName = (string)(getenv('OPENROUTER_APP_NAME') ?: 'meal-order-system');
        $url = $baseUrl . '/chat/completions';

        // gpt-oss 系は推論トークンを消費するため余裕を持たせる
        $maxTokens = isset($options['num_predict']) ? max(512, (int)$options['num_predict'] * 4) : 1024;
        $temperature = isset($options['temperature']) ? (float)$options['temperature'] : 0.4;
        $payload = [
            'model' => $model,
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'あなたは保育施設向け献立アシスタントです。指示どおりJSONのみを返してください。新しい献立名を考える場合も、説明文やMarkdownは不要です。',
                ],
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
                $message = $decoded['choices'][0]['message'] ?? [];
                $content = $this->extractOpenRouterContent(is_array($message) ? $message : []);
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

    /**
     * OpenRouter / reasoning モデルの応答から本文テキストを取り出す
     */
    private function extractOpenRouterContent(array $message): string
    {
        $content = $message['content'] ?? '';
        if (is_string($content) && trim($content) !== '') {
            return trim($content);
        }
        if (is_array($content)) {
            $parts = [];
            foreach ($content as $part) {
                if (is_string($part)) {
                    $parts[] = $part;
                    continue;
                }
                if (!is_array($part)) {
                    continue;
                }
                $text = $part['text'] ?? $part['content'] ?? '';
                if (is_string($text) && $text !== '') {
                    $parts[] = $text;
                }
            }
            $joined = trim(implode("\n", $parts));
            if ($joined !== '') {
                return $joined;
            }
        }

        foreach (['reasoning', 'reasoning_content', 'refusal'] as $key) {
            $alt = $message[$key] ?? '';
            if (is_string($alt) && trim($alt) !== '') {
                return trim($alt);
            }
        }

        return '';
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

    private function extractSuggestionsFromPartialText(string $text, array $existingByMeal): ?array
    {
        $rawSuggestions = [];
        foreach ([1, 2, 3, 4] as $mt) {
            if (preg_match('/"' . $mt . '"\s*:\s*\[\s*"([^"]+)"/u', $text, $m)) {
                $rawSuggestions[(string)$mt] = [trim((string)$m[1])];
            }
        }
        if (empty($rawSuggestions)) {
            return null;
        }

        $normalized = $this->normalizeAiSuggestions($rawSuggestions, $existingByMeal);
        return $this->hasAnySuggestion($normalized) ? $normalized : null;
    }

    private function seasonLabel(string $date): string
    {
        $dt = new DateTime($date);
        $m = (int)$dt->format('n');
        return match (true) {
            in_array($m, [3, 4, 5], true) => '春',
            in_array($m, [6, 7, 8], true) => '夏',
            in_array($m, [9, 10, 11], true) => '秋',
            default => '冬',
        };
    }

    private function isValidDate(string $date): bool
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return false;
        }
        $dt = DateTime::createFromFormat('Y-m-d', $date);
        return $dt && $dt->format('Y-m-d') === $date;
    }
}
