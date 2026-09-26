'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { getMondayOf, parseDateStr, toDateStr } from './date'

/**
 * 画面の状態をURLに置く。
 *
 * state だけに持たせると、URLを送っても相手には今週が開くし、
 * 再読み込みで見ていた週に戻れない。保存のたびに読み直す画面では、
 * 保存するたび今週に飛ばされることになる。
 *
 * 履歴は replace で積む。週送りのたびに戻る先が増えると、
 * 「戻る」で画面から出られなくなるため。
 */
function useParamWriter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams?.toString() ?? '')
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === '') {
          next.delete(key)
        } else {
          next.set(key, value)
        }
      }
      const qs = next.toString()
      const base = pathname ?? ''
      router.replace(qs ? `${base}?${qs}` : base, { scroll: false })
    },
    [router, pathname, searchParams]
  )
}

/** 'YYYY-MM-DD' として妥当で、月曜日に正規化できるか */
function normalizeWeek(raw: string | null | undefined): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const d = parseDateStr(raw)
  if (Number.isNaN(d.getTime()) || toDateStr(d) !== raw) return null
  return getMondayOf(d)
}

/**
 * 週軸の画面で使う。`?week=YYYY-MM-DD` を読み書きする。
 *
 * 週の途中の日付を渡されてもその週の月曜に寄せる。
 * 壊れた値が来たら今週にする（画面が出ないより、今週が出るほうがよい）。
 */
export function useWeekParam(): [string, (next: string | ((prev: string) => string)) => void] {
  const searchParams = useSearchParams()
  const write = useParamWriter()

  const weekStart = normalizeWeek(searchParams?.get('week')) ?? getMondayOf(new Date())

  // useState と同じく関数も渡せるようにする。
  // 呼び出し側は setWeekStart((ws) => addWeeks(ws, -1)) と書きたい
  const setWeekStart = useCallback(
    (next: string | ((prev: string) => string)) => {
      write({ week: typeof next === 'function' ? next(weekStart) : next })
    },
    [write, weekStart]
  )

  return [weekStart, setWeekStart]
}

/** 月軸の画面で使う。`?year=YYYY&month=M` を読み書きする。 */
export function useMonthParam(): [{ year: number; month: number }, (y: number, m: number) => void] {
  const searchParams = useSearchParams()
  const write = useParamWriter()
  const today = new Date()

  const rawYear = Number(searchParams?.get('year'))
  const rawMonth = Number(searchParams?.get('month'))
  const valid =
    Number.isInteger(rawYear) && rawYear >= 2000 && rawYear <= 2100 &&
    Number.isInteger(rawMonth) && rawMonth >= 1 && rawMonth <= 12

  const value = valid
    ? { year: rawYear, month: rawMonth }
    : { year: today.getFullYear(), month: today.getMonth() + 1 }

  const setMonth = useCallback(
    (y: number, m: number) => write({ year: String(y), month: String(m) }),
    [write]
  )

  return [value, setMonth]
}

/** 絞り込みなど、そのままの文字列を1つ置きたいとき */
export function useStringParam(key: string, fallback = ''): [string, (next: string) => void] {
  const searchParams = useSearchParams()
  const write = useParamWriter()

  const value = searchParams?.get(key) ?? fallback
  const setValue = useCallback((next: string) => write({ [key]: next || null }), [write, key])

  return [value, setValue]
}
