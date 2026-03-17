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
        if (empty($candidates)) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'message' => '提案対象のメニューマスタがありません']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

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
        $candidateSet = array_fill_keys($candidates, true);

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
            "既存メニュー:",
            implode("\n", $existingText),
            "候補メニュー（この中からのみ選ぶこと）:",
            implode('、', array_slice($candidates, 0, 20)),
            "出力はJSONのみ。形式:",
            '{"suggestions":{"1":["..."],"2":["..."],"3":["..."],"4":["..."]}}',
            "各食事は最大1件。既存メニュー名は避ける。",
        ]);

        $res = $this->callOllama($prompt, 120, ['num_predict' => 160, 'num_ctx' => 768, 'temperature' => 0.2]);
        if (!$res['ok']) {
            // 1回だけ短縮プロンプトで再試行
            $retryPrompt = implode("\n", [
                "次の候補から、朝昼夕おやつを1件ずつ選びJSONだけ返す。",
                "候補: " . implode('、', array_slice($candidates, 0, 12)),
                '{"suggestions":{"1":["..."],"2":["..."],"3":["..."],"4":["..."]}}',
            ]);
            $res = $this->callOllama($retryPrompt, 80, ['num_predict' => 120, 'num_ctx' => 512, 'temperature' => 0.1]);
        }
        if (!$res['ok']) {
            return [$this->fallbackSuggestions($date, $candidates, $existingByMeal), 'fallback:no_response'];
        }

        $rawText = trim((string)($res['text'] ?? ''));
        $parsed = json_decode($rawText, true);
        if (!is_array($parsed)) {
            $parsed = $this->extractJsonObject($rawText);
        }
        if (is_array($parsed)) {
            $rawSuggestions = (array)($parsed['suggestions'] ?? []);
            $normalized = [];
            foreach ([1, 2, 3, 4] as $mt) {
                $vals = isset($rawSuggestions[(string)$mt]) ? (array)$rawSuggestions[(string)$mt] : (array)($rawSuggestions[$mt] ?? []);
                $filtered = [];
                foreach ($vals as $name) {
                    $name = trim((string)$name);
                    if ($name === '' || !isset($candidateSet[$name])) continue;
                    $filtered[$name] = true;
                    if (count($filtered) >= 1) break;
                }
                $normalized[(string)$mt] = array_keys($filtered);
            }
            return [$normalized, $rawText];
        }

        $loose = $this->extractSuggestionsFromPartialText($rawText, $candidateSet);
        if ($loose !== null) {
            return [$loose, $rawText];
        }

        return [$this->fallbackSuggestions($date, $candidates, $existingByMeal), $rawText];
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
        $provider = strtolower((string)(getenv('AI_PROVIDER') ?: 'ollama'));
        if ($provider === 'openrouter') {
            return $this->callOpenRouter($prompt, $timeoutSec, $options);
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
        $out = [];
        foreach ([1, 2, 3, 4] as $mt) {
            $matched = preg_match('/"' . $mt . '"\s*:\s*\[\s*"([^"]+)"/u', $text, $m);
            if (!$matched) {
                $out[(string)$mt] = [];
                continue;
            }
            $name = trim((string)$m[1]);
            if ($name === '' || !isset($candidateSet[$name])) {
                $out[(string)$mt] = [];
                continue;
            }
            $out[(string)$mt] = [$name];
        }

        $hasAny = false;
        foreach ($out as $vals) {
            if (!empty($vals)) {
                $hasAny = true;
                break;
            }
        }
        return $hasAny ? $out : null;
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

    private function fallbackSuggestions(string $date, array $candidates, array $existingByMeal): array
    {
        $result = [];
        $count = max(1, count($candidates));
        foreach ([1, 2, 3, 4] as $mt) {
            $vals = isset($existingByMeal[(string)$mt]) ? (array)$existingByMeal[(string)$mt] : (array)($existingByMeal[$mt] ?? []);
            $existing = array_fill_keys(array_filter(array_map(fn($v) => trim((string)$v), $vals), fn($v) => $v !== ''), true);

            $base = abs(crc32($date . ':' . $mt)) % $count;
            $picked = '';
            for ($i = 0; $i < $count; $i++) {
                $idx = ($base + $i) % $count;
                $name = trim((string)($candidates[$idx] ?? ''));
                if ($name === '' || isset($existing[$name])) continue;
                $picked = $name;
                break;
            }
            $result[(string)$mt] = $picked === '' ? [] : [$picked];
        }
        return $result;
    }
}
