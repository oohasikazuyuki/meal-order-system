'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  fetchBlockOrderQuantities,
  saveBlockOrderQuantities,
  fetchSuppliers,
  fetchOrderSheetPdf,
  MEAL_TYPE_LABELS,
  type MealType,
  type BlockWithQuantities,
  type BlockQuantityRow,
  type Supplier,
} from '../_lib/api/client'
import { getMondayOf, addWeeks, getWeekDates, formatShort, formatLong } from '../_lib/date'
import WeekBar, { type DayState } from './WeekBar'

interface MealEdit {
  room1_kamaho_count: number
  room2_kamaho_count: number
  order_quantity: number
  notes: string
}

interface DayEditState {
  [blockId: number]: { [mealType: number]: MealEdit }
}
type WeekData = { [dateStr: string]: BlockWithQuantities[] }
type WeekEditState = { [dateStr: string]: DayEditState }

export default function DailyOrderForm() {
  const [weekStart, setWeekStart] = useState<string>(() => getMondayOf(new Date()))
  const [activeDay, setActiveDay] = useState<number>(0)
  const [weekData, setWeekData] = useState<WeekData>({})
  const [weekEditState, setWeekEditState] = useState<WeekEditState>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null) // dateStr または 'all'
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [showPrintMenu, setShowPrintMenu] = useState(false)
  const [downloading, setDownloading] = useState<number | null>(null)

  const weekDates = getWeekDates(weekStart)

  // loadWeek を作り直さずに現在の曜日を参照するための控え
  const activeDayRef = useRef(activeDay)
  useEffect(() => {
    activeDayRef.current = activeDay
  }, [activeDay])

  const loadWeek = useCallback(async (ws: string) => {
    setLoading(true)
    setError(null)
    setSuccessMsg(null)

    const dates = getWeekDates(ws)
    // 週を切り替えたら前の週の値は捨てる（未取得と空を取り違えないため）
    setWeekData({})
    setWeekEditState({})

    const apply = (ds: string, blocks: BlockWithQuantities[]) => {
      setWeekData((prev) => ({ ...prev, [ds]: blocks }))
      const state: DayEditState = {}
      for (const block of blocks) {
        state[block.id] = {}
        for (const q of block.quantities) {
          state[block.id][q.meal_type] = {
            room1_kamaho_count: q.room1_kamaho_count,
            room2_kamaho_count: q.room2_kamaho_count,
            order_quantity: q.order_quantity,
            notes: q.notes,
          }
        }
      }
      setWeekEditState((prev) => ({ ...prev, [ds]: state }))
    }

    // 表示中の日を先に取って描画する。残り6日は続けて読み込む。
    // 7日分を一度に投げると、連携先が遅いときに全部そろうまで何も出せない。
    const firstIdx = Math.min(Math.max(activeDayRef.current, 0), 6)
    try {
      const first = await fetchBlockOrderQuantities(dates[firstIdx])
      apply(dates[firstIdx], first.data.blocks)
    } catch {
      setError('この週の食数を読み込めませんでした。通信を確認して、もう一度お試しください。')
      setLoading(false)
      return
    }
    setLoading(false)

    const rest = dates.filter((_, i) => i !== firstIdx)
    const results = await Promise.allSettled(rest.map((d) => fetchBlockOrderQuantities(d)))
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') apply(rest[i], r.value.data.blocks)
    })
  }, [])

  useEffect(() => {
    loadWeek(weekStart)
  }, [weekStart, loadWeek])

  useEffect(() => {
    fetchSuppliers()
      .then((res) => setSuppliers(res.data.suppliers))
      .catch(() => {})
  }, [])

  const handlePrintPdf = async (supplier: Supplier) => {
    setDownloading(supplier.id)
    setShowPrintMenu(false)
    setError(null)
    try {
      // days を空で送ると、バックエンドが対象週の食材をDBから取得する
      const res = await fetchOrderSheetPdf(weekStart, supplier.id, {})
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const win = window.open(url, '_blank')
      if (!win) {
        // ポップアップがブロックされた場合はダウンロードに切り替える
        const a = document.createElement('a')
        a.href = url
        a.download = `${supplier.name}_${weekStart}週.pdf`
        a.click()
      }
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch {
      setError(`${supplier.name}の発注書を作成できませんでした。もう一度お試しください。`)
    } finally {
      setDownloading(null)
    }
  }

  const updateEditState = (
    dateStr: string,
    blockId: number,
    mealType: MealType,
    patch: Partial<MealEdit>
  ) => {
    setWeekEditState((prev) => ({
      ...prev,
      [dateStr]: {
        ...prev[dateStr],
        [blockId]: {
          ...prev[dateStr]?.[blockId],
          [mealType]: { ...prev[dateStr]?.[blockId]?.[mealType], ...patch },
        },
      },
    }))
  }

  const buildItems = (dateStr: string) => {
    const blocks = weekData[dateStr] ?? []
    const es = weekEditState[dateStr] ?? {}
    return blocks.flatMap((block) =>
      block.quantities.map((q) => ({
        block_id: block.id,
        meal_type: q.meal_type,
        room1_kamaho_count: es[block.id]?.[q.meal_type]?.room1_kamaho_count ?? q.room1_kamaho_count,
        room2_kamaho_count: es[block.id]?.[q.meal_type]?.room2_kamaho_count ?? q.room2_kamaho_count,
        order_quantity: es[block.id]?.[q.meal_type]?.order_quantity ?? q.order_quantity,
        notes: es[block.id]?.[q.meal_type]?.notes ?? q.notes,
      }))
    )
  }

  const handleSaveDay = async (dateStr: string) => {
    setSaving(dateStr)
    setError(null)
    setSuccessMsg(null)
    try {
      await saveBlockOrderQuantities({ order_date: dateStr, items: buildItems(dateStr) })
      await loadWeek(weekStart)
      setSuccessMsg(`${formatShort(dateStr)} を保存しました`)
    } catch {
      setError('保存できませんでした。入力値を確認して、もう一度お試しください。')
    } finally {
      setSaving(null)
    }
  }

  const handleSaveAll = async () => {
    setSaving('all')
    setError(null)
    setSuccessMsg(null)
    try {
      for (const dateStr of weekDates) {
        const items = buildItems(dateStr)
        if (items.length > 0) {
          await saveBlockOrderQuantities({ order_date: dateStr, items })
        }
      }
      await loadWeek(weekStart)
      setSuccessMsg('この週をすべて保存しました')
    } catch {
      setError('保存できませんでした。入力値を確認して、もう一度お試しください。')
    } finally {
      setSaving(null)
    }
  }

  const activeDateStr = weekDates[activeDay]
  const activeBlocks = weekData[activeDateStr] // undefined = まだ取得していない
  const activeEditState = weekEditState[activeDateStr] ?? {}

  const dayState = (ds: string): DayState => {
    const blocks = weekData[ds] ?? []
    if (blocks.length === 0) return 'none'
    return blocks.every((b) => b.quantities.every((q) => q.saved_id !== null)) ? 'saved' : 'none'
  }

  return (
    <div>
      <WeekBar
        weekStart={weekStart}
        onPrev={() => setWeekStart((ws) => addWeeks(ws, -1))}
        onNext={() => setWeekStart((ws) => addWeeks(ws, 1))}
        onThisWeek={() => setWeekStart(getMondayOf(new Date()))}
        activeIndex={activeDay}
        onSelectDay={(i) => setActiveDay(i)}
        dayState={dayState}
        busy={loading}
        tools={
          <>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleSaveAll}
              disabled={saving !== null || loading}
            >
              {saving === 'all' ? '保存しています' : '週をまとめて保存'}
            </button>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setShowPrintMenu((v) => !v)}
                disabled={downloading !== null || suppliers.length === 0}
                aria-expanded={showPrintMenu}
              >
                {downloading !== null ? '発注書を作成中' : '発注書を出す'}
              </button>
              {showPrintMenu && suppliers.length > 0 && (
                <>
                  <div
                    onClick={() => setShowPrintMenu(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                  />
                  <div className="menulist">
                    <p className="menulist__label" style={{ margin: 0 }}>
                      どの仕入先の発注書ですか
                    </p>
                    {suppliers.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="menulist__item"
                        onClick={() => handlePrintPdf(s)}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        }
      />

      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      {successMsg && <p className="notice notice--ok">{successMsg}</p>}

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '0.8rem',
          marginBottom: '0.7rem',
        }}
      >
        <h2 style={{ fontSize: 'var(--fs-lg)' }}>{formatLong(activeDateStr)}</h2>
        <button
          type="button"
          className="btn"
          onClick={() => handleSaveDay(activeDateStr)}
          disabled={saving !== null || loading || !activeBlocks?.length}
        >
          {saving === activeDateStr ? '保存しています' : 'この日を保存'}
        </button>
      </div>

      {loading || activeBlocks === undefined ? (
        <p className="empty">読み込んでいます</p>
      ) : activeBlocks.length === 0 ? (
        <div className="sheet">
          <div className="empty">
            <p>この日に入力できるブロックがありません。</p>
            <a className="btn" href="/master">
              ブロックを登録する
            </a>
          </div>
        </div>
      ) : (
        activeBlocks.map((block) => (
          <BlockSheet
            key={block.id}
            block={block}
            editState={activeEditState[block.id] ?? {}}
            onRoomCountChange={(mt, room, v) => {
              const cur = activeEditState[block.id]?.[mt]
              if (!cur) return
              const num = parseInt(v, 10)
              const next = isNaN(num) ? 0 : Math.max(0, num)
              const prevTotal = cur.room1_kamaho_count + cur.room2_kamaho_count
              const patch: Partial<MealEdit> =
                room === 1 ? { room1_kamaho_count: next } : { room2_kamaho_count: next }
              const newTotal =
                room === 1 ? next + cur.room2_kamaho_count : cur.room1_kamaho_count + next
              // 発注数を手で変えていなければ合計に合わせる
              if (cur.order_quantity === prevTotal) {
                patch.order_quantity = newTotal
              }
              updateEditState(activeDateStr, block.id, mt, patch)
            }}
            onQuantityChange={(mt, v) => {
              const num = parseInt(v, 10)
              updateEditState(activeDateStr, block.id, mt, {
                order_quantity: isNaN(num) ? 0 : Math.max(0, num),
              })
            }}
            onNotesChange={(mt, v) => updateEditState(activeDateStr, block.id, mt, { notes: v })}
          />
        ))
      )}
    </div>
  )
}

interface BlockSheetProps {
  block: BlockWithQuantities
  editState: Record<number, MealEdit>
  onRoomCountChange: (mt: MealType, room: 1 | 2, value: string) => void
  onQuantityChange: (mt: MealType, value: string) => void
  onNotesChange: (mt: MealType, value: string) => void
}

function BlockSheet({
  block,
  editState,
  onRoomCountChange,
  onQuantityChange,
  onNotesChange,
}: BlockSheetProps) {
  // 入力中の値で集計する。保存前でも合計とグラムがその場で変わるように。
  const roomsOf = (q: BlockQuantityRow) => {
    const es = editState[q.meal_type]
    return es
      ? { r1: es.room1_kamaho_count, r2: es.room2_kamaho_count }
      : { r1: q.room1_kamaho_count, r2: q.room2_kamaho_count }
  }
  const totalOf = (q: BlockQuantityRow) => {
    const { r1, r2 } = roomsOf(q)
    return r1 + r2
  }
  const totalKamaho = block.quantities.reduce((s, q) => s + totalOf(q), 0)
  const totalOrder = block.quantities.reduce(
    (s, q) => s + (editState[q.meal_type]?.order_quantity ?? q.order_quantity),
    0
  )
  const allSaved = block.quantities.every((q) => q.saved_id !== null)

  return (
    <section className="sheet">
      <div className="sheet__head">
        <h3>{block.name}</h3>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'rgba(242,245,243,0.7)' }}>
          {block.room1.name} ・ {block.room2.name}
        </span>
        <div className="sheet__meta">
          {allSaved && <span className="tag tag--ok">保存済</span>}
          <span>
            食数 <span className="num">{totalKamaho}</span> → 発注{' '}
            <span className="num">{totalOrder}</span>
          </span>
        </div>
      </div>

      <div className="sheet__scroll">
        <table className="data" style={{ minWidth: 720 }}>
          <thead>
            <tr>
              <th>食事</th>
              <th>献立</th>
              <th className="num">1人あたり</th>
              <th className="num">{block.room1.name}</th>
              <th className="num">{block.room2.name}</th>
              <th className="num">合計食数</th>
              <th className="num">総グラム</th>
              <th className="num">発注数</th>
              <th style={{ minWidth: 140 }}>メモ</th>
            </tr>
          </thead>
          <tbody>
            {block.quantities.map((q: BlockQuantityRow) => {
              const es = editState[q.meal_type] ?? {
                room1_kamaho_count: q.room1_kamaho_count,
                room2_kamaho_count: q.room2_kamaho_count,
                order_quantity: q.order_quantity,
                notes: q.notes,
              }
              const rooms = roomsOf(q)
              const total = totalOf(q)
              const grams = total * Number(q.grams_per_person)
              return (
                <tr key={q.meal_type} data-saved={q.saved_id !== null ? 'true' : undefined}>
                  <td>
                    <span className="tag" data-meal={q.meal_type}>
                      {MEAL_TYPE_LABELS[q.meal_type]}
                    </span>
                  </td>
                  <td className={q.menu_name ? 'lead' : 'muted'}>{q.menu_name ?? '未設定'}</td>
                  <td className="num muted">{Number(q.grams_per_person) > 0 ? `${Number(q.grams_per_person)}g` : '—'}</td>
                  <td className="num">
                    <input
                      className="input input--num"
                      type="number"
                      min={0}
                      value={rooms.r1}
                      onChange={(e) => onRoomCountChange(q.meal_type, 1, e.target.value)}
                      aria-label={`${MEAL_TYPE_LABELS[q.meal_type]} ${block.room1.name}の食数`}
                      style={{ width: 64 }}
                    />
                  </td>
                  <td className="num">
                    <input
                      className="input input--num"
                      type="number"
                      min={0}
                      value={rooms.r2}
                      onChange={(e) => onRoomCountChange(q.meal_type, 2, e.target.value)}
                      aria-label={`${MEAL_TYPE_LABELS[q.meal_type]} ${block.room2.name}の食数`}
                      style={{ width: 64 }}
                    />
                  </td>
                  <td className="num strong">{total}</td>
                  <td className="num">
                    {grams > 0 ? `${(grams / 1000).toFixed(1)} kg` : '—'}
                  </td>
                  <td className="num">
                    <input
                      className="input input--num"
                      type="number"
                      min={0}
                      value={es.order_quantity}
                      onChange={(e) => onQuantityChange(q.meal_type, e.target.value)}
                      aria-label={`${MEAL_TYPE_LABELS[q.meal_type]}の発注数`}
                      style={{ width: 76 }}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      type="text"
                      value={es.notes}
                      onChange={(e) => onNotesChange(q.meal_type, e.target.value)}
                      aria-label={`${MEAL_TYPE_LABELS[q.meal_type]}のメモ`}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
