'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { fetchBlockOrderQuantities, type BlockWithQuantities, MEAL_TYPE_LABELS, type MealType } from './_lib/api/client'

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })
}

const MEAL_TYPES: MealType[] = [1, 2, 3, 4]

export default function DashboardPage() {
  const today = todayString()
  const [blocks, setBlocks] = useState<BlockWithQuantities[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchBlockOrderQuantities(today)
      .then((res) => setBlocks(res.data.blocks))
      .catch(() => setError('データ取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [today])

  // 食事種別ごとの合計集計
  const totals: Record<MealType, { count: number; grams: number; saved: number }> = {
    1: { count: 0, grams: 0, saved: 0 },
    2: { count: 0, grams: 0, saved: 0 },
    3: { count: 0, grams: 0, saved: 0 },
    4: { count: 0, grams: 0, saved: 0 },
  }
  const menuNames: Record<MealType, string | null> = { 1: null, 2: null, 3: null, 4: null }
  let savedCount = 0
  let unsavedCount = 0

  for (const block of blocks) {
    for (const q of block.quantities) {
      const mt = q.meal_type as MealType
      totals[mt].count += q.total_kamaho_count
      totals[mt].grams += q.total_grams
      totals[mt].saved += q.order_quantity
      if (q.menu_name) menuNames[mt] = q.menu_name
      if (q.saved_id) savedCount++
      else unsavedCount++
    }
  }

  const totalBlocks = blocks.length
  const pendingBlocks = blocks.filter((b) =>
    b.quantities.some((q) => !q.saved_id)
  ).length

  return (
    <div>
      {/* 今日の日付バナー */}
      <div style={{
        background: 'linear-gradient(135deg, #1a3a5c 0%, #2563eb 100%)',
        borderRadius: 12,
        padding: '1.5rem 2rem',
        marginBottom: '1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        color: '#fff',
      }}>
        <div>
          <p style={{ margin: 0, opacity: 0.75, fontSize: '0.85rem' }}>本日の発注状況</p>
          <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.5rem', fontWeight: 700 }}>
            {formatDate(today)}
          </h2>
        </div>
        <Link href="/daily-order" style={{
          background: 'rgba(255,255,255,0.15)',
          color: '#fff',
          padding: '0.6rem 1.25rem',
          borderRadius: 8,
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: '0.9rem',
          border: '1px solid rgba(255,255,255,0.3)',
        }}>
          発注入力へ →
        </Link>
      </div>

      {/* ステータスカード */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard label="登録ブロック数" value={totalBlocks} unit="ブロック" color="#2563eb" />
        <StatCard label="未保存ブロック" value={pendingBlocks} unit="ブロック" color={pendingBlocks > 0 ? '#dc2626' : '#16a34a'} alert={pendingBlocks > 0} />
        <StatCard label="本日の総食数" value={MEAL_TYPES.reduce((s, mt) => s + totals[mt].count, 0)} unit="食" color="#0891b2" />
        <StatCard label="本日の総グラム" value={Math.round(MEAL_TYPES.reduce((s, mt) => s + totals[mt].grams, 0) / 1000 * 10) / 10} unit="kg" color="#7c3aed" />
      </div>

      {/* 食事種別サマリー */}
      {!loading && blocks.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '1.5rem', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#374151' }}>食事種別サマリー</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={th}>食事種別</th>
                <th style={th}>メニュー</th>
                <th style={{ ...th, textAlign: 'right' }}>食数</th>
                <th style={{ ...th, textAlign: 'right' }}>発注数</th>
                <th style={{ ...th, textAlign: 'right' }}>総グラム</th>
              </tr>
            </thead>
            <tbody>
              {MEAL_TYPES.map((mt) => (
                <tr key={mt} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={td}>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.2rem 0.6rem',
                      borderRadius: 4,
                      background: mealTypeColor(mt) + '20',
                      color: mealTypeColor(mt),
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}>{MEAL_TYPE_LABELS[mt]}</span>
                  </td>
                  <td style={{ ...td, color: '#6b7280' }}>{menuNames[mt] ?? <span style={{ color: '#d1d5db' }}>未設定</span>}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{totals[mt].count.toLocaleString()}</td>
                  <td style={{ ...td, textAlign: 'right', color: '#2563eb', fontWeight: 600 }}>{totals[mt].saved.toLocaleString()}</td>
                  <td style={{ ...td, textAlign: 'right', color: '#6b7280' }}>
                    {totals[mt].grams > 0 ? `${(totals[mt].grams / 1000).toFixed(1)} kg` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>読み込み中...</div>
      )}
      {!loading && error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '1rem', color: '#dc2626' }}>{error}</div>
      )}
      {!loading && blocks.length === 0 && !error && (
        <div style={{ background: '#fff', borderRadius: 12, padding: '3rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <p style={{ color: '#9ca3af', margin: 0 }}>ブロックが登録されていません。</p>
          <Link href="/master" style={{ color: '#2563eb', fontSize: '0.9rem' }}>マスタ管理でブロックを追加 →</Link>
        </div>
      )}

      {/* クイックリンク */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {[
          { href: '/daily-order', label: '食数発注', desc: '今日の発注数量を入力', icon: '📋', color: '#2563eb' },
          { href: '/menus', label: 'メニュー管理', desc: '日付ごとのメニューを登録', icon: '🍽', color: '#0891b2' },
          { href: '/master', label: 'マスタ管理', desc: '部屋・ブロックを管理', icon: '⚙', color: '#7c3aed' },
        ].map(({ href, label, desc, icon, color }) => (
          <Link key={href} href={href} style={{ textDecoration: 'none' }}>
            <div style={{
              background: '#fff',
              borderRadius: 12,
              padding: '1.25rem 1.5rem',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              transition: 'box-shadow 0.15s, transform 0.15s',
              cursor: 'pointer',
            }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement
                el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'
                el.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement
                el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)'
                el.style.transform = ''
              }}
            >
              <div style={{
                width: 44,
                height: 44,
                background: color + '15',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.3rem',
                flexShrink: 0,
              }}>{icon}</div>
              <div>
                <div style={{ fontWeight: 600, color: '#1a202c', fontSize: '0.95rem' }}>{label}</div>
                <div style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: 2 }}>{desc}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function StatCard({ label, value, unit, color, alert }: {
  label: string; value: number; unit: string; color: string; alert?: boolean
}) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: '1.25rem 1.5rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      borderLeft: `4px solid ${color}`,
    }}>
      <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280', fontWeight: 500 }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem', marginTop: '0.4rem' }}>
        <span style={{ fontSize: '2rem', fontWeight: 700, color: alert ? color : '#1a202c' }}>{value.toLocaleString()}</span>
        <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>{unit}</span>
      </div>
    </div>
  )
}

function mealTypeColor(mt: MealType): string {
  return { 1: '#f59e0b', 2: '#10b981', 3: '#6366f1', 4: '#f43f5e' }[mt] ?? '#6b7280'
}

const th: React.CSSProperties = {
  padding: '0.7rem 1rem',
  textAlign: 'left',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const td: React.CSSProperties = {
  padding: '0.75rem 1rem',
  fontSize: '0.9rem',
  color: '#374151',
}
