'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  fetchBlockOrderQuantities,
  saveBlockOrderQuantities,
  MEAL_TYPE_LABELS,
  type MealType,
  type BlockWithQuantities,
  type BlockQuantityRow,
} from '../_lib/api/client'

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
}

interface EditState {
  [blockId: number]: {
    [mealType: number]: { order_quantity: number; notes: string }
  }
}

export default function DailyOrderForm() {
  const [date, setDate] = useState<string>(todayString())
  const [blocks, setBlocks] = useState<BlockWithQuantities[]>([])
  const [editState, setEditState] = useState<EditState>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const loadData = useCallback(async (targetDate: string) => {
    setLoading(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const res = await fetchBlockOrderQuantities(targetDate)
      setBlocks(res.data.blocks)
      const state: EditState = {}
      for (const block of res.data.blocks) {
        state[block.id] = {}
        for (const q of block.quantities) {
          state[block.id][q.meal_type] = { order_quantity: q.order_quantity, notes: q.notes }
        }
      }
      setEditState(state)
    } catch {
      setError('データの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData(date) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = e.target.value
    setDate(d)
    if (d) loadData(d)
  }

  const handleSaveBlock = async (block: BlockWithQuantities) => {
    setSaving(block.id)
    setError(null)
    setSuccessMsg(null)
    try {
      const items = block.quantities.map((q) => ({
        block_id: block.id,
        meal_type: q.meal_type,
        room1_kamaho_count: q.room1_kamaho_count,
        room2_kamaho_count: q.room2_kamaho_count,
        order_quantity: editState[block.id]?.[q.meal_type]?.order_quantity ?? q.order_quantity,
        notes: editState[block.id]?.[q.meal_type]?.notes ?? q.notes,
      }))
      await saveBlockOrderQuantities({ order_date: date, items })
      setSuccessMsg(`${block.name} を保存しました`)
      loadData(date)
    } catch {
      setError(`${block.name} の保存に失敗しました`)
    } finally {
      setSaving(null)
    }
  }

  const handleSaveAll = async () => {
    setSaving(-1)
    setError(null)
    setSuccessMsg(null)
    try {
      const items = blocks.flatMap((block) =>
        block.quantities.map((q) => ({
          block_id: block.id,
          meal_type: q.meal_type,
          room1_kamaho_count: q.room1_kamaho_count,
          room2_kamaho_count: q.room2_kamaho_count,
          order_quantity: editState[block.id]?.[q.meal_type]?.order_quantity ?? q.order_quantity,
          notes: editState[block.id]?.[q.meal_type]?.notes ?? q.notes,
        }))
      )
      await saveBlockOrderQuantities({ order_date: date, items })
      setSuccessMsg('全ブロックを保存しました')
      loadData(date)
    } catch {
      setError('保存に失敗しました')
    } finally {
      setSaving(null)
    }
  }

  const handlePrint = () => window.print()

  return (
    <>
      {/* 印刷スタイル */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          table { page-break-inside: avoid; }
        }
      `}</style>

      <div>
        {/* コントロールバー */}
        <div className="no-print" style={{
          background: '#fff',
          borderRadius: 12,
          padding: '1rem 1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label htmlFor="order-date" style={{ fontWeight: 600, color: '#374151', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
              発注日
            </label>
            <input
              id="order-date"
              type="date"
              value={date}
              onChange={handleDateChange}
              style={{
                padding: '0.5rem 0.75rem',
                fontSize: '0.95rem',
                border: '2px solid #e5e7eb',
                borderRadius: 8,
                outline: 'none',
                color: '#1a202c',
              }}
            />
          </div>

          <button
            onClick={() => loadData(date)}
            disabled={loading}
            style={btnStyle('#2563eb', loading)}
          >
            {loading ? '取得中...' : '🔄 kamaho から食数取得'}
          </button>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleSaveAll}
              disabled={saving !== null || blocks.length === 0}
              style={btnStyle('#16a34a', saving !== null)}
            >
              {saving === -1 ? '保存中...' : '💾 全ブロック保存'}
            </button>
            <button
              onClick={handlePrint}
              style={btnStyle('#6b7280', false)}
            >
              🖨 印刷
            </button>
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

        {/* 印刷ヘッダー（印刷時のみ表示） */}
        <div className="print-area" ref={printRef}>
          <div style={{ display: 'none' }} className="print-header">
            <h1 style={{ textAlign: 'center', fontSize: '1.2rem', marginBottom: 4 }}>食数発注表</h1>
            <p style={{ textAlign: 'center', color: '#666', marginBottom: '1.5rem' }}>{formatDate(date)}</p>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
              読み込み中...
            </div>
          ) : blocks.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 12, padding: '4rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div>
              <p style={{ color: '#9ca3af', margin: 0 }}>ブロックが登録されていません</p>
              <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>マスタ管理でブロックを追加してください</p>
            </div>
          ) : (
            blocks.map((block) => (
              <BlockSection
                key={block.id}
                block={block}
                date={date}
                editState={editState[block.id] ?? {}}
                onQuantityChange={(mt, v) => {
                  const num = parseInt(v, 10)
                  setEditState((prev) => ({
                    ...prev,
                    [block.id]: {
                      ...prev[block.id],
                      [mt]: { ...prev[block.id]?.[mt], order_quantity: isNaN(num) ? 0 : Math.max(0, num) },
                    },
                  }))
                }}
                onNotesChange={(mt, v) => {
                  setEditState((prev) => ({
                    ...prev,
                    [block.id]: {
                      ...prev[block.id],
                      [mt]: { ...prev[block.id]?.[mt], notes: v },
                    },
                  }))
                }}
                onSave={() => handleSaveBlock(block)}
                saving={saving === block.id}
              />
            ))
          )}
        </div>
      </div>
    </>
  )
}

interface BlockSectionProps {
  block: BlockWithQuantities
  date: string
  editState: Record<number, { order_quantity: number; notes: string }>
  onQuantityChange: (mt: MealType, value: string) => void
  onNotesChange: (mt: MealType, value: string) => void
  onSave: () => void
  saving: boolean
}

function BlockSection({ block, editState, onQuantityChange, onNotesChange, onSave, saving }: BlockSectionProps) {
  const totalKamaho = block.quantities.reduce((s, q) => s + q.total_kamaho_count, 0)
  const totalOrder = block.quantities.reduce((s, q) => s + (editState[q.meal_type]?.order_quantity ?? q.order_quantity), 0)
  const allSaved = block.quantities.every((q) => q.saved_id !== null)

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      marginBottom: '1.5rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      overflow: 'hidden',
      border: '1px solid #e2e8f0',
    }}>
      {/* ブロックヘッダー */}
      <div style={{
        padding: '0.9rem 1.25rem',
        background: 'linear-gradient(135deg, #1e3a5f, #1a56db)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{block.name}</span>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
            {block.room1.name} / {block.room2.name}
          </span>
          {allSaved && (
            <span style={{
              background: '#16a34a',
              color: '#fff',
              padding: '0.15rem 0.6rem',
              borderRadius: 999,
              fontSize: '0.75rem',
              fontWeight: 600,
            }}>保存済</span>
          )}
        </div>
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem' }}>
            合計 {totalKamaho} 食 → 発注 {totalOrder} 食
          </span>
          <button
            onClick={onSave}
            disabled={saving}
            style={{
              padding: '0.4rem 1rem',
              background: saving ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.15)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: 6,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {/* テーブル */}
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
              const isSaved = q.saved_id !== null
              return (
                <tr key={q.meal_type} style={{
                  borderTop: '1px solid #f1f5f9',
                  background: isSaved ? '#f0fdf4' : '#fff',
                }}>
                  <td style={td}>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.2rem 0.6rem',
                      borderRadius: 4,
                      background: mealTypeColor(q.meal_type) + '20',
                      color: mealTypeColor(q.meal_type),
                      fontSize: '0.8rem',
                      fontWeight: 600,
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
                    {q.total_grams > 0 ? (
                      <>{(q.total_grams / 1000).toFixed(1)} <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>kg</span></>
                    ) : '—'}
                  </td>
                  <td style={{ ...td, textAlign: 'center' }} className="no-print">
                    <input
                      type="number"
                      min={0}
                      value={es.order_quantity}
                      onChange={(e) => onQuantityChange(q.meal_type, e.target.value)}
                      style={{
                        width: 72,
                        padding: '0.35rem 0.5rem',
                        fontSize: '0.95rem',
                        border: '2px solid #e5e7eb',
                        borderRadius: 6,
                        textAlign: 'right',
                        outline: 'none',
                        fontWeight: 600,
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                      onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                    />
                  </td>
                  {/* 印刷時の発注数量 */}
                  <td style={{ ...td, textAlign: 'center', display: 'none', fontWeight: 700 }} className="print-only">
                    {es.order_quantity}
                  </td>
                  <td style={td} className="no-print">
                    <input
                      type="text"
                      value={es.notes}
                      onChange={(e) => onNotesChange(q.meal_type, e.target.value)}
                      placeholder="メモ"
                      style={{
                        width: '100%',
                        minWidth: 100,
                        padding: '0.35rem 0.5rem',
                        fontSize: '0.85rem',
                        border: '2px solid #e5e7eb',
                        borderRadius: 6,
                        outline: 'none',
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                      onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                    />
                  </td>
                  <td style={{ ...td, color: '#6b7280', fontSize: '0.85rem', display: 'none' }} className="print-only">
                    {es.notes}
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
    padding: '0.5rem 1rem',
    background: disabled ? '#e5e7eb' : color,
    color: disabled ? '#9ca3af' : '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '0.875rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  }
}

const th: React.CSSProperties = {
  padding: '0.65rem 0.9rem',
  textAlign: 'left',
  fontSize: '0.78rem',
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '0.65rem 0.9rem',
  fontSize: '0.9rem',
  color: '#374151',
}
