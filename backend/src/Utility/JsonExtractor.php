<?php
declare(strict_types=1);

namespace App\Utility;

/**
 * AIの返答から JSON を取り出す。
 *
 * モデルは「JSONだけ返せ」と指示しても前後に文章を付けることがある。
 * openrouter/free は毎回ちがうモデルに回されるので、素直に返すモデルと
 * 思考を書いてから返すモデルが混ざる。
 *
 * 最初の { から最後の } までを取る方法だと、前置きの文章に波括弧が
 * 1つでもあれば対応が崩れて全部失敗する。実際に「豚汁」の下書きが
 * これで落ちていた。括弧の対応を数えて、本物の JSON だけを取り出す。
 */
class JsonExtractor
{
    /**
     * 文字列から JSON オブジェクトを取り出す。
     *
     * @return array<mixed>|null
     */
    public static function object(string $text): ?array
    {
        $decoded = json_decode(trim($text), true);
        if (is_array($decoded)) {
            return $decoded;
        }

        // ```json ... ``` で囲ってくるモデルがある。中身を先に試す
        if (preg_match_all('/```(?:json)?\s*([\s\S]*?)```/i', $text, $m)) {
            foreach ($m[1] as $block) {
                $decoded = json_decode(trim($block), true);
                if (is_array($decoded)) {
                    return $decoded;
                }
            }
        }

        $best = null;
        $bestSize = -1;
        foreach (self::balancedObjects($text) as $candidate) {
            $decoded = json_decode($candidate, true);
            if (!is_array($decoded)) {
                continue;
            }
            // 思考文の中の例と、本物の返答が両方取れることがある。
            // 中身が多いほうが本物（例は項目を省いて書かれる）
            $size = count($decoded, COUNT_RECURSIVE);
            if ($size >= $bestSize) {
                $best = $decoded;
                $bestSize = $size;
            }
        }
        return $best;
    }

    /**
     * 対応の取れた {...} を、外側のものだけ順に返す。
     *
     * 文字列リテラルの中の波括弧は数えない（"memo": "{あとで}" で崩れるため）。
     *
     * @return list<string>
     */
    private static function balancedObjects(string $text): array
    {
        $out = [];
        $len = strlen($text);
        $depth = 0;
        $start = -1;
        $inString = false;
        $escaped = false;

        for ($i = 0; $i < $len; $i++) {
            $ch = $text[$i];

            if ($inString) {
                if ($escaped) {
                    $escaped = false;
                } elseif ($ch === '\\') {
                    $escaped = true;
                } elseif ($ch === '"') {
                    $inString = false;
                }
                continue;
            }

            if ($ch === '"') {
                $inString = true;
                continue;
            }
            if ($ch === '{') {
                if ($depth === 0) {
                    $start = $i;
                }
                $depth++;
                continue;
            }
            if ($ch === '}' && $depth > 0) {
                $depth--;
                if ($depth === 0 && $start >= 0) {
                    $out[] = substr($text, $start, $i - $start + 1);
                    $start = -1;
                }
            }
        }
        return $out;
    }
}
