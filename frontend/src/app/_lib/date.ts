// 日付ユーティリティ（すべてローカルタイム。ISO変換によるタイムゾーンずれを避ける）

export const DOW = ['日', '月', '火', '水', '木', '金', '土']
export const DOW_MON_FIRST = ['月', '火', '水', '木', '金', '土', '日']

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayStr(): string {
  return toDateStr(new Date())
}

/** その日を含む週の月曜日 */
export function getMondayOf(date: Date | string): string {
  const d = typeof date === 'string' ? parseDateStr(date) : new Date(date)
  const dow = d.getDay() === 0 ? 7 : d.getDay()
  d.setDate(d.getDate() - (dow - 1))
  return toDateStr(d)
}

export function addDays(dateStr: string, n: number): string {
  const d = parseDateStr(dateStr)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

export function addWeeks(dateStr: string, n: number): string {
  return addDays(dateStr, n * 7)
}

export function getWeekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

/** 8/5(火) */
export function formatShort(dateStr: string): string {
  const d = parseDateStr(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}(${DOW[d.getDay()]})`
}

/** 2026年8月5日（火曜日） */
export function formatLong(dateStr: string): string {
  const d = parseDateStr(dateStr)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${DOW[d.getDay()]}曜日）`
}

/** 8月5日(火) */
export function formatMedium(dateStr: string): string {
  const d = parseDateStr(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日(${DOW[d.getDay()]})`
}
