import type { MenuTableIngredient } from './api/client'

function formatAmount(amount: number): string {
  return amount % 1 === 0 ? String(amount) : amount.toFixed(2)
}

/** 総量の文字列。1000g以上はkgにする（PHP側の fmtQty と同じ規則） */
export function formatQty(amount: number, unit: string): string {
  if (amount <= 0) return ''
  if (unit === 'g' && amount >= 1000) return `${formatAmount(amount / 1000)}kg`
  return `${formatAmount(amount)}${unit}`
}

/**
 * 献立表の数量の表示。
 *
 * 食数が未入力の日は総量が0になる。空欄のままだと「要らない材料」なのか
 * 「食数をまだ入れていない」のか紙を見た人に区別が付かないので、
 * 代わりに1人あたりの分量を出す（例: 70g/人、1本/20人）。
 * 掛け算の元が分かれば、人数が決まったときにその場で出せる。
 */
export function qtyLabel(
  ing: Pick<MenuTableIngredient, 'amount' | 'unit' | 'head_count' | 'per_person' | 'persons_per_unit'>
): { text: string; perPerson: boolean } {
  if (ing.head_count > 0) return { text: formatQty(ing.amount, ing.unit), perPerson: false }
  if (ing.persons_per_unit > 0) {
    return { text: `1${ing.unit}/${ing.persons_per_unit}人`, perPerson: true }
  }
  if (ing.per_person <= 0) return { text: '', perPerson: false }
  return { text: `${formatQty(ing.per_person, ing.unit)}/人`, perPerson: true }
}
