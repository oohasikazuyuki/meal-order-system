'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  fetchOrderSheetPreview, fetchOrderSheetPdf, fetchInventoryPreview,
  type OrderSheetPreviewResponse, type InventoryPreviewResponse,
} from '../_lib/api/client'

/** タイムゾーン安全：Date → 'YYYY-MM-DD' */
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 月曜日の日付文字列を返す（ローカル時刻基準） */
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

/** 今日以降かどうか */
function isFutureOrToday(dateStr: string): boolean {
  const today = toDateStr(new Date())
  return dateStr >= today
}

// PDF モーダルの状態
interface PdfModal {
  url: string
  supplierName: string
}

export default function OrderSheetsPage() {
  const [weekStart, setWeekStart] = useState<string>(() => getMondayOf(new Date()))
  const [preview, setPreview] = useState<OrderSheetPreviewResponse | null>(null)
  const [inventory, setInventory] = useState<InventoryPreviewResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<number | null>(null)
  const [pdfModal, setPdfModal] = useState<PdfModal | null>(null)

  const loadPreview = useCallback(async (ws: string) => {
    setLoading(true)
    setError(null)
    try {
      const [previewRes, invRes] = await Promise.all([
        fetchOrderSheetPreview(ws),
        fetchInventoryPreview(ws),
      ])
      setPreview(previewRes.data)
      setInventory(invRes.data)
    } catch {
      setError('集計データの取得に失敗しました')
      setPreview(null)
      setInventory(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPreview(weekStart) }, [weekStart, loadPreview])

  // モーダルを閉じたときに blob URL を解放
  const closePdfModal = () => {
    if (pdfModal) {
      setTimeout(() => URL.revokeObjectURL(pdfModal.url), 1000)
      setPdfModal(null)
    }
  }

  const handleDownload = async (supplierId: number, supplierName: string) => {
    setDownloading(supplierId)
    setError(null)
    try {
      const res = await fetchOrderSheetPdf(weekStart, supplierId, {})
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setPdfModal({ url, supplierName })
    } catch {
      setError(`${supplierName}の発注書PDF生成に失敗しました`)
    } finally {
      setDownloading(null)
    }
  }

  const week2Start = addWeeks(weekStart, 1)
  const [wey, wem, wed] = week2Start.split('-').map(Number)
  const weekEndDate = new Date(wey, wem - 1, wed - 1)
  const weekEndStr = `${weekEndDate.getMonth() + 1}/${weekEndDate.getDate()}`

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
              📄 {pdfModal.supplierName} 発注書プレビュー
            </span>
            <a
              href={pdfModal.url}
              download={`${pdfModal.supplierName}_${weekStart}週.pdf`}
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
                const iframe = document.getElementById('pdf-preview-frame') as HTMLIFrameElement
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
            id="pdf-preview-frame"
            src={pdfModal.url}
            style={{ flex: 1, border: 'none', background: '#525659' }}
            title="発注書プレビュー"
          />
        </div>
      )}

      {/* 週選択バー */}
      <div className="no-print" style={{
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
          {formatDate(weekStart)} 〜 {weekEndStr}（2週間）
        </div>
        <button onClick={() => setWeekStart(ws => addWeeks(ws, 1))} style={navBtn}>翌週 →</button>
        <button
          onClick={() => setWeekStart(getMondayOf(new Date()))}
          style={{ ...navBtn, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}
        >
          今週
        </button>
      </div>

      {/* 説明 */}
      <div className="no-print" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '0.6rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#0369a1' }}>
        📋 献立管理に登録されたメニューと食数から食材を自動集計します。PDFには今日以降の納品日のみ出力されます。
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#dc2626', fontSize: '0.9rem' }}>
          ⚠ {error}
        </div>
      )}

      {loading ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: '3rem', textAlign: 'center', color: '#9ca3af', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
          集計中...
        </div>
      ) : preview ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {preview.suppliers.map(supplier => {
            const allDates = Object.keys(supplier.days).sort()
            const futureDates = allDates.filter(isFutureOrToday)
            const week1Dates = allDates.filter(d => d < week2Start)
            const week2Dates = allDates.filter(d => d >= week2Start)

            return (
              <div key={supplier.supplier_id} className="supplier-card" style={{
                background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                border: '1px solid #f1f5f9', overflow: 'hidden',
              }}>
                {/* 印刷専用ヘッダー（画面では非表示） */}
                <div className="print-only" style={{
                  display: 'none',
                  padding: '0.4rem 1rem',
                  fontWeight: 700, fontSize: '0.95rem', color: '#1a3a5c',
                  borderBottom: '2px solid #1a3a5c',
                }}>
                  🏪 {supplier.supplier_name}　{formatDate(weekStart)} 〜 {weekEndStr}
                </div>
                {/* ヘッダー */}
                <div className="no-print" style={{
                  padding: '0.85rem 1.5rem', borderBottom: '1px solid #f1f5f9',
                  background: 'linear-gradient(135deg, #1a3a5c, #2563eb)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>🏪</span>
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{supplier.supplier_name}</span>
                    {futureDates.length > 0 ? (
                      <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: 4 }}>
                        今後{futureDates.length}日分
                      </span>
                    ) : (
                      <span style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: 4 }}>
                        この週の注文なし
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDownload(supplier.supplier_id, supplier.supplier_name)}
                    disabled={downloading === supplier.supplier_id || futureDates.length === 0}
                    style={{
                      padding: '0.45rem 1rem',
                      background: futureDates.length > 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                      color: futureDates.length > 0 ? '#fff' : 'rgba(255,255,255,0.35)',
                      border: `1px solid ${futureDates.length > 0 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: 8,
                      cursor: futureDates.length > 0 ? 'pointer' : 'not-allowed',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                    }}
                  >
                    {downloading === supplier.supplier_id ? '⏳ 生成中...' : '📄 プレビュー・PDF'}
                  </button>
                </div>

                {/* 日別データ（読み取り専用） */}
                {allDates.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem' }}>
                    この週は発注データがありません
                  </div>
                ) : (
                  <div style={{ padding: '0.75rem 1rem' }}>
                    {/* 今週 */}
                    {week1Dates.length > 0 && (
                      <div style={{ marginBottom: week2Dates.length > 0 ? '0.75rem' : 0 }}>
                        <div style={weekLabelStyle}>今週</div>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(${week1Dates.length}, minmax(140px, 1fr))`,
                          gap: '0.5rem',
                        }}>
                          {week1Dates.map(date => (
                            <DateCard key={date} date={date} ingredients={supplier.days[date] ?? []} isPast={!isFutureOrToday(date)} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 翌週 */}
                    {week2Dates.length > 0 && (
                      <div>
                        <div style={weekLabelStyle}>翌週</div>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(${week2Dates.length}, minmax(140px, 1fr))`,
                          gap: '0.5rem',
                        }}>
                          {week2Dates.map(date => (
                            <DateCard key={date} date={date} ingredients={supplier.days[date] ?? []} isPast={!isFutureOrToday(date)} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* 在庫確認リスト（鎌ホ在庫） */}
          {inventory && (() => {
            const invDates = Object.keys(inventory.days).sort()
            const invWeek1 = invDates.filter(d => d < week2Start)
            const invWeek2 = invDates.filter(d => d >= week2Start)
            const hasAny = invDates.some(d => (inventory.days[d] ?? []).length > 0)
            return (
              <div style={{
                background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                border: '1px solid #fef3c7', overflow: 'hidden',
              }}>
                {/* ヘッダー */}
                <div className="no-print" style={{
                  padding: '0.85rem 1.5rem', borderBottom: '1px solid #fef3c7',
                  background: 'linear-gradient(135deg, #92400e, #d97706)',
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                }}>
                  <span style={{ fontSize: '1.1rem' }}>🏠</span>
                  <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>在庫確認リスト（鎌ホ在庫）</span>
                  <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: 4 }}>
                    施設内在庫から用意
                  </span>
                </div>

                {!hasAny ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem' }}>
                    この週は在庫から用意する食材がありません
                  </div>
                ) : (
                  <div style={{ padding: '0.75rem 1rem' }}>
                    {invWeek1.length > 0 && (
                      <div style={{ marginBottom: invWeek2.length > 0 ? '0.75rem' : 0 }}>
                        <div style={weekLabelStyle}>今週</div>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(${invWeek1.length}, minmax(140px, 1fr))`,
                          gap: '0.5rem',
                        }}>
                          {invWeek1.map(date => (
                            <DateCard key={date} date={date} ingredients={inventory.days[date] ?? []} isPast={!isFutureOrToday(date)} accentColor="#d97706" />
                          ))}
                        </div>
                      </div>
                    )}
                    {invWeek2.length > 0 && (
                      <div>
                        <div style={weekLabelStyle}>翌週</div>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(${invWeek2.length}, minmax(140px, 1fr))`,
                          gap: '0.5rem',
                        }}>
                          {invWeek2.map(date => (
                            <DateCard key={date} date={date} ingredients={inventory.days[date] ?? []} isPast={!isFutureOrToday(date)} accentColor="#d97706" />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      ) : null}
    </div>
  )
}

// ----------------------------------------
// 日付カード（読み取り専用）
// ----------------------------------------
function DateCard({
  date, ingredients, isPast, accentColor = '#1a3a5c',
}: {
  date: string
  ingredients: { name: string; amount: number; unit: string }[]
  isPast: boolean
  accentColor?: string
}) {
  return (
    <div className="date-card" style={{
      border: `1px solid ${isPast ? '#f3f4f6' : '#e5e7eb'}`,
      borderRadius: 8, overflow: 'hidden',
      opacity: isPast ? 0.5 : 1,
    }}>
      {/* 日付ヘッダー */}
      <div style={{
        background: isPast ? '#f9fafb' : '#f8fafc',
        padding: '0.35rem 0.6rem',
        fontSize: '0.82rem', fontWeight: 700,
        color: isPast ? '#9ca3af' : accentColor,
        borderBottom: `2px solid ${isPast ? '#f3f4f6' : '#e2e8f0'}`,
        display: 'flex', alignItems: 'center', gap: '0.35rem',
      }}>
        {formatDate(date)}
        {isPast && <span style={{ fontSize: '0.7rem', color: '#d1d5db', fontWeight: 400 }}>（過去）</span>}
      </div>

      {/* 食材リスト */}
      <div style={{ padding: '0.4rem 0.6rem' }}>
        {ingredients.length === 0 ? (
          <div style={{ fontSize: '0.78rem', color: '#d1d5db', textAlign: 'center', padding: '0.3rem 0' }}>食材なし</div>
        ) : (
          ingredients.map((ing, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              padding: '0.15rem 0', fontSize: '0.82rem',
              borderBottom: i < ingredients.length - 1 ? '1px dashed #f1f5f9' : 'none',
            }}>
              <span style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '0.4rem' }}>
                {ing.name}
              </span>
              <span style={{ color: '#6b7280', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {ing.amount % 1 === 0 ? ing.amount : ing.amount.toFixed(2)}{ing.unit}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ----------------------------------------
// スタイル定数
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

const weekLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  color: '#9ca3af',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.4rem',
  paddingBottom: '0.2rem',
  borderBottom: '1px solid #f1f5f9',
}
