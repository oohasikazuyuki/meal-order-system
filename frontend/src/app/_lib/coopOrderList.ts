import type { CoopItem } from './api/client'
import { formatShort } from './date'

/** 発注リストに出す1行 */
export interface CoopOrderLine {
  itemId: number
  name: string
  orderCode: string | null
  unit: string
  quantity: number
  /** 日ごとの品目のみ。どの日のぶんか */
  date: string | null
}

export interface EditedItem {
  quantity: number
  notes: string
  daily: Record<string, number>
}

/**
 * 入力済みの数量から、生協に出す行だけを取り出す。
 *
 * 0 は出さない。数量0の行を並べても、eふれんずに打ち込むときに
 * 目で飛ばす手間が増えるだけで、間違いのもとになる。
 *
 * 日ごとの品目は週合計にまとめる。eふれんずは1回の注文が1配達ぶんで、
 * 日別に分けて注文する仕組みがないため。
 */
export function buildOrderLines(
  items: CoopItem[],
  edited: Record<number, EditedItem>,
  selected: Set<number>
): CoopOrderLine[] {
  const lines: CoopOrderLine[] = []

  for (const item of items) {
    if (!selected.has(item.id)) continue
    const e = edited[item.id]
    if (!e) continue

    const quantity =
      item.order_type === 'daily'
        ? Object.values(e.daily ?? {}).reduce((sum, v) => sum + (v || 0), 0)
        : e.quantity || 0

    if (quantity <= 0) continue

    lines.push({
      itemId: item.id,
      name: item.name,
      orderCode: item.order_code,
      unit: item.unit,
      quantity,
      date: null,
    })
  }

  return lines
}

/**
 * eふれんずの「注文コードでご注文」に貼る形にする。
 * コードと数量をタブ区切りで1行ずつ。
 *
 * 注文コードが未登録の品目は貼っても通らないので、ここには含めない。
 * 含める/含めないの判断は呼び出し側で出し分けられるよう、別関数にしてある。
 */
export function toOrderCodeText(lines: CoopOrderLine[]): string {
  return lines
    .filter((l) => l.orderCode)
    .map((l) => `${l.orderCode}\t${l.quantity}`)
    .join('\n')
}

/** 注文コードが未登録で、手で探すしかない行 */
export function linesWithoutCode(lines: CoopOrderLine[]): CoopOrderLine[] {
  return lines.filter((l) => !l.orderCode)
}

/** 人が読む控え。印刷や共有に使う */
export function toReadableText(lines: CoopOrderLine[], weekStart: string, weekEnd: string): string {
  const header = `生協発注　${formatShort(weekStart)} 〜 ${formatShort(weekEnd)}`
  const body = lines.map((l) => {
    const code = l.orderCode ? `${l.orderCode}　` : '（コード未登録）　'
    return `${code}${l.name}　${l.quantity}${l.unit}`
  })
  return [header, ...body].join('\n')
}
