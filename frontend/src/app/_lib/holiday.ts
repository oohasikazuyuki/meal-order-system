// 日本の祝日。内閣府の「国民の祝日について」の規定どおりに計算する。
// 外部APIも追加ライブラリも使わない（発注業務はネットが不安定でも止められない）。
//
// 対応範囲は 2023年以降。2020〜2022年は五輪にともなう臨時の移動があり、
// この計算には含めていない（過去分をさかのぼって表示する画面はない）。

import { toDateStr, parseDateStr } from './date'

const FIXED: Array<[month: number, day: number, name: string]> = [
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
]

/** ハッピーマンデー。[月, 第n, 名前] */
const NTH_MONDAY: Array<[month: number, nth: number, name: string]> = [
  [1, 2, '成人の日'],
  [7, 3, '海の日'],
  [9, 3, '敬老の日'],
  [10, 2, 'スポーツの日'],
]

/** 月の第n月曜日 */
function nthMonday(year: number, month: number, nth: number): Date {
  const first = new Date(year, month - 1, 1)
  const offset = (8 - first.getDay()) % 7 // 1日から最初の月曜までの日数
  return new Date(year, month - 1, 1 + offset + (nth - 1) * 7)
}

/**
 * 春分・秋分の日。
 * 天文計算の近似式で、1980〜2099年の範囲で官報の確定日と一致する。
 */
function equinoxDay(year: number, base: number): number {
  return Math.floor(base + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))
}

const cache = new Map<number, Map<string, string>>()

function buildYear(year: number): Map<string, string> {
  const days = new Map<string, string>()
  const put = (d: Date, name: string) => days.set(toDateStr(d), name)

  for (const [m, d, name] of FIXED) put(new Date(year, m - 1, d), name)
  for (const [m, nth, name] of NTH_MONDAY) put(nthMonday(year, m, nth), name)
  put(new Date(year, 2, equinoxDay(year, 20.8431)), '春分の日')
  put(new Date(year, 8, equinoxDay(year, 23.2488)), '秋分の日')

  // 振替休日：祝日が日曜と重なったら、次の平日を休みにする
  for (const key of [...days.keys()]) {
    const d = parseDateStr(key)
    if (d.getDay() !== 0) continue
    const sub = new Date(d)
    do {
      sub.setDate(sub.getDate() + 1)
    } while (days.has(toDateStr(sub)))
    put(sub, '振替休日')
  }

  // 国民の休日：祝日に前後をはさまれた平日（9月の敬老の日と秋分の日の間など）
  for (const key of [...days.keys()]) {
    const next = parseDateStr(key)
    next.setDate(next.getDate() + 2)
    if (!days.has(toDateStr(next))) continue
    const between = parseDateStr(key)
    between.setDate(between.getDate() + 1)
    if (between.getDay() === 0 || days.has(toDateStr(between))) continue
    put(between, '国民の休日')
  }

  return days
}

/** 祝日なら名前を返す。祝日でなければ null。dateStr は 'YYYY-MM-DD' */
export function getHoliday(dateStr: string): string | null {
  const year = Number(dateStr.slice(0, 4))
  if (!year) return null
  let days = cache.get(year)
  if (!days) {
    days = buildYear(year)
    cache.set(year, days)
  }
  return days.get(dateStr) ?? null
}

/** 土日または祝日。発注が動かない日の判定に使う */
export function isClosedDay(dateStr: string): boolean {
  const dow = parseDateStr(dateStr).getDay()
  return dow === 0 || dow === 6 || getHoliday(dateStr) !== null
}
