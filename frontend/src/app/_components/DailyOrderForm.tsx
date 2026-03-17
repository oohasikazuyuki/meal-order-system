'use client'

import { useState, useCallback, useEffect } from 'react'
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

// ---- 日付ユーティリティ（タイムゾーン安全） ----
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getMondayStr(): string {
  const d = new Date()
  const dow = d.getDay() === 0 ? 7 : d.getDay()
  d.setDate(d.getDate() - (dow - 1))
  return toDateStr(d)
}

function addDaysToStr(dateStr: string, n: number): string {
  const [y, m, day] = dateStr.split('-').map(Number)
  const d = new Date(y, m - 1, day + n)
  return toDateStr(d)
}

function getWeekDates(weekStartStr: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysToStr(weekStartStr, i))
}

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = ['日', '月', '火', '水', '木', '金', '土'][dt.getDay()]
  return `${m}/${d}(${dow})`
}

function formatFullDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'][dt.getDay()]
  return `${y}年${m}月${d}日（${dow}）`
}

// ---- 型定義 ----
interface DayEditState {
  [blockId: number]: { [mealType: number]: { order_quantity: number; notes: string } }
}
type WeekData = { [dateStr: string]: BlockWithQuantities[] }
type WeekEditState = { [dateStr: string]: DayEditState }

// ========================
// メインコンポーネント
// ========================
export default function DailyOrderForm() {
  const [weekStart, setWeekStart] = useState<string>(getMondayStr)
  const [activeDay, setActiveDay] = useState<number>(0) // 0=月〜6=日
  const [weekData, setWeekData] = useState<WeekData>({})
  const [weekEditState, setWeekEditState] = useState<WeekEditState>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null) // dateStr or 'all'
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [showPrintMenu, setShowPrintMenu] = useState(false)
  const [downloading, setDownloading] = useState<number | null>(null)

  const weekDates = getWeekDates(weekStart)

  const loadWeek = useCallback(async (ws: string) => {
    setLoading(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const dates = getWeekDates(ws)
      const results = await Promise.all(dates.map(d => fetchBlockOrderQuantities(d)))

      const newData: WeekData = {}
      const newEdit: WeekEditState = {}
      results.forEach((res, i) => {
        const ds = dates[i]
        newData[ds] = res.data.blocks
        const state: DayEditState = {}
        for (const block of res.data.blocks) {
          state[block.id] = {}
          for (const q of block.quantities) {
            state[block.id][q.meal_type] = { order_quantity: q.order_quantity, notes: q.notes }
          }
        }
        newEdit[ds] = state
      })
      setWeekData(newData)
      setWeekEditState(newEdit)
    } catch {
      setError('データの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadWeek(weekStart) }, [weekStart, loadWeek])

  // 仕入先リストを初回ロード（キャッシュされるため2回目以降は高速）
  useEffect(() => {
    fetchSuppliers().then(res => setSuppliers(res.data.suppliers)).catch(() => {})
  }, [])

  const handlePrintPdf = async (supplier: Supplier) => {
    setDownloading(supplier.id)
    setShowPrintMenu(false)
    setError(null)
    try {
      // days を空で送ることでバックエンドが今日の週を基準に DB から食材を取得する
      const res = await fetchOrderSheetPdf(weekStart, supplier.id, {})
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      // 新タブでPDFを開く（ブラウザのPDFビューアで印刷可能）
      const win = window.open(url, '_blank')
      if (!win) {
        // ポップアップブロック時はダウンロードにフォールバック
        const a = document.createElement('a')
        a.href = url
        a.download = `${supplier.name}_${weekStart}週.pdf`
        a.click()
      }
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch {
      setError(`${supplier.name}の発注書PDF生成に失敗しました`)
    } finally {
      setDownloading(null)
    }
  }

  const handlePrevWeek = () => setWeekStart(ws => addDaysToStr(ws, -7))
  const handleNextWeek = () => setWeekStart(ws => addDaysToStr(ws, 7))
  const handleThisWeek = () => setWeekStart(getMondayStr())

  const updateEditState = (dateStr: string, blockId: number, mealType: MealType, patch: { order_quantity?: number; notes?: string }) => {
    setWeekEditState(prev => ({
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
    return blocks.flatMap(block =>
      block.quantities.map(q => ({
        block_id: block.id,
        meal_type: q.meal_type,
        room1_kamaho_count: q.room1_kamaho_count,
        room2_kamaho_count: q.room2_kamaho_count,
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
      setSuccessMsg(`${formatDateLabel(dateStr)} を保存しました`)
      await loadWeek(weekStart)
    } catch {
      setError('保存に失敗しました')
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
      setSuccessMsg('週全体を保存しました')
      await loadWeek(weekStart)
    } catch {
      setError('保存に失敗しました')
    } finally {
      setSaving(null)
    }
  }

  const activeDateStr = weekDates[activeDay]
  const activeBlocks = weekData[activeDateStr] ?? []
  const activeEditState = weekEditState[activeDateStr] ?? {}

  // 週の保存状況サマリー
  const savedDayCount = weekDates.filter(ds => {
    const blocks = weekData[ds] ?? []
    return blocks.length > 0 && blocks.every(b => b.quantities.every(q => q.saved_id !== null))
  }).length

  return (
    <div>
        {/* 週ナビゲーションバー */}
        <div className="" style={{
          background: '#fff', borderRadius: 12, padding: '0.9rem 1.5rem',
          marginBottom: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
        }}>
          <button onClick={handlePrevWeek} disabled={loading} style={navBtnStyle}>← 前週</button>

          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1a3a5c', minWidth: 180, textAlign: 'center' }}>
            {formatDateLabel(weekDates[0])} 〜 {formatDateLabel(weekDates[6])}
          </div>

          <button onClick={handleNextWeek} disabled={loading} style={navBtnStyle}>翌週 →</button>
          <button onClick={handleThisWeek} style={{ ...navBtnStyle, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>今週</button>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {savedDayCount > 0 && (
              <span style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 }}>
                ✓ {savedDayCount}/7日 保存済
              </span>
            )}
            <button
              onClick={handleSaveAll}
              disabled={saving !== null || loading}
              style={btnStyle('#16a34a', saving !== null || loading)}
            >
              {saving === 'all' ? '保存中...' : '💾 週全体を保存'}
            </button>
            {/* 発注書（印刷用Excel）ダウンロード */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowPrintMenu(v => !v)}
                disabled={downloading !== null}
                style={btnStyle('#6b7280', downloading !== null)}
              >
                {downloading !== null ? '⏳ 生成中...' : '🖨 発注書出力'}
              </button>
              {showPrintMenu && suppliers.length > 0 && (
                <>
                  {/* オーバーレイ（クリックで閉じる） */}
                  <div
                    onClick={() => setShowPrintMenu(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                  />
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                    background: '#fff', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                    border: '1px solid #e2e8f0', zIndex: 50, minWidth: 160, overflow: 'hidden',
                  }}>
                    <div style={{ padding: '0.5rem 0.9rem', fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                      仕入先を選択
                    </div>
                    {suppliers.map(s => (
                      <button
                        key={s.id}
                        onClick={() => handlePrintPdf(s)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '0.6rem 0.9rem', background: 'none', border: 'none',
                          cursor: 'pointer', fontSize: '0.9rem', color: '#374151',
                          borderBottom: '1px solid #f1f5f9',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >
                        📄 {s.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* メッセージ */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#dc2626', fontSize: '0.9rem' }}>
            ⚠ {error}
          </div>
        )}
        {successMsg && (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#16a34a', fontSize: '0.9rem' }}>
            ✓ {successMsg}
          </div>
        )}

        {/* 曜日タブ */}
        <div className="" style={{
          display: 'flex', gap: '0.25rem', marginBottom: '1rem',
          background: '#fff', borderRadius: 12, padding: '0.4rem',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflowX: 'auto',
        }}>
          {weekDates.map((ds, idx) => {
            const blocks = weekData[ds] ?? []
            const allSaved = blocks.length > 0 && blocks.every(b => b.quantities.every(q => q.saved_id !== null))
            const active = idx === activeDay
            return (
              <button
                key={ds}
                onClick={() => setActiveDay(idx)}
                style={{
                  flex: 1, minWidth: 72, padding: '0.5rem 0.4rem',
                  background: active ? '#1a3a5c' : 'transparent',
                  color: active ? '#fff' : '#6b7280',
                  border: 'none', borderRadius: 8, cursor: 'pointer',
                  fontSize: '0.85rem', fontWeight: active ? 700 : 400,
                  position: 'relative', transition: 'all 0.15s',
                }}
              >
                {formatDateLabel(ds)}
                {allSaved && (
                  <span style={{
                    display: 'block', fontSize: '0.65rem',
                    color: active ? 'rgba(255,255,255,0.8)' : '#16a34a', marginTop: 1,
                  }}>✓保存済</span>
                )}
              </button>
            )
          })}
        </div>

        {/* アクティブ日のコンテンツ */}
        <div>
          {loading ? (
            <div style={{ background: '#fff', borderRadius: 12, padding: '4rem', textAlign: 'center', color: '#9ca3af', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
              読み込み中...
            </div>
          ) : activeBlocks.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 12, padding: '4rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div>
              <p style={{ color: '#9ca3af', margin: 0 }}>ブロックが登録されていません</p>
            </div>
          ) : (
            activeBlocks.map(block => (
              <BlockSection
                key={block.id}
                block={block}
                editState={activeEditState[block.id] ?? {}}
                onQuantityChange={(mt, v) => {
                  const num = parseInt(v, 10)
                  updateEditState(activeDateStr, block.id, mt, { order_quantity: isNaN(num) ? 0 : Math.max(0, num) })
                }}
                onNotesChange={(mt, v) => updateEditState(activeDateStr, block.id, mt, { notes: v })}
                onSave={() => handleSaveDay(activeDateStr)}
                saving={saving === activeDateStr}
              />
            ))
          )}
        </div>
    </div>
  )
}

// ========================
// BlockSection
// ========================
interface BlockSectionProps {
  block: BlockWithQuantities
  editState: Record<number, { order_quantity: number; notes: string }>
  onQuantityChange: (mt: MealType, value: string) => void
  onNotesChange: (mt: MealType, value: string) => void
  onSave: () => void
  saving: boolean
}

function BlockSection({ block, editState, onQuantityChange, onNotesChange, onSave, saving }: BlockSectionProps) {
  const totalKamaho = block.quantities.reduce((s, q) => s + q.total_kamaho_count, 0)
  const totalOrder  = block.quantities.reduce((s, q) => s + (editState[q.meal_type]?.order_quantity ?? q.order_quantity), 0)
  const allSaved    = block.quantities.every(q => q.saved_id !== null)

  return (
    <div style={{
      background: '#fff', borderRadius: 12, marginBottom: '1.5rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden', border: '1px solid #e2e8f0',
    }}>
      <div style={{
        padding: '0.9rem 1.25rem',
        background: 'linear-gradient(135deg, #1e3a5f, #1a56db)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{block.name}</span>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
            {block.room1.name} / {block.room2.name}
          </span>
          {allSaved && (
            <span style={{ background: '#16a34a', color: '#fff', padding: '0.15rem 0.6rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600 }}>保存済</span>
          )}
        </div>
        <div className="" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem' }}>
            合計 {totalKamaho} 食 → 発注 {totalOrder} 食
          </span>
          <button
            onClick={onSave}
            disabled={saving}
            style={{
              padding: '0.4rem 1rem', background: 'rgba(255,255,255,0.15)',
              color: '#fff', border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '0.85rem', fontWeight: 600,
            }}
          >
            {saving ? '保存中...' : 'この日を保存'}
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <th style={th}>食事種別</th>
              <th style={th}>メニュー</th>
              <th style={{ ...th, textAlign: 'right' }}>1人あたり</th>
              <th style={{ ...th, textAlign: 'center' }}>{block.room1.name}</th>
              <th style={{ ...th, textAlign: 'center' }}>{block.room2.name}</th>
              <th style={{ ...th, textAlign: 'center' }}>合計食数</th>
              <th style={{ ...th, textAlign: 'right' }}>総グラム</th>
              <th style={{ ...th, textAlign: 'center' }}>発注数量</th>
              <th style={th}>メモ</th>
            </tr>
          </thead>
          <tbody>
            {block.quantities.map((q: BlockQuantityRow) => {
              const es = editState[q.meal_type] ?? { order_quantity: q.order_quantity, notes: q.notes }
              return (
                <tr key={q.meal_type} style={{
                  borderTop: '1px solid #f1f5f9',
                  background: q.saved_id !== null ? '#f0fdf4' : '#fff',
                }}>
                  <td style={td}>
                    <span style={{
                      display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: 4,
                      background: mealTypeColor(q.meal_type) + '20', color: mealTypeColor(q.meal_type),
                      fontSize: '0.8rem', fontWeight: 600,
                    }}>
                      {MEAL_TYPE_LABELS[q.meal_type]}
                    </span>
                  </td>
                  <td style={{ ...td, fontWeight: q.menu_name ? 500 : 400, color: q.menu_name ? '#1a202c' : '#d1d5db' }}>
                    {q.menu_name ?? '未設定'}
                  </td>
                  <td style={{ ...td, textAlign: 'right', color: '#6b7280', fontSize: '0.85rem' }}>
                    {q.grams_per_person > 0 ? `${q.grams_per_person}g` : '—'}
                  </td>
                  <td style={{ ...td, textAlign: 'center', color: '#2563eb', fontWeight: 600 }}>{q.room1_kamaho_count}</td>
                  <td style={{ ...td, textAlign: 'center', color: '#2563eb', fontWeight: 600 }}>{q.room2_kamaho_count}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1a202c' }}>{q.total_kamaho_count}</span>
                  </td>
                  <td style={{ ...td, textAlign: 'right', color: '#0891b2' }}>
                    {q.total_grams > 0
                      ? <>{(q.total_grams / 1000).toFixed(1)} <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>kg</span></>
                      : '—'}
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <input
                      type="number" min={0}
                      value={es.order_quantity}
                      onChange={e => onQuantityChange(q.meal_type, e.target.value)}
                      style={{ width: 72, padding: '0.35rem 0.5rem', fontSize: '0.95rem', border: '2px solid #e5e7eb', borderRadius: 6, textAlign: 'right', outline: 'none', fontWeight: 600 }}
                      onFocus={e => e.target.style.borderColor = '#2563eb'}
                      onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                    />
                  </td>
                  <td style={td}>
                    <input
                      type="text" value={es.notes}
                      onChange={e => onNotesChange(q.meal_type, e.target.value)}
                      placeholder="メモ"
                      style={{ width: '100%', minWidth: 100, padding: '0.35rem 0.5rem', fontSize: '0.85rem', border: '2px solid #e5e7eb', borderRadius: 6, outline: 'none' }}
                      onFocus={e => e.target.style.borderColor = '#2563eb'}
                      onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function mealTypeColor(mt: MealType): string {
  return ({ 1: '#f59e0b', 2: '#10b981', 3: '#6366f1', 4: '#f43f5e' } as Record<MealType, string>)[mt] ?? '#6b7280'
}

function btnStyle(color: string, disabled: boolean): React.CSSProperties {
  return {
    padding: '0.5rem 1rem', background: disabled ? '#e5e7eb' : color,
    color: disabled ? '#9ca3af' : '#fff', border: 'none', borderRadius: 8,
    cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 600, whiteSpace: 'nowrap',
  }
}

const navBtnStyle: React.CSSProperties = {
  padding: '0.45rem 1rem', background: '#f3f4f6', color: '#374151',
  border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer',
  fontSize: '0.9rem', fontWeight: 600,
}

const th: React.CSSProperties = {
  padding: '0.65rem 0.9rem', textAlign: 'left', fontSize: '0.78rem',
  fontWeight: 600, color: '#6b7280', textTransform: 'uppercase',
  letterSpacing: '0.04em', whiteSpace: 'nowrap',
}

const td: React.CSSProperties = { padding: '0.65rem 0.9rem', fontSize: '0.9rem', color: '#374151' }
