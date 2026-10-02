'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Supplier } from './api/client'

const STORAGE_KEY = 'ai_supplier_ids'

/**
 * AIに材料を作らせるとき、どの仕入先から選ばせるか。
 *
 * どの店が何を扱うかは施設ごと・店ごとに違い、AIには分からない。
 * 推測させると「だし汁をスーパーで頼む」のような、その施設では
 * 成り立たない割り振りが混ざる。人が選んだ範囲からだけ選ばせる。
 *
 * 選び直すのは店が変わったときくらいなので、選択は端末に覚えさせる。
 * 毎回選ばせると、結局いつも同じものを選ぶだけの手間になる。
 */
export function useAiSuppliers(suppliers: Supplier[]) {
  const [ids, setIds] = useState<number[] | null>(null)

  // 初回だけ読み出す。保存が無ければ全部を対象にする（これまでの動き）
  useEffect(() => {
    if (ids !== null || suppliers.length === 0) return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed: number[] = JSON.parse(saved)
        const alive = parsed.filter((id) => suppliers.some((s) => s.id === id))
        if (alive.length > 0) {
          setIds(alive)
          return
        }
      }
    } catch {
      /* 壊れていたら既定に戻すだけ */
    }
    setIds(suppliers.map((s) => s.id))
  }, [suppliers, ids])

  const toggle = useCallback((id: number) => {
    setIds((prev) => {
      const next = (prev ?? []).includes(id)
        ? (prev ?? []).filter((x) => x !== id)
        : [...(prev ?? []), id]
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* 保存できなくても今回の生成には使える */
      }
      return next
    })
  }, [])

  return { selectedIds: ids ?? [], toggle, ready: ids !== null }
}
