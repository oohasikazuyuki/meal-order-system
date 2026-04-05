<?php
declare(strict_types=1);

namespace App\Controller\Api;

use DateTime;

/**
 * AiController から抽出した純粋ロジック（テスト可能なステートレスヘルパー）
 */
class AiMenuLogicHelper
{
    /**
     * AI提案レスポンスを正規化する。
     * 各食事種別の値が {dish_category: name} 形式であることを確認し、
     * 候補セットにない名前を除外する。
     *
     * @param array $raw AI返却のsuggestionsオブジェクト
     * @param array $candidateSet [name => dish_category]
     * @return array {meal_type_str: {dish_category: name}}
     */
    public function normalizeCategorySuggestions(array $raw, array $candidateSet): array
    {
        $result = [];
        foreach ([1, 2, 3, 4] as $mt) {
            $byCategory = isset($raw[(string)$mt]) ? (array)$raw[(string)$mt] : (array)($raw[$mt] ?? []);
            $normalized = [];
            foreach ($byCategory as $cat => $name) {
                $cat  = trim((string)$cat);
                $name = trim((string)$name);
                if ($cat === '' || $name === '') continue;
                if (!array_key_exists($name, $candidateSet)) continue;
                $normalized[$cat] = $name;
            }
            $result[(string)$mt] = $normalized;
        }
        return $result;
    }

    /**
     * AI呼び出し失敗時のフォールバック。
     * 各食事種別に対して料理区分ごとに1件ずつ疑似ランダム選択する。
     *
     * @param array $candidateItems [{name, dish_category}, ...]
     */
    public function fallbackSuggestions(string $date, array $candidateItems, array $existingByMeal): array
    {
        // 料理区分ごとに候補を分類
        $byCategory = [];
        foreach ($candidateItems as $item) {
            $cat = $item['dish_category'] ?? '';
            $byCategory[$cat][] = $item['name'];
        }

        // 食事種別ごとの標準的な料理区分
        $mealCategories = [
            1 => ['主食', '主菜'],
            2 => ['主食', '主菜', '副菜', '汁物'],
            3 => ['主食', '主菜', '副菜', '汁物'],
            4 => ['おやつ', 'デザート'],
        ];

        $result = [];
        foreach ([1, 2, 3, 4] as $mt) {
            $vals = isset($existingByMeal[(string)$mt]) ? (array)$existingByMeal[(string)$mt] : (array)($existingByMeal[$mt] ?? []);
            $existing = array_fill_keys(array_filter(array_map(fn($v) => trim((string)$v), $vals), fn($v) => $v !== ''), true);

            $categories = $mealCategories[$mt] ?? ['主菜'];
            $picked = [];
            foreach ($categories as $ci => $cat) {
                $pool  = $byCategory[$cat] ?? ($byCategory[''] ?? []);
                $count = max(1, count($pool));
                $base  = abs(crc32($date . ':' . $mt . ':' . $ci)) % $count;
                for ($i = 0; $i < $count; $i++) {
                    $idx  = ($base + $i) % $count;
                    $name = trim((string)($pool[$idx] ?? ''));
                    if ($name === '' || isset($existing[$name])) continue;
                    $picked[$cat] = $name;
                    break;
                }
            }
            $result[(string)$mt] = $picked;
        }
        return $result;
    }

    /**
     * 部分テキストから提案を抽出する（JSONパース失敗時のフォールバック）。
     *
     * @param array $candidateSet [name => dish_category]
     */
    public function extractSuggestionsFromPartialText(string $text, array $candidateSet): ?array
    {
        $out = [];
        foreach ([1, 2, 3, 4] as $mt) {
            $out[(string)$mt] = [];
            if (!preg_match('/"' . $mt . '"\s*:\s*\{([^}]+)\}/u', $text, $block)) {
                continue;
            }
            $blockText = $block[1];
            preg_match_all('/"([^"]+)"\s*:\s*"([^"]+)"/u', $blockText, $pairs, PREG_SET_ORDER);
            foreach ($pairs as $pair) {
                $cat  = trim($pair[1]);
                $name = trim($pair[2]);
                if ($cat !== '' && $name !== '' && array_key_exists($name, $candidateSet)) {
                    $out[(string)$mt][$cat] = $name;
                }
            }
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

    /** 日付文字列のバリデーション（YYYY-MM-DD形式かつ有効な日付） */
    public function isValidDate(string $date): bool
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return false;
        }
        $dt = DateTime::createFromFormat('Y-m-d', $date);
        return $dt && $dt->format('Y-m-d') === $date;
    }

    /** 日付から季節ラベルを返す */
    public function seasonLabel(string $date): string
    {
        $dt = new DateTime($date);
        $m  = (int)$dt->format('n');
        return match (true) {
            in_array($m, [3, 4, 5], true)  => '春',
            in_array($m, [6, 7, 8], true)  => '夏',
            in_array($m, [9, 10, 11], true) => '秋',
            default                          => '冬',
        };
    }

    /** 候補アイテムリストから名前のみの配列を返す */
    public function candidateItemsToNames(array $items): array
    {
        return array_map(fn($i) => $i['name'], $items);
    }

    /**
     * メニューマスタ下書きを正規化する。
     *
     * @param array $suppliers CakePHP Entityオブジェクトの配列
     */
    public function normalizeMenuMasterDraft(array $raw, array $suppliers): array
    {
        $unitAllowed = array_fill_keys(['g', 'kg', 'ml', 'L', '個', '枚', '本', '袋', '缶', '束', '合', '大さじ', '小さじ', '切れ', '適量'], true);
        $grams = (float)($raw['grams_per_person'] ?? 0);
        if (!is_finite($grams) || $grams < 0 || $grams > 5000) {
            $grams = 0.0;
        }
        $memo           = trim((string)($raw['memo'] ?? ''));
        $ingredientsRaw = (array)($raw['ingredients'] ?? []);
        $ingredients    = [];

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
            $supplierId   = $this->resolveSupplierIdByName($supplierName, $suppliers);

            $ingredients[] = [
                'name'            => $ingName,
                'amount'          => $amount,
                'unit'            => $unit,
                'persons_per_unit' => $personsPerUnit,
                'supplier_id'     => $supplierId,
            ];
            if (count($ingredients) >= 12) break;
        }

        return [
            'grams_per_person' => $grams,
            'memo'             => $memo,
            'ingredients'      => $ingredients,
        ];
    }

    /** 仕入先名からIDを解決する */
    public function resolveSupplierIdByName(string $name, array $suppliers): ?int
    {
        if ($name === '') return null;
        foreach ($suppliers as $s) {
            $sName = is_object($s) ? (string)($s->name ?? '') : (string)($s['name'] ?? '');
            if ($sName !== '' && ($sName === $name || str_contains($name, $sName) || str_contains($sName, $name))) {
                $id = is_object($s) ? ($s->id ?? null) : ($s['id'] ?? null);
                return $id !== null ? (int)$id : null;
            }
        }
        return null;
    }
}
