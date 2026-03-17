'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  fetchCoopOrders, saveCoopOrders,
  type CoopItem, type CoopOrdersResponse,
} from '../_lib/api/client'

// ---- 日付ユーティリティ ----
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function getMondayOf(date: Date): string {
  const dow = date.getDay() === 0 ? 7 : date.getDay()
  return toDateStr(new Date(date.getFullYear(), date.getMonth(), date.getDate() - (dow - 1)))
}
function addWeeks(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return toDateStr(new Date(y, m - 1, d + n * 7))
}
function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = ['日', '月', '火', '水', '木', '金', '土'][dt.getDay()]
  return `${m}/${d}(${dow})`
}

const DOW_SHORT = ['月', '火', '水', '木', '金', '土', '日']

// ---- 型 ----
type EditState = Record<number, {
  quantity: number
  notes: string
  daily: Record<string, number>
}>

export default function CoopOrderPage() {
  const [weekStart, setWeekStart] = useState<string>(() => getMondayOf(new Date()))
  const [data, setData] = useState<CoopOrdersResponse | null>(null)
  const [editState, setEditState] = useState<EditState>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const load = useCallback(async (ws: string) => {
    setLoading(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const res = await fetchCoopOrders(ws)
      setData(res.data)
      // editState を初期化
      const init: EditState = {}
      for (const item of res.data.items) {
        init[item.id] = {
          quantity: item.quantity ?? 0,
          notes:    item.notes    ?? '',
          daily:    { ...(item.daily ?? {}) },
        }
      }
      setEditState(init)
    } catch {
      setError('データの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(weekStart) }, [weekStart, load])

  const handleSave = async () => {
    if (!data) return
    setSaving(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const items = data.items.map(item => {
        const es = editState[item.id]
        if (item.order_type === 'daily') {
          return { item_id: item.id, daily: es?.daily ?? {} }
        }
        return { item_id: item.id, quantity: es?.quantity ?? 0, notes: es?.notes ?? '' }
      })
      await saveCoopOrders({ week_start: weekStart, items })
      setSuccessMsg('保存しました')
      load(weekStart)
    } catch {
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const updateWeekly = (itemId: number, quantity: number, notes?: string) => {
    setEditState(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], quantity, notes: notes ?? prev[itemId]?.notes ?? '' },
    }))
  }

  const updateNotes = (itemId: number, notes: string) => {
    setEditState(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], notes },
    }))
  }

  const updateDaily = (itemId: number, date: string, qty: number) => {
    setEditState(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        daily: { ...(prev[itemId]?.daily ?? {}), [date]: qty },
      },
    }))
  }

  const weekDates = data
    ? Array.from({ length: 7 }, (_, i) => {
        const [y, m, d] = weekStart.split('-').map(Number)
        return toDateStr(new Date(y, m - 1, d + i))
      })
    : []

  const weekEndStr = weekDates.length > 0 ? formatDate(weekDates[6]) : ''

  return (
    <div>
      {/* 週選択バー */}
      <div style={{
        background: '#fff', borderRadius: 12, padding: '1rem 1.5rem',
        marginBottom: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
      }}>
        <button onClick={() => setWeekStart(ws => addWeeks(ws, -1))} style={navBtn}>← 前週</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 600 }}>週開始（月曜日）</label>
          <input
            type="date" value={weekStart}
            onChange={e => {
              const [y, m, d] = e.target.value.split('-').map(Number)
              setWeekStart(getMondayOf(new Date(y, m - 1, d)))
            }}
            style={{ padding: '0.45rem 0.75rem', fontSize: '0.9rem', border: '2px solid #e5e7eb', borderRadius: 8, outline: 'none', color: '#1a202c' }}
          />
        </div>
        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1a3a5c' }}>
          {formatDate(weekStart)} 〜 {weekEndStr}
        </div>
        <button onClick={() => setWeekStart(ws => addWeeks(ws, 1))} style={navBtn}>翌週 →</button>
        <button
          onClick={() => setWeekStart(getMondayOf(new Date()))}
          style={{ ...navBtn, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}
        >
          今週
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleSave}
          disabled={saving || loading || !data}
          style={{
            padding: '0.5rem 1.5rem', background: saving ? '#9ca3af' : '#1a3a5c',
            color: '#fff', border: 'none', borderRadius: 8,
            cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.9rem', fontWeight: 700,
          }}
        >
          {saving ? '保存中...' : '💾 保存'}
        </button>
      </div>

      {/* 説明バナー */}
      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '0.6rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#0369a1' }}>
        🛒 生協発注は献立の食数と連動しません。週単位で必要数をご入力ください。
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#dc2626' }}>
          ⚠ {error}
        </div>
      )}
      {successMsg && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#16a34a' }}>
          ✓ {successMsg}
        </div>
      )}

      {loading ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: '3rem', textAlign: 'center', color: '#9ca3af', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>読み込み中...
        </div>
      ) : data ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {data.items.map(item => {
            const es = editState[item.id] ?? { quantity: 0, notes: '', daily: {} }
            return (
              <div key={item.id} style={{
                background: '#fff', borderRadius: 12,
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden', border: '1px solid #f1f5f9',
              }}>
                {/* ヘッダー */}
                <div style={{
                  padding: '0.75rem 1.25rem',
                  background: 'linear-gradient(135deg, #065f46, #059669)',
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                }}>
                  <span style={{ fontSize: '1.1rem' }}>🛒</span>
                  <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{item.name}</span>
                  <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: 4 }}>
                    {item.order_type === 'weekly' ? '週次一括発注' : '日別個数指定'}
                  </span>
                </div>

                <div style={{ padding: '1rem 1.25rem' }}>
                  {item.order_type === 'weekly' ? (
                    /* 週次アイテム（卵・牛乳） */
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
                          今週の発注数
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <input
                            type="number" min={0}
                            value={es.quantity}
                            onChange={e => updateWeekly(item.id, Math.max(0, parseInt(e.target.value) || 0))}
                            style={{
                              width: 90, padding: '0.5rem 0.6rem', fontSize: '1.1rem', fontWeight: 700,
                              border: '2px solid #e5e7eb', borderRadius: 8, textAlign: 'right', outline: 'none',
                            }}
                            onFocus={e => (e.target.style.borderColor = '#059669')}
                            onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
                          />
                          <span style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: 600 }}>{item.unit}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 200 }}>
                        <label style={{ fontSize: '0.85rem', color: '#6b7280', whiteSpace: 'nowrap' }}>メモ</label>
                        <input
                          type="text" value={es.notes}
                          onChange={e => updateNotes(item.id, e.target.value)}
                          placeholder="備考・注意事項など"
                          style={{
                            flex: 1, padding: '0.45rem 0.6rem', fontSize: '0.9rem',
                            border: '2px solid #e5e7eb', borderRadius: 8, outline: 'none',
                          }}
                          onFocus={e => (e.target.style.borderColor = '#059669')}
                          onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
                        />
                      </div>
                    </div>
                  ) : (
                    /* 日別アイテム（冷凍チャーハン） */
                    <div>
                      <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                        各日の個数を入力してください（不要な日は 0 のまま）
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
                        {weekDates.map((date, idx) => {
                          const qty = es.daily[date] ?? 0
                          return (
                            <div key={date} style={{ textAlign: 'center' }}>
                              <div style={{
                                fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem',
                                color: '#374151',
                              }}>
                                {DOW_SHORT[idx]}<br />
                                <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: '0.72rem' }}>
                                  {formatDate(date).replace(/\(.*\)/, '')}
                                </span>
                              </div>
                              <input
                                type="number" min={0}
                                value={qty}
                                onChange={e => updateDaily(item.id, date, Math.max(0, parseInt(e.target.value) || 0))}
                                style={{
                                  width: '100%', padding: '0.5rem 0.25rem', fontSize: '1rem', fontWeight: 700,
                                  border: `2px solid ${qty > 0 ? '#059669' : '#e5e7eb'}`,
                                  borderRadius: 8, textAlign: 'center', outline: 'none',
                                  background: qty > 0 ? '#f0fdf4' : '#fff',
                                }}
                                onFocus={e => (e.target.style.borderColor = '#059669')}
                                onBlur={e => (e.target.style.borderColor = qty > 0 ? '#059669' : '#e5e7eb')}
                              />
                              <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.2rem' }}>
                                {item.unit}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {/* 週合計 */}
                      <div style={{ marginTop: '0.75rem', textAlign: 'right', fontSize: '0.85rem', color: '#6b7280' }}>
                        週合計：
                        <span style={{ fontWeight: 700, color: '#059669', fontSize: '1rem', marginLeft: '0.25rem' }}>
                          {Object.values(es.daily).reduce((s, v) => s + v, 0)} {item.unit}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

const navBtn: React.CSSProperties = {
  padding: '0.45rem 1rem', background: '#f3f4f6', color: '#374151',
  border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer',
  fontSize: '0.9rem', fontWeight: 600,
}
