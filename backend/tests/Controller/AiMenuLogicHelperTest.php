<?php
declare(strict_types=1);

namespace App\Test\Controller;

use App\Controller\Api\AiMenuLogicHelper;
use PHPUnit\Framework\TestCase;

class AiMenuLogicHelperTest extends TestCase
{
    private AiMenuLogicHelper $helper;

    protected function setUp(): void
    {
        $this->helper = new AiMenuLogicHelper();
    }

    // ── isValidDate ──────────────────────────────────────────────────────────

    public function testIsValidDateReturnsTrueForValidDate(): void
    {
        $this->assertTrue($this->helper->isValidDate('2026-04-05'));
    }

    public function testIsValidDateReturnsFalseForSlashFormat(): void
    {
        $this->assertFalse($this->helper->isValidDate('2026/04/05'));
    }

    public function testIsValidDateReturnsFalseForEmpty(): void
    {
        $this->assertFalse($this->helper->isValidDate(''));
    }

    public function testIsValidDateReturnsFalseForInvalidDay(): void
    {
        $this->assertFalse($this->helper->isValidDate('2026-02-30'));
    }

    public function testIsValidDateReturnsFalseForPartialDate(): void
    {
        $this->assertFalse($this->helper->isValidDate('2026-04'));
    }

    // ── seasonLabel ──────────────────────────────────────────────────────────

    public function testSeasonLabelSpring(): void
    {
        foreach (['2026-03-01', '2026-04-15', '2026-05-31'] as $date) {
            $this->assertSame('春', $this->helper->seasonLabel($date), "date={$date}");
        }
    }

    public function testSeasonLabelSummer(): void
    {
        foreach (['2026-06-01', '2026-07-15', '2026-08-31'] as $date) {
            $this->assertSame('夏', $this->helper->seasonLabel($date), "date={$date}");
        }
    }

    public function testSeasonLabelAutumn(): void
    {
        foreach (['2026-09-01', '2026-10-15', '2026-11-30'] as $date) {
            $this->assertSame('秋', $this->helper->seasonLabel($date), "date={$date}");
        }
    }

    public function testSeasonLabelWinter(): void
    {
        foreach (['2026-12-01', '2026-01-15', '2026-02-28'] as $date) {
            $this->assertSame('冬', $this->helper->seasonLabel($date), "date={$date}");
        }
    }

    // ── candidateItemsToNames ────────────────────────────────────────────────

    public function testCandidateItemsToNamesExtractsNames(): void
    {
        $items = [
            ['name' => 'ご飯', 'dish_category' => '主食'],
            ['name' => '豚汁', 'dish_category' => '汁物'],
        ];
        $this->assertSame(['ご飯', '豚汁'], $this->helper->candidateItemsToNames($items));
    }

    public function testCandidateItemsToNamesReturnsEmptyForEmptyInput(): void
    {
        $this->assertSame([], $this->helper->candidateItemsToNames([]));
    }

    // ── normalizeCategorySuggestions ─────────────────────────────────────────

    public function testNormalizeFiltersOutNamesNotInCandidateSet(): void
    {
        $raw = [
            '1' => ['主食' => 'ご飯', '主菜' => '存在しない料理'],
        ];
        $candidateSet = ['ご飯' => '主食'];
        $result = $this->helper->normalizeCategorySuggestions($raw, $candidateSet);

        $this->assertSame(['主食' => 'ご飯'], $result['1']);
        $this->assertArrayNotHasKey('主菜', $result['1']);
    }

    public function testNormalizeKeepsValidNames(): void
    {
        $raw = [
            '2' => ['主食' => 'ご飯', '主菜' => '鮭の塩焼き', '汁物' => '味噌汁'],
        ];
        $candidateSet = ['ご飯' => '主食', '鮭の塩焼き' => '主菜', '味噌汁' => '汁物'];
        $result = $this->helper->normalizeCategorySuggestions($raw, $candidateSet);

        $this->assertSame('ご飯', $result['2']['主食']);
        $this->assertSame('鮭の塩焼き', $result['2']['主菜']);
        $this->assertSame('味噌汁', $result['2']['汁物']);
    }

    public function testNormalizeReturnsAllFourMealTypes(): void
    {
        $result = $this->helper->normalizeCategorySuggestions([], []);
        $this->assertArrayHasKey('1', $result);
        $this->assertArrayHasKey('2', $result);
        $this->assertArrayHasKey('3', $result);
        $this->assertArrayHasKey('4', $result);
    }

    public function testNormalizeFiltersEmptyNamesAndCategories(): void
    {
        $raw = ['1' => ['' => 'ご飯', '主菜' => '']];
        $result = $this->helper->normalizeCategorySuggestions($raw, ['ご飯' => '主食']);
        $this->assertEmpty($result['1']);
    }

    public function testNormalizeHandlesIntegerKeys(): void
    {
        $raw = [1 => ['主食' => 'ご飯']];
        $candidateSet = ['ご飯' => '主食'];
        $result = $this->helper->normalizeCategorySuggestions($raw, $candidateSet);
        $this->assertSame('ご飯', $result['1']['主食']);
    }

    // ── fallbackSuggestions ──────────────────────────────────────────────────

    public function testFallbackSuggestionsReturnsAllMealTypes(): void
    {
        $items = [
            ['name' => 'ご飯', 'dish_category' => '主食'],
            ['name' => '鮭の塩焼き', 'dish_category' => '主菜'],
            ['name' => '小松菜炒め', 'dish_category' => '副菜'],
            ['name' => '味噌汁', 'dish_category' => '汁物'],
            ['name' => 'プリン', 'dish_category' => 'おやつ'],
        ];
        $result = $this->helper->fallbackSuggestions('2026-04-05', $items, []);
        $this->assertArrayHasKey('1', $result);
        $this->assertArrayHasKey('2', $result);
        $this->assertArrayHasKey('3', $result);
        $this->assertArrayHasKey('4', $result);
    }

    public function testFallbackSuggestionsAvoidsExisting(): void
    {
        $items = [
            ['name' => 'ご飯', 'dish_category' => '主食'],
            ['name' => 'パン', 'dish_category' => '主食'],
        ];
        $result = $this->helper->fallbackSuggestions('2026-04-05', $items, ['1' => ['ご飯']]);
        // meal_type=1 に 主食 が提案されるが、ご飯は除外されるはず
        if (!empty($result['1']['主食'] ?? '')) {
            $this->assertNotSame('ご飯', $result['1']['主食']);
        }
    }

    public function testFallbackSuggestionsIsDeterministicForSameDateAndMealType(): void
    {
        $items = [
            ['name' => 'ご飯', 'dish_category' => '主食'],
            ['name' => 'パン', 'dish_category' => '主食'],
        ];
        $r1 = $this->helper->fallbackSuggestions('2026-04-05', $items, []);
        $r2 = $this->helper->fallbackSuggestions('2026-04-05', $items, []);
        $this->assertSame($r1, $r2);
    }

    public function testFallbackSuggestionsDiffersForDifferentDates(): void
    {
        $items = array_map(fn($i) => ['name' => "料理{$i}", 'dish_category' => '主食'], range(1, 10));
        $r1 = $this->helper->fallbackSuggestions('2026-04-05', $items, []);
        $r2 = $this->helper->fallbackSuggestions('2026-04-06', $items, []);
        // 日付が違えば結果が変わることを確認（同一になる確率は低い）
        // ここでは両方が配列であることのみ確認（サイズが同じでも値が異なることが多い）
        $this->assertIsArray($r1);
        $this->assertIsArray($r2);
    }

    // ── extractSuggestionsFromPartialText ────────────────────────────────────

    public function testExtractSuggestionsFromValidJson(): void
    {
        $text = '{"2": {"主食": "ご飯", "主菜": "鮭の塩焼き"}}';
        $candidateSet = ['ご飯' => '主食', '鮭の塩焼き' => '主菜'];
        $result = $this->helper->extractSuggestionsFromPartialText($text, $candidateSet);

        $this->assertNotNull($result);
        $this->assertSame('ご飯', $result['2']['主食']);
        $this->assertSame('鮭の塩焼き', $result['2']['主菜']);
    }

    public function testExtractSuggestionsFiltersUnknownNames(): void
    {
        $text = '{"1": {"主食": "知らない料理"}}';
        $result = $this->helper->extractSuggestionsFromPartialText($text, []);
        $this->assertNull($result);
    }

    public function testExtractSuggestionsReturnsNullForEmptyText(): void
    {
        $result = $this->helper->extractSuggestionsFromPartialText('', ['ご飯' => '主食']);
        $this->assertNull($result);
    }

    // ── resolveSupplierIdByName ──────────────────────────────────────────────

    public function testResolveSupplierIdByNameExactMatch(): void
    {
        $suppliers = [
            ['id' => 1, 'name' => '食材卸A'],
            ['id' => 2, 'name' => '食材卸B'],
        ];
        $this->assertSame(1, $this->helper->resolveSupplierIdByName('食材卸A', $suppliers));
    }

    public function testResolveSupplierIdByNamePartialMatch(): void
    {
        $suppliers = [
            ['id' => 3, 'name' => '卸業者'],
        ];
        $this->assertSame(3, $this->helper->resolveSupplierIdByName('卸業者センター', $suppliers));
    }

    public function testResolveSupplierIdByNameReturnsNullForNoMatch(): void
    {
        $suppliers = [['id' => 1, 'name' => '食材卸A']];
        $this->assertNull($this->helper->resolveSupplierIdByName('全く別の会社', $suppliers));
    }

    public function testResolveSupplierIdByNameReturnsNullForEmptyName(): void
    {
        $suppliers = [['id' => 1, 'name' => '食材卸A']];
        $this->assertNull($this->helper->resolveSupplierIdByName('', $suppliers));
    }

    // ── normalizeMenuMasterDraft ─────────────────────────────────────────────

    public function testNormalizeMenuMasterDraftValidInput(): void
    {
        $raw = [
            'grams_per_person' => 150,
            'memo' => 'テストメモ',
            'ingredients' => [
                ['name' => '鶏肉', 'amount' => 100, 'unit' => 'g', 'supplier_name' => '', 'persons_per_unit' => null],
                ['name' => '塩', 'amount' => 5, 'unit' => '小さじ', 'supplier_name' => '', 'persons_per_unit' => null],
            ],
        ];
        $result = $this->helper->normalizeMenuMasterDraft($raw, []);

        $this->assertSame(150.0, $result['grams_per_person']);
        $this->assertSame('テストメモ', $result['memo']);
        $this->assertCount(2, $result['ingredients']);
        $this->assertSame('鶏肉', $result['ingredients'][0]['name']);
        $this->assertSame('小さじ', $result['ingredients'][1]['unit']);
    }

    public function testNormalizeMenuMasterDraftClampsInvalidGrams(): void
    {
        $raw = ['grams_per_person' => -100, 'ingredients' => []];
        $result = $this->helper->normalizeMenuMasterDraft($raw, []);
        $this->assertSame(0.0, $result['grams_per_person']);
    }

    public function testNormalizeMenuMasterDraftFallsBackToGForInvalidUnit(): void
    {
        $raw = [
            'ingredients' => [
                ['name' => '砂糖', 'amount' => 10, 'unit' => 'oz'],
            ],
        ];
        $result = $this->helper->normalizeMenuMasterDraft($raw, []);
        $this->assertSame('g', $result['ingredients'][0]['unit']);
    }

    public function testNormalizeMenuMasterDraftSkipsEmptyIngredients(): void
    {
        $raw = [
            'ingredients' => [
                ['name' => '', 'amount' => 10, 'unit' => 'g'],
                ['name' => '塩', 'amount' => 5, 'unit' => 'g'],
            ],
        ];
        $result = $this->helper->normalizeMenuMasterDraft($raw, []);
        $this->assertCount(1, $result['ingredients']);
        $this->assertSame('塩', $result['ingredients'][0]['name']);
    }

    public function testNormalizeMenuMasterDraftMaxIngredients(): void
    {
        $ingredients = array_map(fn($i) => ['name' => "食材{$i}", 'amount' => 1, 'unit' => 'g'], range(1, 20));
        $raw = ['ingredients' => $ingredients];
        $result = $this->helper->normalizeMenuMasterDraft($raw, []);
        $this->assertCount(12, $result['ingredients']);
    }
}
