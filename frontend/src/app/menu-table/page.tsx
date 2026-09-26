'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import {
  fetchMenuTable,
  fetchMenuTablePdf,
  type MenuTableResponse,
  type MenuTableDay,
  type MealType,
  MEAL_TYPE_LABELS,
} from '../_lib/api/client'
import { getMondayOf, addWeeks, formatShort, DOW_MON_FIRST } from '../_lib/date'
import { getHoliday } from '../_lib/holiday'
import { usePdfDocument } from '../_lib/usePdfDocument'
import WeekBar from '../_components/WeekBar'

const PdfViewerModal = dynamic(() => import('../_components/PdfViewerModal'), { ssr: false })

// 発注先コードの色（献立表PDFのメモ欄と対応させる）
const SUPPLIER_COLORS: Record<string, { color: string; bg: string }> = {
  C: { color: 'var(--tag-1)', bg: 'var(--tag-1-bg)' }, // COOP
  Y: { color: 'var(--tag-2)', bg: 'var(--tag-2-bg)' }, // 八百喜
  M: { color: 'var(--tag-4)', bg: 'var(--tag-4-bg)' }, // 河野
  F: { color: 'var(--tag-3)', bg: 'var(--tag-3-bg)' }, // 魚丹
  S: { color: '#6b4b8a', bg: '#f0ecf5' }, // スーパー
  Z: { color: 'var(--ink-3)', bg: 'var(--paper-alt)' }, // 在庫
}

const SUPPLIER_NAMES: Record<string, string> = {
  C: 'COOP',
  Y: '八百喜',
  M: '河野',
  F: '魚丹',
  S: 'スーパー',
  Z: '在庫',
}

function supplierColor(code: string) {
  return SUPPLIER_COLORS[(code || '').toUpperCase()] ?? { color: 'var(--ink-3)', bg: 'var(--paper-alt)' }
}

function formatAmount(amount: number): string {
  return amount % 1 === 0 ? String(amount) : amount.toFixed(2)
}

type ViewType = 'staff' | 'children'

export default function MenuTablePage() {
  const [weekStart, setWeekStart] = useState<string>(() => getMondayOf(new Date()))
  const [preview, setPreview] = useState<MenuTableResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const { doc: pdfDoc, pendingKey, error, setError, open: openPdf, close: closePdf } = usePdfDocument()
  const [viewType, setViewType] = useState<ViewType>('staff')

  const loadPreview = useCallback(async (ws: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchMenuTable(ws)
      setPreview(res.data)
    } catch {
      setError('献立を読み込めませんでした。通信を確認して、もう一度お試しください。')
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPreview(weekStart)
  }, [weekStart, loadPreview])

  const handlePrint = (type: ViewType) => {
    const label = type === 'children' ? '子供用' : '職員用'
    return openPdf(
      type,
      () => fetchMenuTablePdf(weekStart, type),
      { title: `献立表（${label}）`, fileName: `献立表_${label}_${weekStart}週.pdf` },
      '献立表を作成できませんでした。もう一度お試しください。'
    )
  }

  const menuCountOn = (ds: string) => {
    const day = preview?.days.find((d) => d.date === ds)
    if (!day) return 0
    return Object.values(day.meals ?? {}).reduce((s, m) => s + (m?.length ?? 0), 0)
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

      <WeekBar
        weekStart={weekStart}
        onPrev={() => setWeekStart((ws) => addWeeks(ws, -1))}
        onNext={() => setWeekStart((ws) => addWeeks(ws, 1))}
        onThisWeek={() => setWeekStart(getMondayOf(new Date()))}
        busy={loading}
        dayState={(ds) => (menuCountOn(ds) > 0 ? 'saved' : 'none')}
        dayLabel={(ds) => (menuCountOn(ds) > 0 ? `${menuCountOn(ds)}品` : '—')}
        tools={
          <>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => handlePrint('staff')}
              disabled={pendingKey !== null || !preview}
            >
              {pendingKey === 'staff' ? '作成しています' : '職員用を印刷'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => handlePrint('children')}
              disabled={pendingKey !== null || !preview}
            >
              {pendingKey === 'children' ? '作成しています' : '子供用を印刷'}
            </button>
          </>
        }
      />

      <div
        style={{
          display: 'flex',
          gap: '0.8rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '0.9rem',
        }}
      >
        <div className="btnrow" role="group" aria-label="表示の切り替え">
          {(['staff', 'children'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={viewType === t ? 'btn btn--primary' : 'btn'}
              aria-pressed={viewType === t}
              onClick={() => setViewType(t)}
            >
              {t === 'staff' ? '食材まで見る' : '献立名だけ見る'}
            </button>
          ))}
        </div>

        {viewType === 'staff' && (
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginLeft: 'auto' }}>
            {Object.entries(SUPPLIER_NAMES).map(([code, label]) => {
              const sc = supplierColor(code)
              return (
                <span key={code} className="tag" style={{ color: sc.color, background: sc.bg }}>
                  {code} {label}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="empty">読み込んでいます</p>
      ) : preview ? (
        <div style={{ overflowX: 'auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(200px, 1fr))',
              gap: '0.6rem',
            }}
          >
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <DayColumn key={i} dayIndex={i} dayData={preview.days[i]} viewType={viewType} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function DayColumn({
  dayIndex,
  dayData,
  viewType,
}: {
  dayIndex: number
  dayData: MenuTableDay | undefined
  viewType: ViewType
}) {
  const dateStr = dayData?.date ?? ''
  const meals = dayData?.meals ?? {}
  const hasMeals = Object.values(meals).some((m) => m && m.length > 0)
  const holiday = dateStr ? getHoliday(dateStr) : null

  return (
    <div
      className="date-card"
      style={{
        background: 'var(--paper)',
        border: '1px solid var(--rule)',
        borderRadius: 'var(--r)',
      }}
    >
      <p
        style={{
          margin: 0,
          padding: '0.4rem 0.6rem',
          // 見出しは地が濃いので、休みの日は薄く染めるのではなく地の色を変える
          background: holiday || dayIndex === 6 ? 'var(--ink-sun)' : dayIndex === 5 ? 'var(--ink-sat)' : 'var(--ink)',
          color: 'var(--on-ink)',
          textAlign: 'center',
          fontWeight: 700,
          borderRadius: 'calc(var(--r) - 1px) calc(var(--r) - 1px) 0 0',
        }}
      >
        {DOW_MON_FIRST[dayIndex]}
        {holiday && (
          <span style={{ marginLeft: '0.4rem', fontSize: 'var(--fs-sm)' }}>{holiday}</span>
        )}
        {dateStr && (
          <span
            className="num"
            style={{
              display: 'block',
              textAlign: 'center',
              fontWeight: 400,
              fontSize: 'var(--fs-sm)',
              color: 'rgba(242,245,243,0.75)',
            }}
          >
            {formatShort(dateStr)}
          </span>
        )}
      </p>

      {!hasMeals ? (
        <p className="muted" style={{ margin: 0, padding: '0.8rem', textAlign: 'center', fontSize: 'var(--fs-sm)' }}>
          献立なし
        </p>
      ) : (
        (['1', '2', '3'] as const).map((mt) => {
          const menus = meals[mt]
          if (!menus || menus.length === 0) return null
          return (
            <MealBlock
              key={mt}
              mealType={Number(mt) as MealType}
              menus={menus}
              viewType={viewType}
            />
          )
        })
      )}
    </div>
  )
}

function MealBlock({
  mealType,
  menus,
  viewType,
}: {
  mealType: MealType
  menus: {
    menu_name: string
    ingredients: {
      name: string
      amount: number
      unit: string
      supplier_code: string
      delivery_date: string
    }[]
  }[]
  viewType: ViewType
}) {
  // 外食があればその日はそちらを表示する
  const hasEatingOut = menus.some((m) => m.menu_name.startsWith('外食'))
  const displayMenus = hasEatingOut ? menus.filter((m) => m.menu_name.startsWith('外食')) : menus

  return (
    <div className="mealband" data-meal={mealType} style={{ borderTop: '1px solid var(--rule-soft)' }}>
      <p
        style={{
          margin: 0,
          padding: '0.2rem 0.55rem',
          background: 'var(--paper-alt)',
          borderBottom: '1px solid var(--rule-soft)',
          fontSize: 'var(--fs-xs)',
          fontWeight: 700,
          color: 'var(--ink-3)',
        }}
      >
        {MEAL_TYPE_LABELS[mealType]}
      </p>

      <div style={{ padding: '0.4rem 0.55rem' }}>
        {displayMenus.map((menu, mi) => (
          <div key={mi} style={{ marginTop: mi > 0 ? '0.5rem' : 0 }}>
            <p style={{ margin: 0, fontWeight: 700, lineHeight: 1.4, wordBreak: 'break-word' }}>
              {menu.menu_name}
            </p>

            {viewType === 'staff' &&
              !menu.menu_name.startsWith('外食') &&
              menu.ingredients.map((ing, ii) => {
                const sc = supplierColor(ing.supplier_code)
                return (
                  <div key={ii} className="ingline">
                    <span className="ingline__name">{ing.name}</span>
                    <span className="ingline__amount num">
                      {formatAmount(ing.amount)}
                      {ing.unit}
                    </span>
                    {(ing.supplier_code || ing.delivery_date) && (
                      <span className="ingline__meta">
                        {ing.supplier_code && (
                          <span className="tag" style={{ color: sc.color, background: sc.bg }}>
                            {ing.supplier_code}
                          </span>
                        )}
                        {ing.delivery_date && (
                          <span className="tag tag--plain">納品 {ing.delivery_date}</span>
                        )}
                      </span>
                    )}
                  </div>
                )
              })}
          </div>
        ))}
      </div>
    </div>
  )
}
