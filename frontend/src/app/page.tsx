'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  fetchBlockOrderQuantities,
  type BlockWithQuantities,
  MEAL_TYPE_LABELS,
  type MealType,
} from './_lib/api/client'
import { todayStr, formatLong } from './_lib/date'

const MEAL_TYPES: MealType[] = [1, 2, 3, 4]

export default function DashboardPage() {
  const [today, setToday] = useState('')
  const [blocks, setBlocks] = useState<BlockWithQuantities[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = todayStr()
    setToday(t)
    fetchBlockOrderQuantities(t)
      .then((res) => setBlocks(res.data.blocks))
      .catch(() => setError('本日の食数を読み込めませんでした。通信を確認して再読み込みしてください。'))
      .finally(() => setLoading(false))
  }, [])

  // 食事種別ごとの合計
  const totals: Record<MealType, { count: number; grams: number; menu: string | null }> = {
    1: { count: 0, grams: 0, menu: null },
    2: { count: 0, grams: 0, menu: null },
    3: { count: 0, grams: 0, menu: null },
    4: { count: 0, grams: 0, menu: null },
  }

  for (const block of blocks) {
    for (const q of block.quantities) {
      const mt = q.meal_type as MealType
      totals[mt].count += q.total_kamaho_count
      totals[mt].grams += q.total_grams
      if (q.menu_name) totals[mt].menu = q.menu_name
    }
  }

  const unsavedBlocks = blocks.filter((b) => b.quantities.some((q) => !q.saved_id))
  const grandTotal = MEAL_TYPES.reduce((s, mt) => s + totals[mt].count, 0)

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          paddingBottom: '0.6rem',
          marginBottom: '1.1rem',
          borderBottom: '2px solid var(--ink)',
        }}
      >
        <div>
          <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: 'var(--fs-sm)' }}>本日つくる食数</p>
          <h2 style={{ fontSize: 'var(--fs-xl)' }}>{today ? formatLong(today) : '　'}</h2>
        </div>
        <Link href="/daily-order" className="btn btn--primary">
          食数を入力する
        </Link>
      </div>

      {error && <p className="notice notice--error">{error}</p>}

      {/* 食札ごとの本日の数 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '0.7rem',
          marginBottom: '1.1rem',
        }}
      >
        {MEAL_TYPES.map((mt) => (
          <div
            key={mt}
            className="mealband"
            data-meal={mt}
            style={{
              background: 'var(--paper)',
              borderTop: '1px solid var(--rule)',
              borderRight: '1px solid var(--rule)',
              borderBottom: '1px solid var(--rule)',
              borderRadius: 'var(--r)',
              padding: '0.7rem 0.9rem',
            }}
          >
            <span className="tag" data-meal={mt}>
              {MEAL_TYPE_LABELS[mt]}
            </span>
            <p
              style={{
                margin: '0.35rem 0 0.25rem',
                minHeight: '1.7em',
                fontSize: 'var(--fs-sm)',
                color: totals[mt].menu ? 'var(--ink)' : 'var(--ink-4)',
              }}
            >
              {loading ? '　' : (totals[mt].menu ?? '献立が未設定')}
            </p>
            <p style={{ margin: 0 }}>
              <span className="num" style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700, lineHeight: 1.1 }}>
                {totals[mt].count.toLocaleString()}
              </span>
              <span className="figure__unit">食</span>
              {totals[mt].grams > 0 && (
                <span className="muted" style={{ fontSize: 'var(--fs-sm)', marginLeft: '0.6rem' }}>
                  {(totals[mt].grams / 1000).toFixed(1)} kg
                </span>
              )}
            </p>
          </div>
        ))}
      </div>

      {/* ブロック別の入力状況 */}
      <section className="sheet">
        <div className="sheet__head">
          <h2>ブロック別の入力状況</h2>
          <div className="sheet__meta">
            <span>
              合計 <span className="num">{grandTotal.toLocaleString()}</span> 食
            </span>
            <span>
              未保存 <span className="num">{unsavedBlocks.length}</span> / {blocks.length} ブロック
            </span>
          </div>
        </div>

        {loading ? (
          <p className="empty">読み込んでいます</p>
        ) : blocks.length === 0 ? (
          <div className="empty">
            <p>ブロックがまだ登録されていません。</p>
            <Link href="/master" className="btn">
              ブロックを登録する
            </Link>
          </div>
        ) : (
          <div className="sheet__scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>ブロック</th>
                  {MEAL_TYPES.map((mt) => (
                    <th key={mt} className="num">
                      {MEAL_TYPE_LABELS[mt]}
                    </th>
                  ))}
                  <th className="num">合計</th>
                  <th>状態</th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((b) => {
                  const byMeal = new Map(b.quantities.map((q) => [q.meal_type, q]))
                  const sum = b.quantities.reduce((s, q) => s + q.total_kamaho_count, 0)
                  const saved = b.quantities.every((q) => q.saved_id !== null)
                  return (
                    <tr key={b.id}>
                      <td className="lead">{b.name}</td>
                      {MEAL_TYPES.map((mt) => (
                        <td key={mt} className="num">
                          {byMeal.get(mt)?.total_kamaho_count ?? 0}
                        </td>
                      ))}
                      <td className="num strong">{sum}</td>
                      <td>
                        <span className={saved ? 'tag tag--ok' : 'tag tag--warn'}>
                          {saved ? '保存済' : '未保存'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
