'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  fetchMenuTable, fetchMenuTablePdf,
  type MenuTableResponse, type MenuTableDay, type MealType,
  MEAL_TYPE_LABELS,
} from '../_lib/api/client'

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getMondayOf(date: Date): string {
  const dow = date.getDay() === 0 ? 7 : date.getDay()
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() - (dow - 1))
  return toDateStr(d)
}

function addWeeks(dateStr: string, weeks: number): string {
  const [y, m, day] = dateStr.split('-').map(Number)
  const d = new Date(y, m - 1, day + weeks * 7)
  return toDateStr(d)
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = ['日', '月', '火', '水', '木', '金', '土'][dt.getDay()]
  return `${m}/${d}(${dow})`
}

const DOW_LABELS = ['月', '火', '水', '木', '金', '土', '日']

// 発注先コードごとの固定色（PDFメモ欄と揃える）
const SUPPLIER_COLOR_MAP: Record<string, { bg: string; color: string; border: string }> = {
  C: { bg: '#fef3c7', color: '#92400e', border: '#f59e0b' }, // COOP
  Y: { bg: '#d1fae5', color: '#065f46', border: '#34d399' }, // 八百喜
  M: { bg: '#fee2e2', color: '#991b1b', border: '#f87171' }, // 河野
  F: { bg: '#e0f2fe', color: '#0369a1', border: '#38bdf8' }, // 魚丹
  S: { bg: '#dbeafe', color: '#1e3a8a', border: '#60a5fa' }, // スーパー
  Z: { bg: '#f3f4f6', color: '#4b5563', border: '#d1d5db' }, // 在庫
}

const FALLBACK_SUPPLIER_COLORS: { bg: string; color: string; border: string }[] = [
  { bg: '#ede9fe', color: '#5b21b6', border: '#a78bfa' },
  { bg: '#ffedd5', color: '#9a3412', border: '#fb923c' },
  { bg: '#fce7f3', color: '#9d174d', border: '#f472b6' },
  { bg: '#f0fdf4', color: '#166534', border: '#4ade80' },
]

function getSupplierColor(supplierCode: string): { bg: string; color: string; border: string } {
  const code = (supplierCode || '').toUpperCase()
  if (code && SUPPLIER_COLOR_MAP[code]) return SUPPLIER_COLOR_MAP[code]
  if (!code) return { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' }
  let hash = 0
  for (let i = 0; i < code.length; i++) {
    hash = (hash * 31 + code.charCodeAt(i)) % FALLBACK_SUPPLIER_COLORS.length
  }
  return FALLBACK_SUPPLIER_COLORS[Math.abs(hash)]
}

// PDF モーダルの状態
interface PdfModal {
  url: string
  label: string  // "職員用" or "子供用"
}

export default function MenuTablePage() {
  const [weekStart, setWeekStart] = useState<string>(() => getMondayOf(new Date()))
  const [preview, setPreview] = useState<MenuTableResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<'staff' | 'children' | null>(null)
  const [viewType, setViewType] = useState<'staff' | 'children'>('staff')
  const [pdfModal, setPdfModal] = useState<PdfModal | null>(null)

  const loadPreview = useCallback(async (ws: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchMenuTable(ws)
      setPreview(res.data)
    } catch {
      setError('献立データの取得に失敗しました')
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPreview(weekStart) }, [weekStart, loadPreview])

  const closePdfModal = () => {
    if (pdfModal) {
      setTimeout(() => URL.revokeObjectURL(pdfModal.url), 1000)
      setPdfModal(null)
    }
  }

  const handlePrint = async (type: 'staff' | 'children') => {
    setDownloading(type)
    try {
      const res = await fetchMenuTablePdf(weekStart, type)
      const typeLabel = type === 'children' ? '子供用' : '職員用'
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setPdfModal({ url, label: typeLabel })
    } catch {
      setError('印刷データの取得に失敗しました')
    } finally {
      setDownloading(null)
    }
  }

  const weekEndStr = (() => {
    const [y, m, d] = weekStart.split('-').map(Number)
    const end = new Date(y, m - 1, d + 6)
    return `${end.getMonth() + 1}/${end.getDate()}`
  })()

  return (
    <div>
      {/* PDF モーダル */}
      {pdfModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* モーダルヘッダー */}
          <div style={{
            background: '#1a3a5c', padding: '0.75rem 1.25rem',
            display: 'flex', alignItems: 'center', gap: '1rem',
            flexShrink: 0,
          }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: '1rem', flex: 1 }}>
              📄 献立表（{pdfModal.label}）プレビュー
            </span>
            <a
              href={pdfModal.url}
              download={`献立表_${pdfModal.label}_${weekStart}週.pdf`}
              style={{
                padding: '0.45rem 1rem', background: '#059669', color: '#fff',
                borderRadius: 8, fontSize: '0.85rem', fontWeight: 600,
                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem',
              }}
            >
              💾 ダウンロード
            </a>
            <button
              onClick={() => {
                const iframe = document.getElementById('menu-pdf-preview-frame') as HTMLIFrameElement
                iframe?.contentWindow?.print()
              }}
              style={{
                padding: '0.45rem 1rem', background: 'rgba(255,255,255,0.15)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8,
                fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              🖨 印刷
            </button>
            <button
              onClick={closePdfModal}
              style={{
                padding: '0.45rem 1rem', background: '#dc2626', color: '#fff',
                border: 'none', borderRadius: 8,
                fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              ✕ 閉じる
            </button>
          </div>

          {/* PDF iframe */}
          <iframe
            id="menu-pdf-preview-frame"
            src={pdfModal.url}
            style={{ flex: 1, border: 'none', background: '#525659' }}
            title="献立表プレビュー"
          />
        </div>
      )}

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
            type="date"
            value={weekStart}
            onChange={e => {
              const [y, m, d] = e.target.value.split('-').map(Number)
              setWeekStart(getMondayOf(new Date(y, m - 1, d)))
            }}
            style={{
              padding: '0.45rem 0.75rem', fontSize: '0.9rem',
              border: '2px solid #e5e7eb', borderRadius: 8, outline: 'none', color: '#1a202c',
            }}
          />
        </div>
        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1a3a5c' }}>
          {formatDate(weekStart)} 〜 {weekEndStr}（1週間）
        </div>
        <button onClick={() => setWeekStart(ws => addWeeks(ws, 1))} style={navBtn}>翌週 →</button>
        <button
          onClick={() => setWeekStart(getMondayOf(new Date()))}
          style={{ ...navBtn, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}
        >
          今週
        </button>
      </div>

      {/* 表示切替 + 印刷ボタン */}
      <div style={{
        background: '#fff', borderRadius: 12, padding: '1rem 1.5rem',
        marginBottom: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
      }}>
        {/* 表示切替タブ */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['staff', 'children'] as const).map(t => (
            <button
              key={t}
              onClick={() => setViewType(t)}
              style={{
                padding: '0.45rem 1rem', borderRadius: 8, fontWeight: 600, fontSize: '0.9rem',
                cursor: 'pointer', border: 'none',
                background: viewType === t ? '#1a3a5c' : '#f3f4f6',
                color: viewType === t ? '#fff' : '#374151',
              }}
            >
              {t === 'staff' ? '職員用（食材あり）' : '子供用（献立名のみ）'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* 発注先カラー凡例（職員用） */}
        {viewType === 'staff' && (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {Object.entries({
              C: 'COOP', Y: '八百喜', M: '河野', F: '魚丹', S: 'スーパー', Z: '在庫',
            }).map(([code, label]) => {
              const sc = getSupplierColor(code)
              return (
                <span key={code} style={{
                  background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                  padding: '0.15rem 0.45rem', borderRadius: 4, fontSize: '0.78rem', fontWeight: 700,
                }}>
                  {code}:{label}
                </span>
              )
            })}
          </div>
        )}

        {/* 印刷ボタン */}
        <button
          onClick={() => handlePrint('staff')}
          disabled={downloading !== null || !preview}
          style={{
            padding: '0.5rem 1.25rem', borderRadius: 8, fontWeight: 700,
            cursor: downloading !== null || !preview ? 'not-allowed' : 'pointer',
            background: '#1a3a5c', color: '#fff', border: 'none', fontSize: '0.9rem',
            opacity: downloading !== null || !preview ? 0.5 : 1,
            display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}
        >
          {downloading === 'staff' ? '⏳ 生成中...' : '🖨 職員用 印刷'}
        </button>
        <button
          onClick={() => handlePrint('children')}
          disabled={downloading !== null || !preview}
          style={{
            padding: '0.5rem 1.25rem', borderRadius: 8, fontWeight: 700,
            cursor: downloading !== null || !preview ? 'not-allowed' : 'pointer',
            background: '#059669', color: '#fff', border: 'none', fontSize: '0.9rem',
            opacity: downloading !== null || !preview ? 0.5 : 1,
            display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}
        >
          {downloading === 'children' ? '⏳ 生成中...' : '🖨 子供用 印刷'}
        </button>
      </div>

      {/* エラー */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#dc2626', fontSize: '0.9rem' }}>
          ⚠ {error}
        </div>
      )}

      {/* プレビュー */}
      {loading ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: '3rem', textAlign: 'center', color: '#9ca3af', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
          読み込み中...
        </div>
      ) : preview ? (
        <div style={{ overflowX: 'auto' }}>
          <WeekGrid days={preview.days} viewType={viewType} />
        </div>
      ) : null}
    </div>
  )
}

// ----------------------------------------
// 週間グリッド表示
// ----------------------------------------
function WeekGrid({
  days, viewType,
}: {
  days: MenuTableDay[]
  viewType: 'staff' | 'children'
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(7, minmax(220px, 1fr))`,
      gap: '1rem',
    }}>
      {[0, 1, 2, 3, 4, 5, 6].map(i => (
        <DayColumn key={i} dayIndex={i} dayData={days[i]} viewType={viewType} />
      ))}
    </div>
  )
}

// ----------------------------------------
// 1日分の列
// ----------------------------------------
function DayColumn({
  dayIndex, dayData, viewType,
}: {
  dayIndex: number
  dayData: MenuTableDay | undefined
  viewType: 'staff' | 'children'
}) {
  const dateStr = dayData?.date ?? ''
  const meals   = dayData?.meals ?? {}

  return (
    <div style={{
      background: '#fff', borderRadius: 10,
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      border: '1px solid #f1f5f9', overflow: 'hidden',
      minHeight: 100,
    }}>
      {/* 曜日ヘッダー */}
      <div style={{
        padding: '0.7rem 0.85rem',
        background: 'linear-gradient(135deg, #1a3a5c, #2563eb)',
        color: '#fff', fontWeight: 700, fontSize: '1.05rem',
        textAlign: 'center',
      }}>
        {DOW_LABELS[dayIndex]}曜日
        {dateStr && (
          <div style={{ fontSize: '0.92rem', fontWeight: 500, opacity: 0.9, marginTop: 4 }}>
            {formatDate(dateStr)}
          </div>
        )}
      </div>

      {/* 食事ブロック */}
      {(['1', '2', '3'] as string[]).map(mt => {
        const menus = meals[mt]
        if (!menus || menus.length === 0) return null
        return (
          <MealBlock key={mt} mealType={Number(mt) as MealType} menus={menus} viewType={viewType} />
        )
      })}

      {Object.keys(meals).length === 0 && (
        <div style={{ padding: '1rem', textAlign: 'center', color: '#d1d5db', fontSize: '0.82rem' }}>
          データなし
        </div>
      )}
    </div>
  )
}

// ----------------------------------------
// 食事ブロック（朝/昼/夕）
// ----------------------------------------
function MealBlock({
  mealType, menus, viewType,
}: {
  mealType: MealType
  menus: { menu_name: string; ingredients: { name: string; amount: number; unit: string; supplier_code: string; delivery_date: string }[] }[]
  viewType: 'staff' | 'children'
}) {
  const mealColors: Record<number, string> = { 1: '#fef9c3', 2: '#eff6ff', 3: '#f0fdf4' }
  const mealBorders: Record<number, string> = { 1: '#fde68a', 2: '#bfdbfe', 3: '#bbf7d0' }
  const mealTextColors: Record<number, string> = { 1: '#92400e', 2: '#1e40af', 3: '#065f46' }

  // 外食メニューがあれば通常メニューより優先して表示
  const hasEatingOut = menus.some(m => m.menu_name.startsWith('外食'))
  const displayMenus = hasEatingOut
    ? menus.filter(m => m.menu_name.startsWith('外食'))
    : menus

  return (
    <div style={{ borderTop: '1px solid #f1f5f9' }}>
      {/* 食事種別ラベル */}
      <div style={{
        padding: '0.4rem 0.85rem',
        background: mealColors[mealType] ?? '#f9fafb',
        borderBottom: `1px solid ${mealBorders[mealType] ?? '#e5e7eb'}`,
        fontSize: '0.9rem', fontWeight: 700,
        color: mealTextColors[mealType] ?? '#374151',
      }}>
        {MEAL_TYPE_LABELS[mealType]}
      </div>

      {/* メニューリスト */}
      <div style={{ padding: '0.55rem 0.7rem' }}>
        {displayMenus.map((menu, mi) => {
          const isEatingOut = menu.menu_name.startsWith('外食')
          return (
            <div key={mi} style={{ marginBottom: mi < displayMenus.length - 1 ? '0.65rem' : 0 }}>
              {isEatingOut ? (
                /* 外食メニュー: 特別スタイル */
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  background: '#fff7ed', border: '1px solid #fdba74',
                  borderRadius: 6, padding: '0.4rem 0.6rem',
                }}>
                  <span style={{ fontSize: '1rem' }}>🍽</span>
                  <span style={{
                    fontSize: '1rem', fontWeight: 700, color: '#9a3412',
                    lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {menu.menu_name}
                  </span>
                </div>
              ) : (
                <>
                  {/* 献立名（長い場合は2行まで改行） */}
                  <div style={{
                    fontSize: '1.05rem', fontWeight: 700, color: '#0f172a',
                    lineHeight: 1.35, marginBottom: viewType === 'staff' && menu.ingredients.length > 0 ? '0.35rem' : 0,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    overflow: 'hidden', wordBreak: 'break-word',
                  }}>
                    {menu.menu_name}
                  </div>

                  {/* 食材（職員用のみ） */}
                  {viewType === 'staff' && menu.ingredients.map((ing, ii) => {
                    const sc = getSupplierColor(ing.supplier_code)
                    return (
                      <div key={ii} style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: '0.25rem 0.5rem',
                        fontSize: '0.95rem',
                        borderBottom: ii < menu.ingredients.length - 1 ? '1px dashed #e5e7eb' : 'none',
                        padding: '0.35rem 0.15rem',
                      }}>
                        <span style={{
                          color: '#1f2937', fontWeight: 600, lineHeight: 1.35,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                          overflow: 'hidden', wordBreak: 'break-word',
                        }}>
                          {ing.name}
                        </span>
                        <span style={{
                          whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 700,
                          color: '#334155', fontSize: '0.95rem', textAlign: 'right',
                        }}>
                          {ing.amount % 1 === 0 ? ing.amount : ing.amount.toFixed(2)}{ing.unit}
                        </span>
                        <div style={{
                          gridColumn: '1 / -1', display: 'flex', alignItems: 'center',
                          gap: '0.4rem', flexWrap: 'wrap',
                        }}>
                          {ing.supplier_code && (
                            <span style={{
                              background: sc.bg, color: sc.color, border: `1.5px solid ${sc.border}`,
                              padding: '0.12rem 0.45rem', borderRadius: 4,
                              fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.02em',
                            }}>
                              発注先 {ing.supplier_code}
                            </span>
                          )}
                          {ing.delivery_date && (
                            <span style={{
                              color: '#334155', fontSize: '0.88rem', fontWeight: 700,
                              background: '#f8fafc',
                              padding: '0.12rem 0.45rem', borderRadius: 4,
                            }}>
                              納品 {ing.delivery_date}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ----------------------------------------
// スタイル
// ----------------------------------------
const navBtn: React.CSSProperties = {
  padding: '0.45rem 1rem',
  background: '#f3f4f6',
  color: '#374151',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: '0.9rem',
  fontWeight: 600,
}
