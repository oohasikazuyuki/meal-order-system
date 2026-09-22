<?php
namespace App\Utility;

use DateTime;

/**
 * 日本の祝日。内閣府の「国民の祝日について」の規定どおりに計算する。
 *
 * フロント側の frontend/src/app/_lib/holiday.ts と同じ規則。
 * 画面とPDFで祝日の扱いがずれると現場が混乱するため、両方そろえて直すこと。
 *
 * 対応範囲は 2023年以降。2020〜2022年は五輪にともなう臨時の移動があり、
 * この計算には含めていない（過去分の献立表を出す運用はない）。
 */
class JapaneseHoliday
{
    /** [月, 日, 名前] */
    private const FIXED = [
        [1, 1, '元日'],
        [2, 11, '建国記念の日'],
        [2, 23, '天皇誕生日'],
        [4, 29, '昭和の日'],
        [5, 3, '憲法記念日'],
        [5, 4, 'みどりの日'],
        [5, 5, 'こどもの日'],
        [8, 11, '山の日'],
        [11, 3, '文化の日'],
        [11, 23, '勤労感謝の日'],
    ];

    /** ハッピーマンデー [月, 第n, 名前] */
    private const NTH_MONDAY = [
        [1, 2, '成人の日'],
        [7, 3, '海の日'],
        [9, 3, '敬老の日'],
        [10, 2, 'スポーツの日'],
    ];

    /** @var array<int, array<string, string>> 年ごとのキャッシュ */
    private static array $cache = [];

    /** 祝日なら名前を返す。祝日でなければ null */
    public static function name(DateTime $date): ?string
    {
        $year = (int)$date->format('Y');
        if (!isset(self::$cache[$year])) {
            self::$cache[$year] = self::buildYear($year);
        }
        return self::$cache[$year][$date->format('Y-m-d')] ?? null;
    }

    /** 土日または祝日 */
    public static function isClosed(DateTime $date): bool
    {
        $dow = (int)$date->format('w');
        return $dow === 0 || $dow === 6 || self::name($date) !== null;
    }

    /** @return array<string, string> 'Y-m-d' => 祝日名 */
    private static function buildYear(int $year): array
    {
        $days = [];

        foreach (self::FIXED as [$m, $d, $name]) {
            $days[sprintf('%04d-%02d-%02d', $year, $m, $d)] = $name;
        }
        foreach (self::NTH_MONDAY as [$m, $nth, $name]) {
            $days[self::nthMonday($year, $m, $nth)] = $name;
        }
        $days[self::equinox($year, 3, 20.8431)] = '春分の日';
        $days[self::equinox($year, 9, 23.2488)] = '秋分の日';

        // 振替休日：祝日が日曜と重なったら、次の平日を休みにする
        foreach (array_keys($days) as $key) {
            $d = new DateTime($key);
            if ((int)$d->format('w') !== 0) {
                continue;
            }
            do {
                $d->modify('+1 day');
            } while (isset($days[$d->format('Y-m-d')]));
            $days[$d->format('Y-m-d')] = '振替休日';
        }

        // 国民の休日：祝日に前後をはさまれた平日（9月の敬老の日と秋分の日の間など）
        foreach (array_keys($days) as $key) {
            $next = (new DateTime($key))->modify('+2 days');
            if (!isset($days[$next->format('Y-m-d')])) {
                continue;
            }
            $between = (new DateTime($key))->modify('+1 day');
            $bkey    = $between->format('Y-m-d');
            if ((int)$between->format('w') === 0 || isset($days[$bkey])) {
                continue;
            }
            $days[$bkey] = '国民の休日';
        }

        ksort($days);
        return $days;
    }

    private static function nthMonday(int $year, int $month, int $nth): string
    {
        $first  = new DateTime(sprintf('%04d-%02d-01', $year, $month));
        $offset = (8 - (int)$first->format('w')) % 7; // 1日から最初の月曜までの日数
        return $first->modify('+' . ($offset + ($nth - 1) * 7) . ' days')->format('Y-m-d');
    }

    /**
     * 春分・秋分の日。
     * 天文計算の近似式で、1980〜2099年の範囲で官報の確定日と一致する。
     */
    private static function equinox(int $year, int $month, float $base): string
    {
        $day = (int)floor($base + 0.242194 * ($year - 1980) - intdiv($year - 1980, 4));
        return sprintf('%04d-%02d-%02d', $year, $month, $day);
    }
}
