import { describe, it, expect } from 'vitest'
import { formatQty, qtyLabel } from '@/app/_lib/menuQty'

const ing = (o: Partial<Parameters<typeof qtyLabel>[0]>) => ({
  amount: 0, unit: 'g', head_count: 0, per_person: 0, persons_per_unit: 0, ...o,
})

describe('formatQty', () => {
  it('1000g以上はkgにする（PHP側の fmtQty と同じ規則）', () => {
    expect(formatQty(5880, 'g')).toBe('5.88kg')
    expect(formatQty(999, 'g')).toBe('999g')
    expect(formatQty(2000, 'g')).toBe('2kg')
  })

  it('g以外の単位はkgにしない', () => {
    expect(formatQty(1200, 'ml')).toBe('1200ml')
  })

  it('0以下は空にする', () => {
    expect(formatQty(0, 'g')).toBe('')
    expect(formatQty(-1, 'g')).toBe('')
  })
})

describe('qtyLabel', () => {
  it('食数が入っていれば総量を出す', () => {
    expect(qtyLabel(ing({ amount: 3570, unit: 'g', head_count: 42 })))
      .toEqual({ text: '3.57kg', perPerson: false })
  })

  // 献立表は翌週分を先に刷るので、食数がまだ入っていない日のほうが多い。
  // ここが空欄だと「要らない材料」と読まれて発注から漏れる。
  it('食数が未入力なら1人あたりを出す', () => {
    expect(qtyLabel(ing({ unit: 'g', per_person: 70 })))
      .toEqual({ text: '70g/人', perPerson: true })
  })

  it('「n人で1単位」の材料は人数のほうを出す', () => {
    expect(qtyLabel(ing({ unit: '本', per_person: 1, persons_per_unit: 20 })))
      .toEqual({ text: '1本/20人', perPerson: true })
  })

  it('1人あたりも分からなければ空にする', () => {
    expect(qtyLabel(ing({}))).toEqual({ text: '', perPerson: false })
  })
})
