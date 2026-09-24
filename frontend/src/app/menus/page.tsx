'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchMenusByMonth,
  saveMenu,
  deleteMenu,
  fetchMenuMasters,
  fetchBlocks,
  fetchMenuTablePdf,
  suggestMenuByAi,
  bulkDraftMenuMasterByAi,
  scheduleMenusRoutine,
  fetchBirthdayMenuDates,
  MEAL_TYPE_LABELS,
  type MealType,
  type MenuItem,
  type MenuMaster,
  type Block,
  type AiMenuSuggestResponse,
} from '../_lib/api/client'
import { getStoredUser } from '../_lib/auth'
import { DOW, toDateStr, todayStr, getMondayOf, formatLong } from '../_lib/date'

const MEAL_TYPES: MealType[] = [1, 2, 3, 4]
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

function dayToDateStr(year: number, month: number, day: number): string {
  return toDateStr(new Date(year, month - 1, day))
}

function toMonthStr(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function shiftMonth(base: Date, delta: number): string {
  const d = new Date(base.getFullYear(), base.getMonth(), 1)
  d.setMonth(d.getMonth() + delta)
  return toMonthStr(d.getFullYear(), d.getMonth() + 1)
}

// ============================================================
// 献立カレンダー
// ============================================================
export default function MenusPage() {
  const [today] = useState(() => new Date())
  const [todayIso, setTodayIso] = useState('')

  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [masters, setMasters] = useState<MenuMaster[]>([])
  const [birthdayDates, setBirthdayDates] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [monthAiRunning, setMonthAiRunning] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error' | 'plain'; text: string } | null>(null)
  const [modalDate, setModalDate] = useState<string | null>(null)
  const [copyOpen, setCopyOpen] = useState(false)
  const [copyRunning, setCopyRunning] = useState(false)
  const [copySourceMonth, setCopySourceMonth] = useState(() => shiftMonth(new Date(), 0))
  const [copyTargetMonth, setCopyTargetMonth] = useState(() => shiftMonth(new Date(), 2))
  const [copyTargetEndMonth, setCopyTargetEndMonth] = useState(() => shiftMonth(new Date(), 4))
  const [copyCycleMonths, setCopyCycleMonths] = useState(2)
  const [copyIncludeBirthday, setCopyIncludeBirthday] = useState(true)
  const [copyOverwrite, setCopyOverwrite] = useState(false)
  const [weekDl, setWeekDl] = useState<Record<string, boolean>>({})

  const [user, setUser] = useState(() => getStoredUser())
  useEffect(() => {
    setUser(getStoredUser())
    setTodayIso(todayStr())
  }, [])

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
      setNotice({ tone: 'error', text: '献立を読み込めませんでした。通信を確認して再読み込みしてください。' })
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(year, month)
  }, [year, month, load])

  useEffect(() => {
    // ブロックとメニューは頻繁に変わらないので初回だけ読む
    Promise.all([
      fetchBlocks().then((r) => setBlocks(r.data.blocks)),
      fetchMenuMasters().then((r) => setMasters(r.data.menu_masters)),
    ]).catch(() => {})
  }, [])

  const goPrev = () => {
    if (month === 1) {
      setYear((y) => y - 1)
      setMonth(12)
    } else setMonth((m) => m - 1)
  }
  const goNext = () => {
    if (month === 12) {
      setYear((y) => y + 1)
      setMonth(1)
    } else setMonth((m) => m + 1)
  }
  const goThisMonth = () => {
    setYear(today.getFullYear())
    setMonth(today.getMonth() + 1)
  }

  const menusForDate = (dateStr: string) => menus.filter((m) => m.menu_date === dateStr)
  const weeks = buildCalendar(year, month)
  const daysInMonth = new Date(year, month, 0).getDate()

  const handleWeekPrint = async (weekStart: string, type: 'staff' | 'children') => {
    const key = weekStart + type
    setWeekDl((prev) => ({ ...prev, [key]: true }))
    try {
      const res = await fetchMenuTablePdf(weekStart, type)
      const label = type === 'children' ? '子供用' : '職員用'
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const w = window.open(url, '_blank')
      if (w) {
        w.onload = () => {
          try {
            w.print()
          } catch {
            /* 手動で印刷してもらう */
          }
        }
      } else {
        // ポップアップがブロックされた場合はダウンロードに切り替える
        const a = document.createElement('a')
        a.href = url
        a.download = `献立表_${label}_${weekStart}週.pdf`
        a.click()
      }
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch {
      setNotice({ tone: 'error', text: '献立表を作成できませんでした。もう一度お試しください。' })
    } finally {
      setWeekDl((prev) => ({ ...prev, [key]: false }))
    }
  }

  const handleMonthAiAdd = async () => {
    if (monthAiRunning) return
    if (blocks.length === 0) {
      setNotice({ tone: 'error', text: '先にブロックを登録してください。' })
      return
    }
    if (!confirm(`${year}年${month}月にAIの献立案を足します。すでに献立がある日はそのままです。続けますか？`))
      return

    setMonthAiRunning(true)
    setNotice({ tone: 'plain', text: '準備しています' })
    let addedCount = 0
    let errorCount = 0
    const targetBlocks = isAdmin ? blocks : blocks.filter((b) => b.id === userBlockId)

    const categoryToMealType = (cat: string | null): MealType => {
      if (!cat) return 2
      if (['主食', '主菜', '副菜', '汁物', '丼物'].includes(cat)) return 2
      if (cat === 'デザート' || cat === 'おやつ') return 4
      return 2
    }

    const processDayBlock = async (dateStr: string, block: Block, dayMenus: MenuItem[]): Promise<number> => {
      const lunchExists = dayMenus.some((m) => m.block_id === block.id && m.meal_type === 2)
      if (lunchExists) return 0

      let res
      try {
        res = await bulkDraftMenuMasterByAi({ block_id: block.id, include_ingredients: false })
      } catch {
        errorCount++
        return 0
      }

      const dishes = res.data?.dishes
      if (!dishes?.length) return 0

      const savedKeys = new Set<string>()
      let saved = 0
      for (const dish of dishes) {
        const mt = categoryToMealType(dish.dish_category)
        const category = dish.dish_category ?? ''
        const key = `${dateStr}-${mt}-${block.id}-${category}`
        if (savedKeys.has(key)) continue
        savedKeys.add(key)
        try {
          await saveMenu({
            name: dish.name,
            dish_category: category,
            menu_date: dateStr,
            meal_type: mt,
            block_id: block.id,
          })
          saved++
        } catch {
          // 重複などは飛ばす
        }
      }
      return saved
    }

    try {
      // 1日ずつ順番に処理する（AI側の流量制限を避けるため）
      for (let day = 1; day <= daysInMonth; day++) {
        setNotice({ tone: 'plain', text: `${daysInMonth}日のうち ${day}日目を処理しています` })
        const dateStr = dayToDateStr(year, month, day)
        const dayMenus = menus.filter((m) => m.menu_date === dateStr)
        for (const block of targetBlocks) {
          addedCount += await processDayBlock(dateStr, block, dayMenus)
        }
        if (day < daysInMonth) {
          await new Promise((resolve) => setTimeout(resolve, 3000))
        }
      }

      await load(year, month)
      if (addedCount === 0 && errorCount > 0) {
        setNotice({
          tone: 'error',
          text: `AIを${errorCount}件呼び出せませんでした。しばらく待ってからもう一度お試しください。`,
        })
      } else if (addedCount === 0) {
        setNotice({ tone: 'plain', text: '足す献立はありませんでした。対象の日にはすでに献立があります。' })
      } else {
        setNotice({ tone: 'ok', text: `${addedCount}件の献立を足しました` })
      }
    } catch {
      setNotice({ tone: 'error', text: 'AIの献立追加が途中で止まりました。' })
    } finally {
      setMonthAiRunning(false)
    }
  }

  const handleRoutineCopy = async () => {
    if (copyRunning) return
    if (!canRoutineCopy) {
      setNotice({ tone: 'error', text: '担当ブロックが決まっていないため、周期登録はできません。' })
      return
    }
    if (!copySourceMonth || !copyTargetMonth || !copyTargetEndMonth) {
      setNotice({ tone: 'error', text: 'コピー元とコピー先の月をすべて選んでください。' })
      return
    }
    if (copyTargetMonth > copyTargetEndMonth) {
      setNotice({ tone: 'error', text: 'コピー先の終わりの月は、始まりの月より後にしてください。' })
      return
    }

    const srcStart = new Date(`${copySourceMonth}-01T00:00:00`)
    const srcEnd = new Date(srcStart.getFullYear(), srcStart.getMonth() + copyCycleMonths, 0)
    const srcEndStr = toDateStr(srcEnd)
    const tgtEnd = new Date(
      parseInt(copyTargetEndMonth.split('-')[0]),
      parseInt(copyTargetEndMonth.split('-')[1]),
      0
    )
    const tgtEndStr = toDateStr(tgtEnd)

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
        setNotice({ tone: 'error', text: d.message || '周期登録できませんでした。' })
        return
      }
      await load(year, month)
      setNotice({
        tone: 'ok',
        text: `${d.target_start}〜${d.target_end} に ${d.copied}件をコピーしました（${d.skipped}件は既存のまま、${d.cycles}周期）`,
      })
      setCopyOpen(false)
    } catch (e) {
      setNotice({
        tone: 'error',
        text: `周期登録できませんでした。${e instanceof Error ? e.message : ''}`,
      })
    } finally {
      setCopyRunning(false)
    }
  }

  const totalBlocksForBadge = isAdmin ? blocks.length : userBlockId ? 1 : 0

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
          marginBottom: '0.9rem',
        }}
      >
        <button type="button" className="btn" onClick={goPrev}>
          前の月
        </button>
        <h2 className="num" style={{ fontSize: 'var(--fs-xl)', minWidth: 150, textAlign: 'center' }}>
          {year}年{month}月
        </h2>
        <button type="button" className="btn" onClick={goNext}>
          次の月
        </button>
        <button type="button" className="btn" onClick={goThisMonth}>
          今月
        </button>

        <div className="weekbar__tools">
          <button
            type="button"
            className="btn"
            onClick={() => setCopyOpen(true)}
            disabled={!canRoutineCopy}
          >
            別の月からコピー
          </button>
          {AI_PUBLIC_ENABLED && (
            <button
              type="button"
              className="btn"
              onClick={handleMonthAiAdd}
              disabled={monthAiRunning}
            >
              {monthAiRunning ? 'AIが作成中' : 'AIで今月分を足す'}
            </button>
          )}
        </div>
      </div>

      {notice && (
        <p
          className={
            notice.tone === 'error' ? 'notice notice--error' : notice.tone === 'ok' ? 'notice notice--ok' : 'notice'
          }
          role={notice.tone === 'error' ? 'alert' : undefined}
        >
          {notice.text}
        </p>
      )}
      {loading && <p className="notice">読み込んでいます</p>}

      <div className="sheet" style={{ overflow: 'hidden' }}>
        <div className="calendar__head">
          {DOW.map((d, i) => (
            <div key={d} className="calendar__dow" data-sun={i === 0 || undefined} data-sat={i === 6 || undefined}>
              {d}
            </div>
          ))}
          <div className="calendar__dow">献立表</div>
        </div>

        {weeks.map((week, wi) => {
          const firstDayIdx = week.findIndex((d) => d !== null)
          const weekStart =
            firstDayIdx === -1 ? '' : getMondayOf(dayToDateStr(year, month, week[firstDayIdx]!))

          return (
            <div key={wi} className="calendar__row">
              {week.map((day, di) => {
                const dateStr = day ? dayToDateStr(year, month, day) : ''
                const dayMenus = day ? menusForDate(dateStr) : []
                const badges = MEAL_TYPES.filter((mt) => dayMenus.some((m) => m.meal_type === mt))
                const isToday = dateStr !== '' && dateStr === todayIso
                const isBirthday = day ? birthdayDates.has(dateStr) : false

                if (!day) return <div key={di} className="calendar__cell calendar__cell--empty" />

                return (
                  <button
                    key={di}
                    type="button"
                    className="calendar__cell"
                    onClick={() => setModalDate(dateStr)}
                    aria-label={`${month}月${day}日の献立を編集`}
                  >
                    <span className="calendar__num num" data-today={isToday || undefined} data-sun={di === 0 || undefined} data-sat={di === 6 || undefined}>
                      {day}
                    </span>
                    {isBirthday && (
                      <span className="calendar__birthday" title="誕生日メニュー" aria-label="誕生日メニュー">
                        🎂
                      </span>
                    )}
                    <span className="calendar__badges">
                      {badges.map((mt) => (
                        <span key={mt} className="tag" data-meal={mt}>
                          {MEAL_TYPE_LABELS[mt]}
                          {totalBlocksForBadge > 0 && (
                            <span className="num" style={{ marginLeft: '0.25rem', fontWeight: 400 }}>
                              {dayMenus.filter((m) => m.meal_type === mt).length}/{totalBlocksForBadge}
                            </span>
                          )}
                        </span>
                      ))}
                    </span>
                  </button>
                )
              })}

              <div className="calendar__print">
                {weekStart && (
                  <>
                    <button
                      type="button"
                      className="btn btn--sm"
                      onClick={() => handleWeekPrint(weekStart, 'staff')}
                      disabled={!!weekDl[weekStart + 'staff']}
                    >
                      職員用
                    </button>
                    <button
                      type="button"
                      className="btn btn--sm"
                      onClick={() => handleWeekPrint(weekStart, 'children')}
                      disabled={!!weekDl[weekStart + 'children']}
                    >
                      子供用
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="muted" style={{ fontSize: 'var(--fs-sm)', margin: '0.5rem 0 0' }}>
        日付を押すと献立を編集できます。食札の数字は「献立を入れたブロック数 / 全ブロック数」です。
      </p>

      {modalDate && (
        <MenuModal
          date={modalDate}
          menus={menus.filter((m) => m.menu_date === modalDate)}
          blocks={blocks}
          masters={masters}
          isAdmin={isAdmin}
          userBlockId={userBlockId}
          onSaved={() => load(year, month).then(() => {})}
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

// ============================================================
// 別の月からコピー
// ============================================================
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
    <div className="backdrop" role="dialog" aria-modal="true" aria-label="別の月から献立をコピーする">
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal__head">
          <h2>別の月から献立をコピーする</h2>
        </div>

        <div className="modal__body">
          <label className="field">
            <span>コピー元の始まりの月</span>
            <input
              className="input"
              type="month"
              value={sourceMonth}
              onChange={(e) => onChangeSource(e.target.value)}
            />
          </label>

          <label className="field">
            <span>何ヶ月分を1周期にしますか</span>
            <select
              className="select"
              value={cycleMonths}
              onChange={(e) => onChangeCycleMonths(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 6].map((n) => (
                <option key={n} value={n}>
                  {n}ヶ月
                </option>
              ))}
            </select>
          </label>

          <div className="grid2">
            <label className="field">
              <span>コピー先の始まりの月</span>
              <input
                className="input"
                type="month"
                value={targetMonth}
                onChange={(e) => onChangeTarget(e.target.value)}
              />
            </label>
            <label className="field">
              <span>コピー先の終わりの月</span>
              <input
                className="input"
                type="month"
                value={targetEndMonth}
                onChange={(e) => onChangeTargetEnd(e.target.value)}
              />
            </label>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: 'var(--fs-sm)' }}>
            <input
              type="checkbox"
              checked={includeBirthday}
              onChange={(e) => onChangeIncludeBirthday(e.target.checked)}
            />
            誕生日メニューも一緒にコピーする
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: 'var(--fs-sm)' }}>
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => onChangeOverwrite(e.target.checked)}
            />
            すでに献立がある日も上書きする
          </label>

          <p className="muted" style={{ margin: '0.6rem 0 0', fontSize: 'var(--fs-sm)' }}>
            コピー元の{cycleMonths}ヶ月分を、コピー先の期間に{cycleMonths}ヶ月ごとに繰り返し入れます。
          </p>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn" onClick={onClose} disabled={running}>
            やめる
          </button>
          <button type="button" className="btn btn--primary" onClick={onSubmit} disabled={running}>
            {running ? 'コピーしています' : 'コピーする'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 1日分の献立を編集する
// ============================================================
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

/** 外食メニュー名から場所を取り出す */
function parseEatingOutName(name: string): { isEatingOut: boolean; location: string } {
  if (!name.startsWith('外食')) return { isEatingOut: false, location: '' }
  const m = name.match(/^外食（(.+)）$/)
  return { isEatingOut: true, location: m ? m[1] : '' }
}

function buildEatingOut(menus: MenuItem[], blocks: Block[]): EatingOut {
  const eo: EatingOut = {}
  for (const b of blocks) {
    const row = {} as Record<MealType, EatingOutEntry>
    for (const mt of MEAL_TYPES) {
      const dayMenus = menus.filter((m) => m.meal_type === mt && m.block_id === b.id)
      const eoMenu = dayMenus.find((m) => m.name.startsWith('外食'))
      row[mt] = eoMenu
        ? { enabled: true, location: parseEatingOutName(eoMenu.name).location }
        : { enabled: false, location: '' }
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
      const dayMenus = menus.filter((m) => m.meal_type === mt && m.block_id === b.id)
      row[mt] = [
        ...new Set(
          dayMenus
            .filter((m) => !m.name.startsWith('外食'))
            .map(
              (m) =>
                masters.find((ma) => ma.name === m.name && (ma.block_id === null || ma.block_id === b.id))?.id
            )
            .filter((id): id is number => id !== undefined)
        ),
      ]
    }
    sel[b.id] = row
  }
  return sel
}

function MenuModal({ date, menus, blocks, masters, isAdmin, userBlockId, onSaved, onClose }: MenuModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const visibleBlocks = isAdmin ? blocks : blocks.filter((b) => b.id === userBlockId)

  const [selections, setSelections] = useState<Selections>(() => buildSelections(menus, blocks, masters))
  const [eatingOut, setEatingOut] = useState<EatingOut>(() => buildEatingOut(menus, blocks))
  const [saving, setSaving] = useState(false)
  const [aiSuggesting, setAiSuggesting] = useState(false)
  const [aiElapsedSec, setAiElapsedSec] = useState(0)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiMessage, setAiMessage] = useState<string | null>(null)
  const [aiCustomNames, setAiCustomNames] = useState<Record<number, Partial<Record<MealType, string[]>>>>({})

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    if (!aiSuggesting) return
    setAiElapsedSec(0)
    const started = Date.now()
    const timer = setInterval(() => setAiElapsedSec(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [aiSuggesting])

  const mastersForBlock = (blockId: number) =>
    masters.filter((m) => m.block_id === null || m.block_id === blockId)

  const addItem = (blockId: number, mt: MealType, masterId: number) => {
    setSelections((prev) => {
      const cur = prev[blockId]?.[mt] ?? []
      if (cur.includes(masterId)) return prev
      return { ...prev, [blockId]: { ...prev[blockId], [mt]: [...cur, masterId] } }
    })
    setSaved(false)
    setError(null)
  }

  const removeItem = (blockId: number, mt: MealType, masterId: number) => {
    setSelections((prev) => ({
      ...prev,
      [blockId]: {
        ...prev[blockId],
        [mt]: (prev[blockId]?.[mt] ?? []).filter((id) => id !== masterId),
      },
    }))
    setSaved(false)
    setError(null)
  }

  const toggleEatingOut = (blockId: number, mt: MealType) => {
    setEatingOut((prev) => {
      const cur = prev[blockId]?.[mt] ?? { enabled: false, location: '' }
      return { ...prev, [blockId]: { ...prev[blockId], [mt]: { ...cur, enabled: !cur.enabled } } }
    })
    setSaved(false)
    setError(null)
  }

  const setEatingOutLocation = (blockId: number, mt: MealType, location: string) => {
    setEatingOut((prev) => ({
      ...prev,
      [blockId]: {
        ...prev[blockId],
        [mt]: { ...(prev[blockId]?.[mt] ?? { enabled: true, location: '' }), location },
      },
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
        const blockMenus = menus.filter((m) => m.block_id === block.id)
        for (const mt of MEAL_TYPES) {
          const eo = eatingOut[block.id]?.[mt]
          const existingForMt = blockMenus.filter((m) => m.meal_type === mt)

          if (eo?.enabled) {
            // 外食にした場合は、その食事の通常メニューを消す
            for (const existing of existingForMt) {
              if (!existing.name.startsWith('外食')) {
                await deleteMenu(existing.id)
              }
            }
            const eoName = eo.location.trim() ? `外食（${eo.location.trim()}）` : '外食'
            const existingEo = existingForMt.find((m) => m.name.startsWith('外食'))
            if (existingEo) {
              if (existingEo.name !== eoName) {
                await deleteMenu(existingEo.id)
                await saveMenu({ name: eoName, menu_date: date, meal_type: mt, block_id: block.id })
              }
            } else {
              await saveMenu({ name: eoName, menu_date: date, meal_type: mt, block_id: block.id })
            }
          } else {
            const newMasterIds = sel[mt] ?? []
            const newCustomNames = aiCustomNames[block.id]?.[mt] ?? []
            // 選択から外したメニューを消す（外食も含む）
            for (const existing of existingForMt) {
              if (existing.name.startsWith('外食')) {
                await deleteMenu(existing.id)
                continue
              }
              const master = masters.find(
                (ma) => ma.name === existing.name && (ma.block_id === null || ma.block_id === block.id)
              )
              const keptByMaster = master ? newMasterIds.includes(master.id) : false
              const keptByCustom = newCustomNames.includes(existing.name)
              if (!keptByMaster && !keptByCustom) {
                await deleteMenu(existing.id)
              }
            }
            for (const masterId of newMasterIds) {
              const master = masters.find((m) => m.id === masterId)
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
            for (const customName of newCustomNames) {
              await saveMenu({ name: customName, menu_date: date, meal_type: mt, block_id: block.id })
            }
          }
        }
      }
      await onSaved()
      setSaved(true)
      setTimeout(() => onClose(), 900)
    } catch {
      setError('保存できませんでした。もう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  const getSelectedNames = (blockId: number, mt: MealType): string[] => {
    const ids = selections[blockId]?.[mt] ?? []
    const blockMasters = mastersForBlock(blockId)
    const masterNames = ids
      .map((id) => blockMasters.find((m) => m.id === id)?.name)
      .filter((v): v is string => !!v)
    return [...masterNames, ...(aiCustomNames[blockId]?.[mt] ?? [])]
  }

  const removeCustomName = (blockId: number, mt: MealType, name: string) => {
    setAiCustomNames((prev) => ({
      ...prev,
      [blockId]: {
        ...(prev[blockId] ?? {}),
        [mt]: (prev[blockId]?.[mt] ?? []).filter((n) => n !== name),
      },
    }))
    setSaved(false)
    setError(null)
  }

  const mergeAiSuggestion = (blockId: number, suggestions: Record<string, Record<string, string>>) => {
    const blockMasters = mastersForBlock(blockId)
    setSelections((prev) => {
      const next = { ...prev, [blockId]: { ...(prev[blockId] ?? {}) } } as Selections
      for (const mt of MEAL_TYPES) {
        const current = new Set<number>(next[blockId]?.[mt] ?? [])
        const byCategory = suggestions[String(mt)] ?? {}
        for (const name of Object.values(byCategory)) {
          if (!name) continue
          const m = blockMasters.find((mm) => mm.name === name)
          if (m) current.add(m.id)
        }
        next[blockId][mt] = Array.from(current)
      }
      return next
    })
    setAiCustomNames((prev) => {
      const next = { ...prev, [blockId]: { ...(prev[blockId] ?? {}) } }
      for (const mt of MEAL_TYPES) {
        const names = Object.values(suggestions[String(mt)] ?? {}).filter(Boolean)
        const custom = names.filter((name) => !blockMasters.some((m) => m.name === name))
        if (custom.length > 0) next[blockId][mt] = custom
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
        const res = await suggestMenuByAi({ date, block_id: block.id, existing_by_meal: existingByMeal })
        const body: AiMenuSuggestResponse = res.data
        if (!body.ok) continue
        mergeAiSuggestion(block.id, body.suggestions ?? {})
        applied++
      }
      if (applied > 0) {
        setAiMessage(`${applied}ブロックにAIの案を入れました。確認して保存してください。`)
        setSaved(false)
      } else {
        setError('AIの案を入れられませんでした。')
      }
    } catch {
      setError('AIの案を取得できませんでした。AIの接続設定を確認してください。')
    } finally {
      setAiSuggesting(false)
    }
  }

  const canEdit = isAdmin || userBlockId !== null

  return (
    <div
      ref={overlayRef}
      className="backdrop"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`${formatLong(date)}の献立`}
    >
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="modal__head">
          <h2>{formatLong(date)}</h2>
          <button type="button" className="btn btn--sm" onClick={onClose} style={{ marginLeft: 'auto' }}>
            閉じる
          </button>
        </div>

        <div className="modal__body">
          {blocks.length === 0 && <p className="empty">ブロックが登録されていません。</p>}

          {!isAdmin && blocks.length > 0 && userBlockId === null && (
            <p className="empty">担当ブロックが決まっていないため、献立を編集できません。</p>
          )}

          {visibleBlocks.map((block) => {
            const blockMasters = mastersForBlock(block.id)
            const blockCanEdit = isAdmin || block.id === userBlockId

            return (
              <section
                key={block.id}
                style={{
                  border: '1px solid var(--rule)',
                  borderRadius: 'var(--r)',
                  marginBottom: '0.7rem',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    padding: '0.3rem 0.6rem',
                    background: 'var(--paper-alt)',
                    borderBottom: '1px solid var(--rule)',
                    fontWeight: 700,
                    fontSize: 'var(--fs-sm)',
                  }}
                >
                  {block.name}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
                  {MEAL_TYPES.map((mt) => {
                    const eo = eatingOut[block.id]?.[mt] ?? { enabled: false, location: '' }
                    const selectedIds = selections[block.id]?.[mt] ?? []
                    const selectedMasters = selectedIds
                      .map((id) => blockMasters.find((m) => m.id === id))
                      .filter((m): m is MenuMaster => m !== undefined)
                    const customNames = aiCustomNames[block.id]?.[mt] ?? []
                    const availableMasters = blockMasters.filter((m) => !selectedIds.includes(m.id))

                    return (
                      <div
                        key={mt}
                        className="mealband"
                        data-meal={mt}
                        style={{
                          padding: '0.45rem 0.55rem',
                          borderTop: '1px solid var(--rule-soft)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            marginBottom: '0.3rem',
                          }}
                        >
                          <span className="tag" data-meal={mt}>
                            {MEAL_TYPE_LABELS[mt]}
                          </span>
                          {!eo.enabled && selectedIds.length + customNames.length > 0 && (
                            <span className="muted num" style={{ fontSize: 'var(--fs-xs)' }}>
                              {selectedIds.length + customNames.length}品
                            </span>
                          )}
                          {blockCanEdit && (
                            <button
                              type="button"
                              className={eo.enabled ? 'btn btn--sm btn--primary' : 'btn btn--sm'}
                              aria-pressed={eo.enabled}
                              onClick={() => toggleEatingOut(block.id, mt)}
                              style={{ marginLeft: 'auto' }}
                            >
                              外食
                            </button>
                          )}
                        </div>

                        {eo.enabled ? (
                          blockCanEdit ? (
                            <input
                              className="input"
                              type="text"
                              placeholder="どこへ行くか（任意）"
                              value={eo.location}
                              onChange={(e) => setEatingOutLocation(block.id, mt, e.target.value)}
                              aria-label={`${MEAL_TYPE_LABELS[mt]}の外食先`}
                            />
                          ) : (
                            <p style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>
                              外食{eo.location ? `（${eo.location}）` : ''}
                            </p>
                          )
                        ) : (
                          <>
                            {selectedMasters.map((m) => (
                              <div
                                key={m.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  padding: '0.1rem 0',
                                  fontSize: 'var(--fs-sm)',
                                }}
                              >
                                <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
                                  {m.name}
                                  {m.block_id && <span className="muted">（専用）</span>}
                                </span>
                                {blockCanEdit && (
                                  <button
                                    type="button"
                                    className="btn btn--sm"
                                    onClick={() => removeItem(block.id, mt, m.id)}
                                    aria-label={`${m.name}を消す`}
                                  >
                                    消す
                                  </button>
                                )}
                              </div>
                            ))}

                            {customNames.map((name) => (
                              <div
                                key={`ai-${name}`}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  padding: '0.1rem 0',
                                  fontSize: 'var(--fs-sm)',
                                }}
                              >
                                <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
                                  {name}
                                  <span className="muted">（AIの案）</span>
                                </span>
                                {blockCanEdit && (
                                  <button
                                    type="button"
                                    className="btn btn--sm"
                                    onClick={() => removeCustomName(block.id, mt, name)}
                                    aria-label={`${name}を消す`}
                                  >
                                    消す
                                  </button>
                                )}
                              </div>
                            ))}

                            {blockCanEdit ? (
                              <select
                                className="select"
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) addItem(block.id, mt, Number(e.target.value))
                                }}
                                aria-label={`${block.name}の${MEAL_TYPE_LABELS[mt]}にメニューを足す`}
                                style={{ marginTop: '0.25rem' }}
                              >
                                <option value="">
                                  {selectedIds.length > 0 ? 'さらに足す' : 'メニューを選ぶ'}
                                </option>
                                {availableMasters.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name}
                                    {m.block_id ? '（専用）' : ''}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              selectedMasters.length === 0 && (
                                <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>
                                  未設定
                                </p>
                              )
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>

        {canEdit && visibleBlocks.length > 0 && (
          <div className="modal__foot">
            <span style={{ marginRight: 'auto', fontSize: 'var(--fs-sm)' }}>
              {error ? (
                <span style={{ color: 'var(--warn)', fontWeight: 700 }}>{error}</span>
              ) : saved ? (
                <span style={{ color: 'var(--ok)', fontWeight: 700 }}>保存しました</span>
              ) : AI_PUBLIC_ENABLED && aiSuggesting ? (
                <span className="muted">AIが考えています（{aiElapsedSec}秒）</span>
              ) : AI_PUBLIC_ENABLED && aiMessage ? (
                <span className="muted">{aiMessage}</span>
              ) : null}
            </span>

            {AI_PUBLIC_ENABLED && (
              <button
                type="button"
                className="btn"
                onClick={handleAiSuggest}
                disabled={aiSuggesting || saving}
              >
                {aiSuggesting ? '考えています' : 'AIに提案してもらう'}
              </button>
            )}
            <button type="button" className="btn" onClick={onClose}>
              やめる
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleSave}
              disabled={saving || saved}
            >
              {saving ? '保存しています' : saved ? '保存しました' : '保存する'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
