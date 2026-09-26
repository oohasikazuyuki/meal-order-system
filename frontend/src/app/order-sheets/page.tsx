'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import {
  fetchOrderSheetPreview,
  fetchOrderSheetPdf,
  fetchInventoryPreview,
  type OrderSheetPreviewResponse,
  type InventoryPreviewResponse,
} from '../_lib/api/client'
import { getMondayOf, addWeeks, addDays, todayStr, formatShort } from '../_lib/date'
import WeekBar from '../_components/WeekBar'
import { usePdfDocument } from '../_lib/usePdfDocument'

const PdfViewerModal = dynamic(() => import('../_components/PdfViewerModal'), { ssr: false })

type Ingredient = { name: string; amount: number; unit: string }

export default function OrderSheetsPage() {
  const [weekStart, setWeekStart] = useState<string>(() => getMondayOf(new Date()))
  const [preview, setPreview] = useState<OrderSheetPreviewResponse | null>(null)
  const [inventory, setInventory] = useState<InventoryPreviewResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { doc: pdfDoc, pendingKey, error: pdfError, open: openPdf, close: closePdf } = usePdfDocument()
  const [today, setToday] = useState('')

  useEffect(() => setToday(todayStr()), [])

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
      setError('食材の集計を取得できませんでした。通信を確認して、もう一度お試しください。')
      setPreview(null)
      setInventory(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPreview(weekStart)
  }, [weekStart, loadPreview])

  const handleDownload = (supplierId: number, supplierName: string) =>
    openPdf(
      String(supplierId),
      () => fetchOrderSheetPdf(weekStart, supplierId, {}),
      { title: `${supplierName} 発注書`, fileName: `${supplierName}_${weekStart}週.pdf` },
      `${supplierName}の発注書を作成できませんでした。もう一度お試しください。`
    )

  const week2Start = addWeeks(weekStart, 1)
  const isFutureOrToday = (dateStr: string) => !!today && dateStr >= today

  // 2週間のどの日に食材があるか（ストリップの注記に使う）
  const dayCounts: Record<string, number> = {}
  for (const s of preview?.suppliers ?? []) {
    for (const [date, ings] of Object.entries(s.days)) {
      dayCounts[date] = (dayCounts[date] ?? 0) + (ings?.length ?? 0)
    }
  }

  return (
    <div>
      {pdfDoc && (
        <PdfViewerModal
          url={pdfDoc.url}
          fileName={pdfDoc.fileName}
          title={pdfDoc.title}
          onClose={closePdf}
        />
      )}

      <div className="no-print">
        <WeekBar
          weekStart={weekStart}
          weeks={2}
          onPrev={() => setWeekStart((ws) => addWeeks(ws, -1))}
          onNext={() => setWeekStart((ws) => addWeeks(ws, 1))}
          onThisWeek={() => setWeekStart(getMondayOf(new Date()))}
          busy={loading}
          dayState={(ds) => (dayCounts[ds] > 0 ? 'saved' : 'none')}
          dayLabel={(ds) => (dayCounts[ds] > 0 ? `${dayCounts[ds]}品` : '—')}
        />

        <p className="notice">
          献立に登録されたメニューと食数から食材を集計しています。PDFに載るのは本日以降の納品日だけです。
        </p>
      </div>

      {(error ?? pdfError) && (
        <p className="notice notice--error" role="alert">
          {error ?? pdfError}
        </p>
      )}

      {loading ? (
        <p className="empty">集計しています</p>
      ) : !preview ? null : (
        <>
          {preview.suppliers.map((supplier) => {
            const allDates = Object.keys(supplier.days).sort()
            const futureDates = allDates.filter(isFutureOrToday)

            return (
              <section className="sheet supplier-card" key={supplier.supplier_id}>
                <div className="sheet__head">
                  <h2>{supplier.supplier_name}</h2>
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'rgba(242,245,243,0.7)' }}>
                    {formatShort(weekStart)} 〜 {formatShort(addDays(weekStart, 13))}
                  </span>
                  <div className="sheet__meta">
                    <span>
                      {futureDates.length > 0
                        ? `これから納品 ${futureDates.length} 日分`
                        : 'この期間の納品はありません'}
                    </span>
                    <button
                      type="button"
                      className="btn no-print"
                      onClick={() => handleDownload(supplier.supplier_id, supplier.supplier_name)}
                      disabled={pendingKey === String(supplier.supplier_id) || futureDates.length === 0}
                    >
                      {pendingKey === String(supplier.supplier_id) ? '作成しています' : '発注書を開く'}
                    </button>
                  </div>
                </div>

                {allDates.length === 0 ? (
                  <p className="empty">この期間に発注する食材はありません。</p>
                ) : (
                  <DayColumns
                    dates={allDates}
                    week2Start={week2Start}
                    days={supplier.days}
                    isFutureOrToday={isFutureOrToday}
                  />
                )}
              </section>
            )
          })}

          {inventory &&
            (() => {
              const invDates = Object.keys(inventory.days).sort()
              const hasAny = invDates.some((d) => (inventory.days[d] ?? []).length > 0)
              return (
                <section className="sheet supplier-card">
                  <div className="sheet__head">
                    <h2>施設の在庫から用意するもの</h2>
                    <span style={{ fontSize: 'var(--fs-sm)', color: 'rgba(242,245,243,0.7)' }}>
                      仕入れずに鎌ホ在庫でまかなう食材
                    </span>
                  </div>
                  {!hasAny ? (
                    <p className="empty">この期間に在庫から用意する食材はありません。</p>
                  ) : (
                    <DayColumns
                      dates={invDates}
                      week2Start={week2Start}
                      days={inventory.days}
                      isFutureOrToday={isFutureOrToday}
                    />
                  )}
                </section>
              )
            })()}
        </>
      )}
    </div>
  )
}

function DayColumns({
  dates,
  week2Start,
  days,
  isFutureOrToday,
}: {
  dates: string[]
  week2Start: string
  days: Record<string, Ingredient[]>
  isFutureOrToday: (d: string) => boolean
}) {
  const groups: { label: string; dates: string[] }[] = [
    { label: '今週', dates: dates.filter((d) => d < week2Start) },
    { label: '翌週', dates: dates.filter((d) => d >= week2Start) },
  ].filter((g) => g.dates.length > 0)

  return (
    <div className="sheet__body">
      {groups.map((g) => (
        <div key={g.label} style={{ marginBottom: '0.8rem' }}>
          <p
            style={{
              margin: '0 0 0.35rem',
              paddingBottom: '0.15rem',
              borderBottom: '1px solid var(--rule)',
              fontSize: 'var(--fs-sm)',
              fontWeight: 700,
              color: 'var(--ink-3)',
            }}
          >
            {g.label}
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
              gap: '0.5rem',
            }}
          >
            {g.dates.map((date) => (
              <DateCard
                key={date}
                date={date}
                ingredients={days[date] ?? []}
                isPast={!isFutureOrToday(date)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function DateCard({
  date,
  ingredients,
  isPast,
}: {
  date: string
  ingredients: Ingredient[]
  isPast: boolean
}) {
  return (
    <div
      className="date-card"
      style={{
        border: '1px solid var(--rule)',
        borderRadius: 'var(--r)',
        opacity: isPast ? 0.45 : 1,
      }}
    >
      <p
        style={{
          margin: 0,
          padding: '0.3rem 0.55rem',
          background: 'var(--paper-alt)',
          borderBottom: '1px solid var(--rule)',
          fontWeight: 700,
          fontSize: 'var(--fs-sm)',
        }}
      >
        <span className="num" style={{ textAlign: 'left' }}>
          {formatShort(date)}
        </span>
        {isPast && <span className="muted" style={{ fontWeight: 400 }}> 納品済</span>}
      </p>

      <div style={{ padding: '0.35rem 0.55rem' }}>
        {ingredients.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>
            食材なし
          </p>
        ) : (
          ingredients.map((ing, i) => (
            <div key={i} className="ingline" style={{ borderTop: i > 0 ? undefined : 'none' }}>
              <span className="ingline__name">{ing.name}</span>
              <span className="ingline__amount num">
                {ing.amount % 1 === 0 ? ing.amount : ing.amount.toFixed(2)}
                {ing.unit}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
