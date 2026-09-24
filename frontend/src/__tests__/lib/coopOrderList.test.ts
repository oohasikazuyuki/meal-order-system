import { describe, it, expect } from 'vitest'
import {
  buildOrderLines,
  toOrderCodeText,
  linesWithoutCode,
  toReadableText,
  type EditedItem,
} from '@/app/_lib/coopOrderList'
import type { CoopItem } from '@/app/_lib/api/client'

const egg: CoopItem = {
  id: 1, name: '卵', order_code: '123456', unit: 'パック', order_type: 'weekly', sort_order: 10,
}
const milk: CoopItem = {
  id: 2, name: '牛乳', order_code: null, unit: '本', order_type: 'weekly', sort_order: 20,
}
const rice: CoopItem = {
  id: 3, name: '冷凍チャーハン', order_code: '789012', unit: '袋', order_type: 'daily', sort_order: 30,
}

const edited: Record<number, EditedItem> = {
  1: { quantity: 30, notes: '月曜納品', daily: {} },
  2: { quantity: 44, notes: '', daily: {} },
  3: { quantity: 0, notes: '', daily: { '2026-09-22': 8, '2026-09-25': 8, '2026-09-23': 0 } },
}

const all = new Set([1, 2, 3])

describe('buildOrderLines', () => {
  it('選んだ品目だけを返す', () => {
    const lines = buildOrderLines([egg, milk, rice], edited, new Set([1]))
    expect(lines.map((l) => l.name)).toEqual(['卵'])
  })

  it('日ごとの品目は週合計にまとめる', () => {
    const lines = buildOrderLines([rice], edited, all)
    expect(lines[0].quantity).toBe(16)
  })

  it('数量0の行は出さない', () => {
    const zero = { ...edited, 1: { quantity: 0, notes: '', daily: {} } }
    const lines = buildOrderLines([egg, milk], zero, all)
    expect(lines.map((l) => l.name)).toEqual(['牛乳'])
  })

  it('日ごとの品目が全日0なら出さない', () => {
    const zero = { ...edited, 3: { quantity: 0, notes: '', daily: { '2026-09-22': 0 } } }
    expect(buildOrderLines([rice], zero, all)).toEqual([])
  })
})

describe('toOrderCodeText', () => {
  it('注文コードと数量をタブ区切りで並べる', () => {
    const lines = buildOrderLines([egg, rice], edited, all)
    expect(toOrderCodeText(lines)).toBe('123456\t30\n789012\t16')
  })

  it('注文コード未登録の品目は含めない', () => {
    const lines = buildOrderLines([egg, milk], edited, all)
    expect(toOrderCodeText(lines)).toBe('123456\t30')
  })
})

describe('linesWithoutCode', () => {
  it('コードがない行だけを返す', () => {
    const lines = buildOrderLines([egg, milk], edited, all)
    expect(linesWithoutCode(lines).map((l) => l.name)).toEqual(['牛乳'])
  })
})

describe('toReadableText', () => {
  it('コード未登録が分かる控えを作る', () => {
    const lines = buildOrderLines([egg, milk], edited, all)
    const text = toReadableText(lines, '2026-09-21', '2026-09-27')
    expect(text).toContain('123456　卵　30パック')
    expect(text).toContain('（コード未登録）　牛乳　44本')
  })
})
