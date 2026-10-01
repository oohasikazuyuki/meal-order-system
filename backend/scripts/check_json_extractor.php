#!/usr/bin/env php
<?php
declare(strict_types=1);

/**
 * AI返答からのJSON取り出しの自己確認。
 *
 * ここが壊れると、AIは正しく答えているのに「生成に失敗しました」になる。
 * 画面上は AI の不調に見えるので、原因にたどり着くまでが長い。
 */

require __DIR__ . '/../vendor/autoload.php';

use App\Utility\JsonExtractor;

$failures = 0;
$checked  = 0;

function check(string $label, ?array $actual, ?array $expected): void
{
    global $failures, $checked;
    $checked++;
    if ($actual !== $expected) {
        $failures++;
        echo "NG  {$label}\n";
        echo "    期待: " . json_encode($expected, JSON_UNESCAPED_UNICODE) . "\n";
        echo "    実際: " . json_encode($actual, JSON_UNESCAPED_UNICODE) . "\n";
        return;
    }
    echo "ok  {$label}\n";
}

check(
    'そのままのJSON',
    JsonExtractor::object('{"a":1}'),
    ['a' => 1]
);

check(
    'コードフェンス付き',
    JsonExtractor::object("説明します。\n```json\n{\"a\":1,\"b\":2}\n```\n以上です。"),
    ['a' => 1, 'b' => 2]
);

check(
    '前置きの文章あり',
    JsonExtractor::object('出力します。 {"grams_per_person":180,"ingredients":[]}'),
    ['grams_per_person' => 180, 'ingredients' => []]
);

// これが実際に落ちていたパターン。思考文に波括弧が混ざると、
// 最初の { から最後の } までを取る方法では対応が崩れる
check(
    '思考文に波括弧が混ざる',
    JsonExtractor::object(
        'The user wants JSON like {name, amount}. ' .
        "Let me think.\n" .
        '{"grams_per_person":180,"memo":"","ingredients":[{"name":"豚バラ","amount":30,"unit":"g"}]}'
    ),
    [
        'grams_per_person' => 180,
        'memo' => '',
        'ingredients' => [['name' => '豚バラ', 'amount' => 30, 'unit' => 'g']],
    ]
);

check(
    '文字列の中の波括弧で崩れない',
    JsonExtractor::object('{"memo":"あとで{確認}する","a":1}'),
    ['memo' => 'あとで{確認}する', 'a' => 1]
);

check(
    'エスケープされた引用符で崩れない',
    JsonExtractor::object('{"memo":"\"特売\"のとき","a":1}'),
    ['memo' => '"特売"のとき', 'a' => 1]
);

check(
    'JSONが無ければ null',
    JsonExtractor::object('申し訳ありませんが生成できません。'),
    null
);

check(
    '壊れたJSONは null',
    JsonExtractor::object('{"a":1,}{'),
    null
);

echo "\n{$checked}件を確認、NG {$failures}件\n";
exit($failures === 0 ? 0 : 1);
