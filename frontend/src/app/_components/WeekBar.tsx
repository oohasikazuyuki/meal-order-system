'use client'

import { getWeekDates, addDays, parseDateStr, formatShort, DOW_MON_FIRST } from '../_lib/date'
import { getHoliday } from '../_lib/holiday'

export type DayState = 'saved' | 'partial' | 'none'

interface Props {
  weekStart: string
  onPrev: () => void
  onNext: () => void
  onThisWeek: () => void
  /** 日を選ばせる画面だけ指定する。省略すると表示のみ。 */
  activeIndex?: number
  onSelectDay?: (index: number, dateStr: string) => void
  /** 各日の状態。ストリップ下段の注記になる。 */
  dayState?: (dateStr: string, index: number) => DayState
  /** 注記の文言を差し替える（発注書のように「保存」以外を示す画面用） */
  dayLabel?: (dateStr: string, index: number) => string
  /** 対象期間の週数。発注書画面は2週間分を扱う。 */
  weeks?: 1 | 2
  /** 右肩に置く操作（保存・出力など） */
  tools?: React.ReactNode
  busy?: boolean
}

const STATE_LABEL: Record<DayState, string> = {
  saved: '保存済',
  partial: '入力中',
  none: '　',
}

/**
 * 週軸の画面で共通して使う背骨。
 * どの画面でも同じ位置・同じ操作で週を移動できるようにする。
 */
export default function WeekBar({
  weekStart,
  onPrev,
  onNext,
  onThisWeek,
  activeIndex,
  onSelectDay,
  dayState,
  dayLabel,
  weeks = 1,
  tools,
  busy,
}: Props) {
  const dates =
    weeks === 2
      ? [...getWeekDates(weekStart), ...getWeekDates(addDays(weekStart, 7))]
      : getWeekDates(weekStart)
  const selectable = typeof activeIndex === 'number' && !!onSelectDay

  return (
    <section className="weekbar" aria-label="週の切り替え">
      <div className="weekbar__head">
        <button type="button" className="btn" onClick={onPrev} disabled={busy}>
          前の週
        </button>
        <span className="weekbar__range num">
          {formatShort(dates[0])} 〜 {formatShort(dates[dates.length - 1])}
        </span>
        <button type="button" className="btn" onClick={onNext} disabled={busy}>
          次の週
        </button>
        <button type="button" className="btn" onClick={onThisWeek} disabled={busy}>
          今週
        </button>
        {tools && <div className="weekbar__tools">{tools}</div>}
      </div>

      <div
        className="weekstrip"
        role={selectable ? 'tablist' : undefined}
        data-weeks={weeks}
      >
        {dates.map((ds, i) => {
          const d = parseDateStr(ds)
          const state = dayState?.(ds, i) ?? 'none'
          const holiday = getHoliday(ds)
          // 祝日は日曜と同じ赤。曜日欄に祝日名を出して、色が見えない人にも伝える
          const isSun = i % 7 === 6 || holiday !== null
          const isSat = i % 7 === 5 && !holiday
          const content = (
            <>
              <span className="weekstrip__dow" title={holiday ?? undefined}>
                {holiday ?? DOW_MON_FIRST[i % 7]}
              </span>
              <span className="weekstrip__num">
                {d.getMonth() + 1}/{d.getDate()}
              </span>
              <span className="weekstrip__state" data-state={state}>
                {dayLabel?.(ds, i) ?? STATE_LABEL[state]}
              </span>
            </>
          )
          const attrs = {
            'data-sat': isSat || undefined,
            'data-sun': isSun || undefined,
            'data-holiday': holiday ? true : undefined,
          }

          return selectable ? (
            <button
              key={ds}
              type="button"
              role="tab"
              className="weekstrip__day"
              aria-selected={i === activeIndex}
              onClick={() => onSelectDay!(i, ds)}
              {...attrs}
            >
              {content}
            </button>
          ) : (
            <div key={ds} className="weekstrip__day" {...attrs}>
              {content}
            </div>
          )
        })}
      </div>
    </section>
  )
}
