'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchCoopOrders, saveCoopOrders, type CoopOrdersResponse } from '../_lib/api/client'
import { getMondayOf, addWeeks, getWeekDates, parseDateStr, DOW_MON_FIRST } from '../_lib/date'
import WeekBar from '../_components/WeekBar'

type EditState = Record<
  number,
  {
    quantity: number
    notes: string
    daily: Record<string, number>
  }
>

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
      const init: EditState = {}
      for (const item of res.data.items) {
        init[item.id] = {
          quantity: item.quantity ?? 0,
          notes: item.notes ?? '',
          daily: { ...(item.daily ?? {}) },
        }
      }
      setEditState(init)
    } catch {
      setError('生協発注の内容を読み込めませんでした。通信を確認して、もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(weekStart)
  }, [weekStart, load])

  const handleSave = async () => {
    if (!data) return
    setSaving(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const items = data.items.map((item) => {
        const es = editState[item.id]
        if (item.order_type === 'daily') {
          return { item_id: item.id, daily: es?.daily ?? {} }
        }
        return { item_id: item.id, quantity: es?.quantity ?? 0, notes: es?.notes ?? '' }
      })
      await saveCoopOrders({ week_start: weekStart, items })
      setSuccessMsg('この週の生協発注を保存しました')
      load(weekStart)
    } catch {
      setError('保存できませんでした。もう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  const updateWeekly = (itemId: number, quantity: number) => {
    setEditState((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], quantity, notes: prev[itemId]?.notes ?? '' },
    }))
  }

  const updateNotes = (itemId: number, notes: string) => {
    setEditState((prev) => ({ ...prev, [itemId]: { ...prev[itemId], notes } }))
  }

  const updateDaily = (itemId: number, date: string, qty: number) => {
    setEditState((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        daily: { ...(prev[itemId]?.daily ?? {}), [date]: qty },
      },
    }))
  }

  const weekDates = getWeekDates(weekStart)

  return (
    <div>
      <WeekBar
        weekStart={weekStart}
        onPrev={() => setWeekStart((ws) => addWeeks(ws, -1))}
        onNext={() => setWeekStart((ws) => addWeeks(ws, 1))}
        onThisWeek={() => setWeekStart(getMondayOf(new Date()))}
        busy={loading}
        tools={
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleSave}
            disabled={saving || loading || !data}
          >
            {saving ? '保存しています' : 'この週を保存'}
          </button>
        }
      />

      <p className="notice">生協発注は献立の食数とは連動しません。必要な数を週ごとに入力してください。</p>

      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      {successMsg && <p className="notice notice--ok">{successMsg}</p>}

      {loading ? (
        <p className="empty">読み込んでいます</p>
      ) : !data ? null : data.items.length === 0 ? (
        <div className="sheet">
          <p className="empty">生協の品目が登録されていません。</p>
        </div>
      ) : (
        data.items.map((item) => {
          const es = editState[item.id] ?? { quantity: 0, notes: '', daily: {} }
          return (
            <section className="sheet" key={item.id}>
              <div className="sheet__head">
                <h2>{item.name}</h2>
                <span style={{ fontSize: 'var(--fs-sm)', color: 'rgba(242,245,243,0.7)' }}>
                  {item.order_type === 'weekly' ? '週にまとめて発注' : '日ごとに個数を指定'}
                </span>
                {item.order_type === 'daily' && (
                  <div className="sheet__meta">
                    <span>
                      週合計{' '}
                      <span className="num">
                        {Object.values(es.daily).reduce((s, v) => s + v, 0)}
                      </span>{' '}
                      {item.unit}
                    </span>
                  </div>
                )}
              </div>

              <div className="sheet__body">
                {item.order_type === 'weekly' ? (
                  <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <label className="field" style={{ marginBottom: 0 }}>
                      <span>今週の発注数（{item.unit}）</span>
                      <input
                        className="input input--num"
                        type="number"
                        min={0}
                        value={es.quantity}
                        onChange={(e) => updateWeekly(item.id, Math.max(0, parseInt(e.target.value) || 0))}
                        style={{ width: 110 }}
                      />
                    </label>
                    <label className="field" style={{ marginBottom: 0, flex: 1, minWidth: 220, maxWidth: 520 }}>
                      <span>メモ</span>
                      <input
                        className="input"
                        type="text"
                        value={es.notes}
                        onChange={(e) => updateNotes(item.id, e.target.value)}
                      />
                    </label>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.4rem' }}>
                    {weekDates.map((date, idx) => {
                      const qty = es.daily[date] ?? 0
                      const d = parseDateStr(date)
                      return (
                        <label key={date} style={{ display: 'block' }}>
                          <span
                            style={{
                              display: 'block',
                              textAlign: 'center',
                              fontSize: 'var(--fs-xs)',
                              color: 'var(--ink-3)',
                            }}
                          >
                            {DOW_MON_FIRST[idx]} {d.getMonth() + 1}/{d.getDate()}
                          </span>
                          <input
                            className="input input--num"
                            type="number"
                            min={0}
                            value={qty}
                            onChange={(e) =>
                              updateDaily(item.id, date, Math.max(0, parseInt(e.target.value) || 0))
                            }
                            aria-label={`${item.name} ${d.getMonth() + 1}月${d.getDate()}日の個数`}
                            style={qty > 0 ? { borderColor: 'var(--ink)', background: 'var(--ok-bg)' } : undefined}
                          />
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
