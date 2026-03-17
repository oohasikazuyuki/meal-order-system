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

// 仕入れ先コードごとの色パレット
const SUPPLIER_COLORS: { bg: string; color: string }[] = [
  { bg: '#e0f2fe', color: '#0369a1' }, // 水色
  { bg: '#fce7f3', color: '#9d174d' }, // ピンク
  { bg: '#d1fae5', color: '#065f46' }, // 緑
  { bg: '#fef3c7', color: '#92400e' }, // 黄
  { bg: '#ede9fe', color: '#5b21b6' }, // 紫
  { bg: '#fee2e2', color: '#991b1b' }, // 赤
  { bg: '#ffedd5', color: '#9a3412' }, // オレンジ
  { bg: '#f0fdf4', color: '#166534' }, // エメラルド
]

function getSupplierColor(supplierCode: string): { bg: string; color: string } {
  if (!supplierCode) return SUPPLIER_COLORS[0]
  let hash = 0
  for (let i = 0; i < supplierCode.length; i++) {
    hash = (hash * 31 + supplierCode.charCodeAt(i)) % SUPPLIER_COLORS.length
  }
  return SUPPLIER_COLORS[Math.abs(hash)]
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
      gridTemplateColumns: `repeat(7, minmax(160px, 1fr))`,
      gap: '0.75rem',
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
        padding: '0.5rem 0.75rem',
        background: 'linear-gradient(135deg, #1a3a5c, #2563eb)',
        color: '#fff', fontWeight: 700, fontSize: '0.9rem',
        textAlign: 'center',
      }}>
        {DOW_LABELS[dayIndex]}曜日
        {dateStr && (
          <div style={{ fontSize: '0.78rem', fontWeight: 400, opacity: 0.85, marginTop: 2 }}>
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
        padding: '0.25rem 0.75rem',
        background: mealColors[mealType] ?? '#f9fafb',
        borderBottom: `1px solid ${mealBorders[mealType] ?? '#e5e7eb'}`,
        fontSize: '0.75rem', fontWeight: 700,
        color: mealTextColors[mealType] ?? '#374151',
      }}>
        {MEAL_TYPE_LABELS[mealType]}
      </div>

      {/* メニューリスト */}
      <div style={{ padding: '0.4rem 0.6rem' }}>
        {displayMenus.map((menu, mi) => {
          const isEatingOut = menu.menu_name.startsWith('外食')
          return (
            <div key={mi} style={{ marginBottom: mi < displayMenus.length - 1 ? '0.4rem' : 0 }}>
              {isEatingOut ? (
                /* 外食メニュー: 特別スタイル */
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                  background: '#fff7ed', border: '1px solid #fdba74',
                  borderRadius: 5, padding: '0.25rem 0.5rem',
                }}>
                  <span style={{ fontSize: '0.9rem' }}>🍽</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#9a3412' }}>
                    {menu.menu_name}
                  </span>
                </div>
              ) : (
                <>
                  {/* 献立名 */}
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1a202c', marginBottom: viewType === 'staff' && menu.ingredients.length > 0 ? '0.15rem' : 0 }}>
                    {menu.menu_name}
                  </div>

                  {/* 食材（職員用のみ） */}
                  {viewType === 'staff' && menu.ingredients.map((ing, ii) => (
                    <div key={ii} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                      fontSize: '0.75rem', color: '#6b7280',
                      paddingLeft: '0.75rem',
                      borderBottom: ii < menu.ingredients.length - 1 ? '1px dashed #f3f4f6' : 'none',
                      padding: '0.08rem 0 0.08rem 0.75rem',
                    }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '0.25rem', flex: 1 }}>
                        {ing.name}
                      </span>
                      <span style={{ whiteSpace: 'nowrap', flexShrink: 0, marginRight: '0.25rem' }}>
                        {ing.amount % 1 === 0 ? ing.amount : ing.amount.toFixed(2)}{ing.unit}
                      </span>
                      {ing.supplier_code && (() => {
                        const sc = getSupplierColor(ing.supplier_code)
                        return (
                          <span style={{
                            background: sc.bg, color: sc.color,
                            padding: '0 0.3rem', borderRadius: 3, fontSize: '0.7rem', fontWeight: 700,
                            flexShrink: 0,
                          }}>
                            {ing.supplier_code}
                          </span>
                        )
                      })()}
                    </div>
                  ))}
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
