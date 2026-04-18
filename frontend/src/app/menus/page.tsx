'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchMenusByMonth, saveMenu, deleteMenu,
  fetchMenuMasters, fetchBlocks, fetchMenuTablePdf, suggestMenuByAi, scheduleMenusRoutine,
  fetchBirthdayMenuDates,
  MEAL_TYPE_LABELS, type MealType, type MenuItem, type MenuMaster, type Block, type AiMenuSuggestResponse,
} from '../_lib/api/client'
import { getStoredUser } from '../_lib/auth'

const MEAL_TYPES: MealType[] = [1, 2, 3, 4]

const MEAL_COLORS: Record<MealType, { bg: string; text: string; light: string; border: string }> = {
  1: { bg: '#f59e0b', text: '#92400e', light: '#fef9ec', border: '#fcd34d' },
  2: { bg: '#10b981', text: '#065f46', light: '#ecfdf5', border: '#6ee7b7' },
  3: { bg: '#6366f1', text: '#3730a3', light: '#eef2ff', border: '#a5b4fc' },
  4: { bg: '#f43f5e', text: '#881337', light: '#fff1f2', border: '#fda4af' },
}

const DOW = ['日', '月', '火', '水', '木', '金', '土']
const AI_PUBLIC_ENABLED = process.env.NEXT_PUBLIC_AI_PUBLIC_ENABLED === 'true'

function buildCalendar(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function toMonthStr(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function shiftMonth(base: Date, delta: number): string {
  const d = new Date(base.getFullYear(), base.getMonth(), 1)
  d.setMonth(d.getMonth() + delta)
  return toMonthStr(d.getFullYear(), d.getMonth() + 1)
}

function formatDateJa(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${dow}）`
}

// ========================
// メインページ（献立管理）
// ========================
export default function MenusPage() {
  const today = new Date()
  const todayStr = toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate())

  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [masters, setMasters] = useState<MenuMaster[]>([])
  const [birthdayDates, setBirthdayDates] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [monthAiRunning, setMonthAiRunning] = useState(false)
  const [monthAiProgress, setMonthAiProgress] = useState<string | null>(null)
  const [modalDate, setModalDate] = useState<string | null>(null)
  const [copyOpen, setCopyOpen] = useState(false)
  const [copyRunning, setCopyRunning] = useState(false)
  const [copySourceMonth, setCopySourceMonth] = useState(shiftMonth(today, 0))
  const [copyTargetMonth, setCopyTargetMonth] = useState(shiftMonth(today, 2))
  const [copyTargetEndMonth, setCopyTargetEndMonth] = useState(shiftMonth(today, 4))
  const [copyCycleMonths, setCopyCycleMonths] = useState(2)
  const [copyIncludeBirthday, setCopyIncludeBirthday] = useState(true)
  const [copyOverwrite, setCopyOverwrite] = useState(false)
  const [weekDl, setWeekDl] = useState<Record<string, 'staff' | 'children' | null>>({})

  const user = getStoredUser()
  const isAdmin = user?.role === 'admin'
  const userBlockId = user?.block_id ?? null
  const canRoutineCopy = isAdmin || userBlockId !== null

  const load = useCallback(async (y: number, m: number): Promise<MenuItem[]> => {
    setLoading(true)
    try {
      const [menusRes, bdRes] = await Promise.all([
        fetchMenusByMonth(y, m),
        fetchBirthdayMenuDates(y, m),
      ])
      setMenus(menusRes.data.menus)
      setBirthdayDates(new Set(bdRes.data.birthday_menu_dates.map(b => b.menu_date)))
      return menusRes.data.menus
    } catch {
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(year, month) }, [year, month, load])

  useEffect(() => {
    // 初回のみ実行（ブロックとマスターは頻繁に変わらないため）
    Promise.all([
      fetchBlocks().then(r => setBlocks(r.data.blocks)),
      fetchMenuMasters().then(r => setMasters(r.data.menu_masters))
    ]).catch(() => {})
  }, [])

  const goPrev = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const goNext = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }
  const goToday = () => {
    setYear(today.getFullYear())
    setMonth(today.getMonth() + 1)
  }

  const menusForDate = (dateStr: string) => menus.filter(m => m.menu_date === dateStr)
  const weeks = buildCalendar(year, month)
  const daysInMonth = new Date(year, month, 0).getDate()

  // カレンダーセルのバッジ（登録済み食事種別）
  const mealBadges = (dateStr: string) => {
    const dayMenus = menusForDate(dateStr)
    return MEAL_TYPES.filter(mt => dayMenus.some(m => m.meal_type === mt))
  }

  const handleDayClick = (day: number | null) => {
    if (!day) return
    setModalDate(toDateStr(year, month, day))
  }

  const handleModalSaved = async () => {
    await load(year, month)
  }

  /** 週行から月曜日の日付文字列を取得 */
  const getMondayOfWeek = (week: (number | null)[]): string => {
    const dayIndex = week.findIndex(d => d !== null)
    if (dayIndex === -1) return ''
    const day = week[dayIndex]!
    const d = new Date(year, month - 1, day)
    const dow = d.getDay() === 0 ? 7 : d.getDay()
    const mon = new Date(year, month - 1, day - (dow - 1))
    return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`
  }

  const handleWeekPrint = async (weekStart: string, type: 'staff' | 'children') => {
    setWeekDl(prev => ({ ...prev, [weekStart + type]: type }))
    try {
      const res = await fetchMenuTablePdf(weekStart, type)
      const label = type === 'children' ? '子供用' : '職員用'
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const w = window.open(url, '_blank')
      if (w) {
        w.onload = () => {
          try { w.print() } catch {}
        }
      } else {
        // ポップアップブロック時はダウンロードにフォールバック
        const a = document.createElement('a')
        a.href = url
        a.download = `献立表_${label}_${weekStart}週.pdf`
        a.click()
      }
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch {
      alert('献立表の印刷データ取得に失敗しました')
    } finally {
      setWeekDl(prev => ({ ...prev, [weekStart + type]: null }))
    }
  }

  const handleMonthAiAdd = async () => {
    if (monthAiRunning) return
    if (!confirm(`${year}年${month}月にAI提案を追加します。既存献立がある食事種別はスキップします。実行しますか？`)) return
    if (blocks.length === 0) {
      alert('ブロックが未登録です')
      return
    }

    setMonthAiRunning(true)
    setMonthAiProgress('準備中...')
    let addedCount = 0
    const targetBlocks = isAdmin ? blocks : blocks.filter(b => b.id === userBlockId)

    try {
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = toDateStr(year, month, day)
        setMonthAiProgress(`${day}/${daysInMonth}日を処理中...`)
        const dayMenus = menus.filter(m => m.menu_date === dateStr)

        for (const block of targetBlocks) {
          const existingByMeal: Record<string, string[]> = {}
          for (const mt of MEAL_TYPES) {
            existingByMeal[String(mt)] = dayMenus
              .filter(m => m.block_id === block.id && m.meal_type === mt)
              .map(m => m.name)
          }

          const res = await suggestMenuByAi({
            date: dateStr,
            block_id: block.id,
            existing_by_meal: existingByMeal,
          })
          const suggestions = res.data?.suggestions ?? {}

          for (const mt of MEAL_TYPES) {
            // 既存がある食事は追加しない（上書きを防ぐ）
            if ((existingByMeal[String(mt)] ?? []).length > 0) continue
            const byCategory = suggestions[String(mt)] ?? {}
            for (const [dishCategory, name] of Object.entries(byCategory)) {
              if (!name) continue
              await saveMenu({
                name,
                menu_date: dateStr,
                meal_type: mt,
                block_id: block.id,
                dish_category: dishCategory,
              })
              addedCount++
            }
          }
        }
      }

      await load(year, month)
      setMonthAiProgress(`完了: ${addedCount}件を追加しました`)
    } catch {
      setMonthAiProgress('AI追加に失敗しました')
    } finally {
      setMonthAiRunning(false)
      setTimeout(() => setMonthAiProgress(null), 5000)
    }
  }

  const handleRoutineCopy = async () => {
    if (copyRunning) return
    if (!canRoutineCopy) {
      alert('担当ブロック未設定のためコピーできません')
      return
    }
    if (!copySourceMonth || !copyTargetMonth || !copyTargetEndMonth) {
      alert('コピー元月・コピー先開始月・コピー先終了月を選択してください')
      return
    }
    if (copyTargetMonth > copyTargetEndMonth) {
      alert('コピー先終了月はコピー先開始月以降にしてください')
      return
    }
    // source_end = source_start + cycle_months - 1日
    const srcStart = new Date(`${copySourceMonth}-01T00:00:00`)
    const srcEnd = new Date(srcStart.getFullYear(), srcStart.getMonth() + copyCycleMonths, 0)
    const srcEndStr = `${srcEnd.getFullYear()}-${String(srcEnd.getMonth() + 1).padStart(2, '0')}-${String(srcEnd.getDate()).padStart(2, '0')}`
    // target_end = last day of copyTargetEndMonth
    const tgtEnd = new Date(parseInt(copyTargetEndMonth.split('-')[0]), parseInt(copyTargetEndMonth.split('-')[1]), 0)
    const tgtEndStr = `${tgtEnd.getFullYear()}-${String(tgtEnd.getMonth() + 1).padStart(2, '0')}-${String(tgtEnd.getDate()).padStart(2, '0')}`

    setCopyRunning(true)
    try {
      const res = await scheduleMenusRoutine({
        source_start: `${copySourceMonth}-01`,
        source_end: srcEndStr,
        target_start: `${copyTargetMonth}-01`,
        target_end: tgtEndStr,
        cycle_months: copyCycleMonths,
        include_birthday_menu: copyIncludeBirthday,
        overwrite: copyOverwrite,
        block_id: isAdmin ? null : userBlockId,
      })
      const d = res.data
      if (!d.ok) {
        alert(`周期ルーティン登録に失敗しました\n${d.message ?? ''}`)
        return
      }
      await load(year, month)
      alert(`周期ルーティン登録が完了しました\nコピー件数: ${d.copied}件\nスキップ: ${d.skipped}件\n繰り返し回数: ${d.cycles}回\n期間: ${d.target_start}〜${d.target_end}`)
      setCopyOpen(false)
    } catch (e) {
      console.error('[scheduleRoutine] error:', e)
      const msg = e instanceof Error ? e.message : String(e)
      alert(`周期ルーティン登録に失敗しました\n${msg}`)
    } finally {
      setCopyRunning(false)
    }
  }

  return (
    <div>
      {/* ── カレンダーヘッダー ── */}
      <div style={{
        background: '#fff', borderRadius: 12, padding: '1rem 1.5rem',
        marginBottom: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        display: 'flex', alignItems: 'center', gap: '1rem',
      }}>
        <button onClick={goPrev} style={navBtn}>&#8249;</button>
        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#1a202c', minWidth: 160, textAlign: 'center' }}>
          {year}年 {month}月
        </h2>
        <button onClick={goNext} style={navBtn}>&#8250;</button>
        <button onClick={goToday} style={todayBtn}>今月</button>
        <button
          onClick={() => setCopyOpen(true)}
          disabled={!canRoutineCopy}
          style={{
            ...todayBtn,
            background: '#0b4a6f',
            color: '#fff',
            border: 'none',
            fontWeight: 700,
            opacity: canRoutineCopy ? 1 : 0.5,
            cursor: canRoutineCopy ? 'pointer' : 'not-allowed',
          }}
        >
          周期登録
        </button>
        {AI_PUBLIC_ENABLED && (
          <button
            onClick={handleMonthAiAdd}
            disabled={monthAiRunning}
            style={{
              ...todayBtn,
              background: monthAiRunning ? '#94a3b8' : '#0f766e',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
            }}
          >
            {monthAiRunning ? 'AI追加中...' : '🤖 今月AI追加'}
          </button>
        )}
        {loading && <span style={{ color: '#9ca3af', fontSize: '0.85rem', marginLeft: 4 }}>読み込み中...</span>}
        {AI_PUBLIC_ENABLED && monthAiProgress && <span style={{ color: '#0f766e', fontSize: '0.85rem', marginLeft: 4 }}>{monthAiProgress}</span>}
        <div style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#9ca3af' }}>
          日付をクリックして献立を登録
        </div>
      </div>

      {/* ── カレンダーグリッド ── */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {/* 曜日ヘッダー */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr) 76px', borderBottom: '2px solid #e2e8f0' }}>
          {DOW.map((d, i) => (
            <div key={d} style={{
              padding: '0.65rem 0', textAlign: 'center', fontSize: '0.78rem', fontWeight: 700,
              color: i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : '#6b7280',
              borderRight: '1px solid #f1f5f9',
            }}>
              {d}
            </div>
          ))}
          <div style={{
            padding: '0.65rem 0', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700,
            color: '#9ca3af', background: '#f8fafc',
          }}>
            献立表
          </div>
        </div>

        {/* 日付セル */}
        {weeks.map((week, wi) => {
          const weekStart = getMondayOfWeek(week)
          return (
            <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr) 76px', borderBottom: '1px solid #f1f5f9' }}>
              {week.map((day, di) => {
                const dateStr = day ? toDateStr(year, month, day) : ''
                const badges = day ? mealBadges(dateStr) : []
                const isToday = dateStr === todayStr
                const isBirthday = day ? birthdayDates.has(dateStr) : false
                const isSun = di === 0
                const isSat = di === 6
                const hasMenus = badges.length > 0

                return (
                  <div
                    key={di}
                    onClick={() => handleDayClick(day)}
                    style={{
                      minHeight: 90,
                      padding: '0.5rem',
                      borderRight: '1px solid #f1f5f9',
                      background: hasMenus && day ? '#fafffe' : '#fff',
                      cursor: day ? 'pointer' : 'default',
                      transition: 'background 0.12s',
                      position: 'relative',
                    }}
                    onMouseEnter={e => { if (day) (e.currentTarget as HTMLDivElement).style.background = '#f0f7ff' }}
                    onMouseLeave={e => { if (day) (e.currentTarget as HTMLDivElement).style.background = hasMenus ? '#fafffe' : '#fff' }}
                  >
                    {day && (
                      <>
                        {/* 日付数字 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.3rem' }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: isToday ? '#1a3a5c' : 'transparent',
                            color: isToday ? '#fff' : isSun ? '#ef4444' : isSat ? '#3b82f6' : '#374151',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.84rem', fontWeight: isToday ? 700 : 500,
                            flexShrink: 0,
                          }}>
                            {day}
                          </div>
                          {isBirthday && (
                            <span title="誕生日メニュー" style={{ fontSize: '0.85rem', lineHeight: 1 }}>🎂</span>
                          )}
                        </div>

                        {/* 献立バッジ */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.18rem' }}>
                          {badges.map(mt => {
                            const registeredCount = menusForDate(dateStr).filter(m => m.meal_type === mt).length
                            const totalBlocks = isAdmin ? blocks.length : (userBlockId ? 1 : 0)
                            const c = MEAL_COLORS[mt]
                            return (
                              <div key={mt} style={{
                                fontSize: '0.62rem', padding: '0.1rem 0.3rem',
                                borderRadius: 4,
                                background: c.light,
                                color: c.text,
                                border: `1px solid ${c.border}`,
                                fontWeight: 600,
                                display: 'flex', alignItems: 'center', gap: '0.2rem',
                                width: 'fit-content',
                              }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.bg, flexShrink: 0 }} />
                                {MEAL_TYPE_LABELS[mt]}
                                {totalBlocks > 0 && (
                                  <span style={{ opacity: 0.7 }}>{registeredCount}/{totalBlocks}</span>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {/* 編集ヒント */}
                        <div style={{
                          position: 'absolute', bottom: 4, right: 5,
                          fontSize: '0.6rem', color: '#cbd5e1', fontWeight: 500,
                        }}>
                          ✏
                        </div>
                      </>
                    )}
                  </div>
                )
              })}

              {/* 献立表ダウンロードボタン列 */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '0.3rem', padding: '0.4rem 0.25rem',
                background: '#f8fafc', borderLeft: '1px solid #e2e8f0',
              }}>
                {weekStart ? (
                  <>
                    <button
                      onClick={() => handleWeekPrint(weekStart, 'staff')}
                      disabled={weekDl[weekStart + 'staff'] !== undefined && weekDl[weekStart + 'staff'] !== null}
                      title={`職員用献立表を印刷 (${weekStart}週)`}
                      style={{
                        width: 62, padding: '0.22rem 0', fontSize: '0.62rem', fontWeight: 700,
                        background: '#1a3a5c', color: '#fff',
                        border: 'none', borderRadius: 5, cursor: 'pointer',
                        opacity: weekDl[weekStart + 'staff'] ? 0.6 : 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {weekDl[weekStart + 'staff'] ? '⏳' : '🖨 職員用'}
                    </button>
                    <button
                      onClick={() => handleWeekPrint(weekStart, 'children')}
                      disabled={weekDl[weekStart + 'children'] !== undefined && weekDl[weekStart + 'children'] !== null}
                      title={`子供用献立表を印刷 (${weekStart}週)`}
                      style={{
                        width: 62, padding: '0.22rem 0', fontSize: '0.62rem', fontWeight: 700,
                        background: '#059669', color: '#fff',
                        border: 'none', borderRadius: 5, cursor: 'pointer',
                        opacity: weekDl[weekStart + 'children'] ? 0.6 : 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {weekDl[weekStart + 'children'] ? '⏳' : '🖨 子供用'}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── 凡例 ── */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', padding: '0 0.25rem', flexWrap: 'wrap' }}>
        {MEAL_TYPES.map(mt => (
          <div key={mt} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: '#6b7280' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: MEAL_COLORS[mt].bg, display: 'inline-block' }} />
            {MEAL_TYPE_LABELS[mt]}
          </div>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#9ca3af' }}>
          バッジの数字は登録済みブロック数 / 全ブロック数
        </span>
      </div>

      {/* ── モーダル ── */}
      {modalDate && (
        <MenuModal
          date={modalDate}
          menus={menus.filter(m => m.menu_date === modalDate)}
          blocks={blocks}
          masters={masters}
          isAdmin={isAdmin}
          userBlockId={userBlockId}
          onSaved={handleModalSaved}
          onClose={() => setModalDate(null)}
        />
      )}

      {copyOpen && (
        <RoutineCopyModal
          sourceMonth={copySourceMonth}
          targetMonth={copyTargetMonth}
          targetEndMonth={copyTargetEndMonth}
          cycleMonths={copyCycleMonths}
          includeBirthday={copyIncludeBirthday}
          overwrite={copyOverwrite}
          running={copyRunning}
          onChangeSource={setCopySourceMonth}
          onChangeTarget={setCopyTargetMonth}
          onChangeTargetEnd={setCopyTargetEndMonth}
          onChangeCycleMonths={setCopyCycleMonths}
          onChangeIncludeBirthday={setCopyIncludeBirthday}
          onChangeOverwrite={setCopyOverwrite}
          onClose={() => setCopyOpen(false)}
          onSubmit={handleRoutineCopy}
        />
      )}
    </div>
  )
}

// ========================
// 献立選択モーダル
// ========================
interface MenuModalProps {
  date: string
  menus: MenuItem[]
  blocks: Block[]
  masters: MenuMaster[]
  isAdmin: boolean
  userBlockId: number | null
  onSaved: () => Promise<void>
  onClose: () => void
}

interface RoutineCopyModalProps {
  sourceMonth: string
  targetMonth: string
  targetEndMonth: string
  cycleMonths: number
  includeBirthday: boolean
  overwrite: boolean
  running: boolean
  onChangeSource: (v: string) => void
  onChangeTarget: (v: string) => void
  onChangeTargetEnd: (v: string) => void
  onChangeCycleMonths: (v: number) => void
  onChangeIncludeBirthday: (v: boolean) => void
  onChangeOverwrite: (v: boolean) => void
  onClose: () => void
  onSubmit: () => void
}

function RoutineCopyModal({
  sourceMonth,
  targetMonth,
  targetEndMonth,
  cycleMonths,
  includeBirthday,
  overwrite,
  running,
  onChangeSource,
  onChangeTarget,
  onChangeTargetEnd,
  onChangeCycleMonths,
  onChangeIncludeBirthday,
  onChangeOverwrite,
  onClose,
  onSubmit,
}: RoutineCopyModalProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '1rem 1.2rem', background: '#0b4a6f', color: '#fff', fontWeight: 700 }}>
          周期ルーティン スケジュール登録
        </div>
        <div style={{ padding: '1rem 1.2rem', display: 'grid', gap: '0.85rem' }}>
          <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.84rem', color: '#334155' }}>
            コピー元（開始月）
            <input type="month" value={sourceMonth} onChange={e => onChangeSource(e.target.value)} style={copyInputStyle} />
          </label>
          <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.84rem', color: '#334155' }}>
            繰り返し周期（ヶ月）
            <select
              value={cycleMonths}
              onChange={e => onChangeCycleMonths(Number(e.target.value))}
              style={copyInputStyle}
            >
              {[1, 2, 3, 4, 6].map(n => (
                <option key={n} value={n}>{n}ヶ月周期</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.84rem', color: '#334155' }}>
            コピー先（開始月）
            <input type="month" value={targetMonth} onChange={e => onChangeTarget(e.target.value)} style={copyInputStyle} />
          </label>
          <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.84rem', color: '#334155' }}>
            コピー先（終了月）
            <input type="month" value={targetEndMonth} onChange={e => onChangeTargetEnd(e.target.value)} style={copyInputStyle} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.84rem', color: '#334155' }}>
            <input
              type="checkbox"
              checked={includeBirthday}
              onChange={e => onChangeIncludeBirthday(e.target.checked)}
            />
            誕生日メニューを含める
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.84rem', color: '#334155' }}>
            <input
              type="checkbox"
              checked={overwrite}
              onChange={e => onChangeOverwrite(e.target.checked)}
            />
            既存の献立を上書きする（オフの場合はスキップ）
          </label>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            コピー元の{cycleMonths}ヶ月分献立パターンを、コピー先期間に{cycleMonths}ヶ月周期で繰り返し登録します。
          </div>
        </div>
        <div style={{ padding: '0.85rem 1.2rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
          <button onClick={onClose} disabled={running} style={copyCancelBtn}>閉じる</button>
          <button onClick={onSubmit} disabled={running} style={copyRunBtn}>
            {running ? '実行中...' : `${cycleMonths}ヶ月周期で登録`}
          </button>
        </div>
      </div>
    </div>
  )
}

interface Selections {
  [blockId: number]: Record<MealType, number[]>
}

interface EatingOutEntry {
  enabled: boolean
  location: string
}

interface EatingOut {
  [blockId: number]: Record<MealType, EatingOutEntry>
}

/** 外食メニュー名からlocationを抽出 */
function parseEatingOutName(name: string): { isEatingOut: boolean; location: string } {
  if (!name.startsWith('外食')) return { isEatingOut: false, location: '' }
  const m = name.match(/^外食（(.+)）$/)
  return { isEatingOut: true, location: m ? m[1] : '' }
}

/** 外食情報を組み立てる */
function buildEatingOut(menus: MenuItem[], blocks: Block[]): EatingOut {
  const eo: EatingOut = {}
  for (const b of blocks) {
    const row = {} as Record<MealType, EatingOutEntry>
    for (const mt of MEAL_TYPES) {
      const dayMenus = menus.filter(m => m.meal_type === mt && m.block_id === b.id)
      const eoMenu = dayMenus.find(m => m.name.startsWith('外食'))
      if (eoMenu) {
        const parsed = parseEatingOutName(eoMenu.name)
        row[mt] = { enabled: true, location: parsed.location }
      } else {
        row[mt] = { enabled: false, location: '' }
      }
    }
    eo[b.id] = row
  }
  return eo
}

function buildSelections(menus: MenuItem[], blocks: Block[], masters: MenuMaster[]): Selections {
  const sel: Selections = {}
  for (const b of blocks) {
    const row = {} as Record<MealType, number[]>
    for (const mt of MEAL_TYPES) {
      const dayMenus = menus.filter(m => m.meal_type === mt && m.block_id === b.id)
      row[mt] = [...new Set(dayMenus
        .filter(m => !m.name.startsWith('外食'))
        .map(m => masters.find(ma => ma.name === m.name && (ma.block_id === null || ma.block_id === b.id))?.id)
        .filter((id): id is number => id !== undefined))]
    }
    sel[b.id] = row
  }
  return sel
}

function MenuModal({ date, menus, blocks, masters, isAdmin, userBlockId, onSaved, onClose }: MenuModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const visibleBlocks = isAdmin ? blocks : blocks.filter(b => b.id === userBlockId)

  const [selections, setSelections] = useState<Selections>(() =>
    buildSelections(menus, blocks, masters)
  )
  const [eatingOut, setEatingOut] = useState<EatingOut>(() =>
    buildEatingOut(menus, blocks)
  )
  const [saving, setSaving] = useState(false)
  const [aiSuggesting, setAiSuggesting] = useState(false)
  const [aiElapsedSec, setAiElapsedSec] = useState(0)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiMessage, setAiMessage] = useState<string | null>(null)

  // ESCキーで閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // スクロール無効化
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    if (!aiSuggesting) return
    setAiElapsedSec(0)
    const started = Date.now()
    const timer = setInterval(() => {
      setAiElapsedSec(Math.floor((Date.now() - started) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [aiSuggesting])

  const mastersForBlock = (blockId: number) =>
    masters.filter(m => m.block_id === null || m.block_id === blockId)

  const addItem = (blockId: number, mt: MealType, masterId: number) => {
    setSelections(prev => {
      const cur = prev[blockId]?.[mt] ?? []
      if (cur.includes(masterId)) return prev
      return { ...prev, [blockId]: { ...prev[blockId], [mt]: [...cur, masterId] } }
    })
    setSaved(false)
    setError(null)
  }

  const removeItem = (blockId: number, mt: MealType, masterId: number) => {
    setSelections(prev => ({
      ...prev,
      [blockId]: {
        ...prev[blockId],
        [mt]: (prev[blockId]?.[mt] ?? []).filter(id => id !== masterId),
      },
    }))
    setSaved(false)
    setError(null)
  }

  const toggleEatingOut = (blockId: number, mt: MealType) => {
    setEatingOut(prev => {
      const cur = prev[blockId]?.[mt] ?? { enabled: false, location: '' }
      return {
        ...prev,
        [blockId]: { ...prev[blockId], [mt]: { ...cur, enabled: !cur.enabled } },
      }
    })
    setSaved(false)
    setError(null)
  }

  const setEatingOutLocation = (blockId: number, mt: MealType, location: string) => {
    setEatingOut(prev => ({
      ...prev,
      [blockId]: { ...prev[blockId], [mt]: { ...(prev[blockId]?.[mt] ?? { enabled: true, location: '' }), location } },
    }))
    setSaved(false)
    setError(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      for (const block of visibleBlocks) {
        const sel = selections[block.id] ?? {}
        const blockMenus = menus.filter(m => m.block_id === block.id)
        for (const mt of MEAL_TYPES) {
          const eo = eatingOut[block.id]?.[mt]
          const existingForMt = blockMenus.filter(m => m.meal_type === mt)

          if (eo?.enabled) {
            // 外食ON: 既存メニューをすべて削除して外食メニューを保存
            for (const existing of existingForMt) {
              if (!existing.name.startsWith('外食')) {
                await deleteMenu(existing.id)
              }
            }
            // 外食メニュー名を組み立て
            const eoName = eo.location.trim() ? `外食（${eo.location.trim()}）` : '外食'
            // 既存の外食メニューがあれば名前が変わった場合のみ差し替え
            const existingEo = existingForMt.find(m => m.name.startsWith('外食'))
            if (existingEo) {
              if (existingEo.name !== eoName) {
                await deleteMenu(existingEo.id)
                await saveMenu({ name: eoName, menu_date: date, meal_type: mt, block_id: block.id })
              }
            } else {
              await saveMenu({ name: eoName, menu_date: date, meal_type: mt, block_id: block.id })
            }
          } else {
            // 外食OFF: 通常の保存フロー
            const newMasterIds = sel[mt] ?? []
            // 選択から外されたメニューを削除（外食メニューも含む）
            for (const existing of existingForMt) {
              if (existing.name.startsWith('外食')) {
                await deleteMenu(existing.id)
                continue
              }
              const master = masters.find(ma => ma.name === existing.name && (ma.block_id === null || ma.block_id === block.id))
              if (!master || !newMasterIds.includes(master.id)) {
                await deleteMenu(existing.id)
              }
            }
            // 新たに選択されたメニューを保存
            for (const masterId of newMasterIds) {
              const master = masters.find(m => m.id === masterId)
              if (master) {
                await saveMenu({
                  name: master.name,
                  menu_date: date,
                  meal_type: mt,
                  block_id: block.id,
                  dish_category: master.dish_category ?? undefined,
                })
              }
            }
          }
        }
      }
      await onSaved()
      setSaved(true)
      setTimeout(() => onClose(), 900)
    } catch {
      setError('保存に失敗しました。もう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  const getSelectedNames = (blockId: number, mt: MealType): string[] => {
    const ids = selections[blockId]?.[mt] ?? []
    const blockMasters = mastersForBlock(blockId)
    return ids
      .map(id => blockMasters.find(m => m.id === id)?.name)
      .filter((v): v is string => !!v)
  }

  const mergeAiSuggestion = (blockId: number, suggestions: Record<string, Record<string, string>>) => {
    const blockMasters = mastersForBlock(blockId)
    setSelections(prev => {
      const next = { ...prev, [blockId]: { ...(prev[blockId] ?? {}) } } as Selections
      for (const mt of MEAL_TYPES) {
        const current = new Set<number>(next[blockId]?.[mt] ?? [])
        const byCategory = suggestions[String(mt)] ?? {}
        for (const name of Object.values(byCategory)) {
          if (!name) continue
          const m = blockMasters.find(mm => mm.name === name)
          if (m) current.add(m.id)
        }
        next[blockId][mt] = Array.from(current)
      }
      return next
    })
  }

  const handleAiSuggest = async () => {
    setAiSuggesting(true)
    setError(null)
    setAiMessage(null)
    try {
      let applied = 0
      for (const block of visibleBlocks) {
        if (!isAdmin && block.id !== userBlockId) continue
        const existingByMeal: Record<string, string[]> = {}
        for (const mt of MEAL_TYPES) {
          existingByMeal[String(mt)] = getSelectedNames(block.id, mt)
        }
        const res = await suggestMenuByAi({
          date,
          block_id: block.id,
          existing_by_meal: existingByMeal,
        })
        const body: AiMenuSuggestResponse = res.data
        if (!body.ok) continue
        mergeAiSuggestion(block.id, body.suggestions ?? {})
        applied++
      }
      if (applied > 0) {
        setAiMessage(`AI提案を${applied}ブロックに反映しました`)
        setSaved(false)
      } else {
        setError('AI提案を反映できませんでした')
      }
    } catch {
      setError('AI提案の取得に失敗しました（Ollama起動状態を確認してください）')
    } finally {
      setAiSuggesting(false)
    }
  }

  // オーバーレイクリックで閉じる
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  const canEdit = isAdmin || userBlockId !== null

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 16,
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        width: '100%', maxWidth: 580,
        maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        animation: 'modalIn 0.18s ease',
      }}>
        {/* ── モーダルヘッダー ── */}
        <div style={{
          padding: '1.1rem 1.5rem',
          background: 'linear-gradient(135deg, #1a3a5c 0%, #1e4976 100%)',
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: '0.7rem', opacity: 0.65, marginBottom: 2, letterSpacing: '0.05em' }}>
              献立設定
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
              {formatDateJa(date)}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)',
              color: '#fff', borderRadius: 8, cursor: 'pointer',
              width: 32, height: 32, fontSize: '1rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* ── ブロック一覧（スクロール可） ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          {/* ブロック未登録 */}
          {blocks.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>⚠️</div>
              ブロックが登録されていません
            </div>
          )}

          {/* 一般ユーザーでブロック未割当 */}
          {!isAdmin && blocks.length > 0 && userBlockId === null && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>🏠</div>
              担当ブロックが割り当てられていません
            </div>
          )}

          {/* ブロックカード */}
          {visibleBlocks.map((block, bi) => {
            const blockMasters = mastersForBlock(block.id)
            const blockCanEdit = isAdmin || block.id === userBlockId

            return (
              <div key={block.id} style={{
                border: '1.5px solid #e5e7eb',
                borderRadius: 10,
                marginBottom: bi < visibleBlocks.length - 1 ? '0.85rem' : 0,
                overflow: 'hidden',
              }}>
                {/* ブロック名 */}
                <div style={{
                  padding: '0.55rem 1rem',
                  background: '#f8fafc',
                  borderBottom: '1px solid #e5e7eb',
                  fontWeight: 700, fontSize: '0.85rem', color: '#1a3a5c',
                }}>
                  🏠 {block.name}
                </div>

                {/* 食事種別グリッド（2×2） */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 0,
                }}>
                  {MEAL_TYPES.map((mt, idx) => {
                    const c = MEAL_COLORS[mt]
                    const eo = eatingOut[block.id]?.[mt] ?? { enabled: false, location: '' }
                    const isEo = eo.enabled
                    const selectedIds = selections[block.id]?.[mt] ?? []
                    const selectedMasters = selectedIds
                      .map(id => blockMasters.find(m => m.id === id))
                      .filter((m): m is MenuMaster => m !== undefined)
                    const availableMasters = blockMasters.filter(m => !selectedIds.includes(m.id))
                    const isRight = idx % 2 === 1
                    const isBottom = idx >= 2

                    return (
                      <div
                        key={mt}
                        style={{
                          padding: '0.65rem 0.75rem',
                          borderRight: !isRight ? '1px solid #f1f5f9' : undefined,
                          borderBottom: !isBottom ? '1px solid #f1f5f9' : undefined,
                          background: isEo ? '#fff7ed' : selectedIds.length > 0 ? c.light : '#fff',
                          transition: 'background 0.12s',
                        }}
                      >
                        {/* 食事種別ラベル + 外食トグル */}
                        <div style={{ marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.1rem 0.5rem', borderRadius: 4,
                            background: c.bg, color: '#fff',
                            fontSize: '0.68rem', fontWeight: 700,
                          }}>
                            {MEAL_TYPE_LABELS[mt]}
                          </span>
                          {!isEo && selectedIds.length > 0 && (
                            <span style={{ fontSize: '0.68rem', color: c.text, fontWeight: 600 }}>
                              {selectedIds.length}品
                            </span>
                          )}
                          {blockCanEdit && (
                            <button
                              type="button"
                              onClick={() => toggleEatingOut(block.id, mt)}
                              style={{
                                marginLeft: 'auto',
                                padding: '0.1rem 0.4rem',
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                borderRadius: 4,
                                border: isEo ? '1.5px solid #ea580c' : '1.5px solid #d1d5db',
                                background: isEo ? '#ea580c' : '#fff',
                                color: isEo ? '#fff' : '#9ca3af',
                                cursor: 'pointer',
                                transition: 'all 0.12s',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              🍽 外食
                            </button>
                          )}
                        </div>

                        {isEo ? (
                          /* 外食ON: 場所入力 */
                          <div>
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: '0.3rem',
                              background: '#fff', border: '1.5px solid #fb923c',
                              borderRadius: 6, padding: '0.3rem 0.4rem',
                            }}>
                              <span style={{ fontSize: '1rem', flexShrink: 0 }}>🍽</span>
                              {blockCanEdit ? (
                                <input
                                  type="text"
                                  placeholder="場所（任意）"
                                  value={eo.location}
                                  onChange={e => setEatingOutLocation(block.id, mt, e.target.value)}
                                  style={{
                                    flex: 1, border: 'none', outline: 'none',
                                    fontSize: '0.78rem', background: 'transparent',
                                    color: '#9a3412', fontWeight: 600,
                                  }}
                                />
                              ) : (
                                <span style={{ fontSize: '0.78rem', color: '#9a3412', fontWeight: 600 }}>
                                  外食{eo.location ? `（${eo.location}）` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          /* 外食OFF: 通常のメニュー選択 */
                          <>
                            {/* 選択済みメニューチップ */}
                            {selectedMasters.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.18rem', marginBottom: '0.3rem' }}>
                                {selectedMasters.map(m => (
                                  <div key={m.id} style={{
                                    display: 'flex', alignItems: 'center',
                                    background: '#fff', border: `1px solid ${c.border}`,
                                    borderRadius: 5, padding: '0.18rem 0.25rem 0.18rem 0.4rem',
                                    gap: '0.2rem',
                                  }}>
                                    <span style={{
                                      flex: 1, color: c.text, fontWeight: 600,
                                      fontSize: '0.78rem', minWidth: 0,
                                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                      {m.name}{m.block_id ? <span style={{ opacity: 0.55, fontSize: '0.68rem' }}> ★</span> : ''}
                                    </span>
                                    {blockCanEdit && (
                                      <button
                                        type="button"
                                        onClick={() => removeItem(block.id, mt, m.id)}
                                        style={{
                                          background: 'none', border: 'none', cursor: 'pointer',
                                          color: '#9ca3af', fontSize: '0.72rem', padding: '0 0.1rem',
                                          lineHeight: 1, flexShrink: 0,
                                        }}
                                      >✕</button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* メニュー追加ドロップダウン */}
                            {blockCanEdit ? (
                              <select
                                value=""
                                onChange={e => { if (e.target.value) addItem(block.id, mt, Number(e.target.value)) }}
                                style={{
                                  width: '100%', padding: '0.3rem 0.35rem',
                                  fontSize: '0.78rem',
                                  border: `1.5px dashed ${selectedIds.length > 0 ? c.border : '#d1d5db'}`,
                                  borderRadius: 6, outline: 'none',
                                  background: '#fafafa',
                                  color: availableMasters.length > 0 ? '#6b7280' : '#b0b8c4',
                                  cursor: availableMasters.length > 0 ? 'pointer' : 'default',
                                }}
                              >
                                <option value="">＋ {selectedIds.length > 0 ? '追加する...' : 'メニューを選択'}</option>
                                {availableMasters.map(m => (
                                  <option key={m.id} value={m.id}>
                                    {m.name}{m.block_id ? ' ★' : ''}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div style={{
                                fontSize: '0.82rem',
                                color: selectedIds.length > 0 ? c.text : '#9ca3af',
                                fontWeight: selectedIds.length > 0 ? 600 : 400,
                              }}>
                                {selectedIds.length > 0 ? selectedMasters.map(m => m.name).join('・') : '未設定'}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── フッター（保存ボタン） ── */}
        {canEdit && visibleBlocks.length > 0 && (
          <div style={{
            padding: '0.9rem 1.5rem',
            borderTop: '1px solid #e5e7eb',
            background: '#f8fafc',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: '0.82rem' }}>
              {saved && (
                <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ 保存しました</span>
              )}
              {error && (
                <span style={{ color: '#dc2626', fontWeight: 600 }}>⚠ {error}</span>
              )}
              {AI_PUBLIC_ENABLED && aiSuggesting && !error && (
                <span style={{ color: '#0f766e', fontWeight: 600 }}>AIが献立を提案中です... {aiElapsedSec}秒経過</span>
              )}
              {AI_PUBLIC_ENABLED && aiMessage && !error && (
                <span style={{ color: '#0f766e', fontWeight: 600 }}>{aiMessage}</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.65rem' }}>
              {AI_PUBLIC_ENABLED && (
                <button
                  onClick={handleAiSuggest}
                  disabled={aiSuggesting || saving}
                  style={{
                    padding: '0.5rem 1.1rem', fontSize: '0.88rem',
                    background: aiSuggesting ? '#94a3b8' : '#0f766e',
                    color: '#fff',
                    border: 'none', borderRadius: 8,
                    cursor: aiSuggesting || saving ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                  }}
                >
                  {aiSuggesting ? '提案中...' : 'AIで提案'}
                </button>
              )}
              <button
                onClick={onClose}
                style={{
                  padding: '0.5rem 1.1rem', fontSize: '0.88rem',
                  background: '#f3f4f6', color: '#6b7280',
                  border: '1px solid #e5e7eb', borderRadius: 8,
                  cursor: 'pointer', fontWeight: 500,
                }}
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving || saved}
                style={{
                  padding: '0.5rem 1.4rem', fontSize: '0.88rem',
                  background: saved ? '#16a34a' : saving ? '#93c5fd' : '#1a3a5c',
                  color: '#fff',
                  border: 'none', borderRadius: 8,
                  cursor: saving || saved ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  transition: 'background 0.15s',
                  minWidth: 90,
                }}
              >
                {saving ? '保存中...' : saved ? '✓ 保存済' : '保存する'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* アニメーション定義 */}
      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>
    </div>
  )
}

const navBtn: React.CSSProperties = {
  background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8,
  cursor: 'pointer', padding: '0.3rem 0.75rem', fontSize: '1.2rem', color: '#374151', lineHeight: 1,
}
const todayBtn: React.CSSProperties = {
  marginLeft: '0.25rem', padding: '0.35rem 0.9rem', fontSize: '0.8rem',
  background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb',
  borderRadius: 6, cursor: 'pointer', fontWeight: 500,
}
const copyInputStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  padding: '0.42rem 0.5rem',
  fontSize: '0.88rem',
  color: '#334155',
}
const copyCancelBtn: React.CSSProperties = {
  padding: '0.45rem 0.9rem',
  fontSize: '0.84rem',
  background: '#f3f4f6',
  color: '#475569',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  cursor: 'pointer',
}
const copyRunBtn: React.CSSProperties = {
  padding: '0.45rem 0.95rem',
  fontSize: '0.84rem',
  background: '#0b4a6f',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontWeight: 700,
}
