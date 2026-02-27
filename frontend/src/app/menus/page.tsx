'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchMenusByMonth, saveMenu, deleteMenu,
  fetchMenuMasters, fetchBlocks,
  MEAL_TYPE_LABELS, type MealType, type MenuItem, type MenuMaster, type Block,
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
  const [loading, setLoading] = useState(false)
  const [modalDate, setModalDate] = useState<string | null>(null)

  const user = getStoredUser()
  const isAdmin = user?.role === 'admin'
  const userBlockId = user?.block_id ?? null

  const load = useCallback(async (y: number, m: number): Promise<MenuItem[]> => {
    setLoading(true)
    try {
      const res = await fetchMenusByMonth(y, m)
      setMenus(res.data.menus)
      return res.data.menus
    } catch {
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(year, month) }, [year, month, load])

  useEffect(() => {
    fetchBlocks().then(r => setBlocks(r.data.blocks)).catch(() => {})
    fetchMenuMasters().then(r => setMasters(r.data.menu_masters)).catch(() => {})
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
        {loading && <span style={{ color: '#9ca3af', fontSize: '0.85rem', marginLeft: 4 }}>読み込み中...</span>}
        <div style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#9ca3af' }}>
          日付をクリックして献立を登録
        </div>
      </div>

      {/* ── カレンダーグリッド ── */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {/* 曜日ヘッダー */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '2px solid #e2e8f0' }}>
          {DOW.map((d, i) => (
            <div key={d} style={{
              padding: '0.65rem 0', textAlign: 'center', fontSize: '0.78rem', fontWeight: 700,
              color: i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : '#6b7280',
              borderRight: i < 6 ? '1px solid #f1f5f9' : undefined,
            }}>
              {d}
            </div>
          ))}
        </div>

        {/* 日付セル */}
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #f1f5f9' }}>
            {week.map((day, di) => {
              const dateStr = day ? toDateStr(year, month, day) : ''
              const badges = day ? mealBadges(dateStr) : []
              const isToday = dateStr === todayStr
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
                    borderRight: di < 6 ? '1px solid #f1f5f9' : undefined,
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
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: isToday ? '#1a3a5c' : 'transparent',
                        color: isToday ? '#fff' : isSun ? '#ef4444' : isSat ? '#3b82f6' : '#374151',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.84rem', fontWeight: isToday ? 700 : 500,
                        marginBottom: '0.3rem',
                      }}>
                        {day}
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

                      {/* 編集ヒント（ホバーで薄く表示） */}
                      <div style={{
                        position: 'absolute', bottom: 4, right: 5,
                        fontSize: '0.6rem', color: '#cbd5e1',
                        fontWeight: 500,
                      }}>
                        ✏
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}
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

interface Selections {
  [blockId: number]: Record<MealType, number | null>
}

function buildSelections(menus: MenuItem[], blocks: Block[], masters: MenuMaster[]): Selections {
  const sel: Selections = {}
  for (const b of blocks) {
    const row = {} as Record<MealType, number | null>
    for (const mt of MEAL_TYPES) {
      const found = menus.find(m => m.meal_type === mt && m.block_id === b.id)
      if (found) {
        const master = masters.find(ma => ma.name === found.name && (ma.block_id === null || ma.block_id === b.id))
        row[mt] = master?.id ?? null
      } else {
        row[mt] = null
      }
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
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const mastersForBlock = (blockId: number) =>
    masters.filter(m => m.block_id === null || m.block_id === blockId)

  const setSelection = (blockId: number, mt: MealType, masterId: number | null) => {
    setSelections(prev => ({
      ...prev,
      [blockId]: { ...prev[blockId], [mt]: masterId },
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
          const masterId = sel[mt] ?? null
          const master = masterId !== null ? masters.find(m => m.id === masterId) : null
          const existing = blockMenus.find(m => m.meal_type === mt)
          if (master) {
            await saveMenu({ name: master.name, menu_date: date, meal_type: mt, block_id: block.id })
          } else if (existing) {
            await deleteMenu(existing.id)
          }
        }
      }
      await onSaved()
      setSaved(true)
      // 1秒後に自動で閉じる
      setTimeout(() => onClose(), 900)
    } catch {
      setError('保存に失敗しました。もう一度お試しください。')
    } finally {
      setSaving(false)
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
                    const currentId = selections[block.id]?.[mt] ?? null
                    const currentMaster = currentId !== null ? masters.find(m => m.id === currentId) : null
                    const isRight = idx % 2 === 1
                    const isBottom = idx >= 2

                    return (
                      <div
                        key={mt}
                        style={{
                          padding: '0.7rem 0.85rem',
                          borderRight: !isRight ? '1px solid #f1f5f9' : undefined,
                          borderBottom: !isBottom ? '1px solid #f1f5f9' : undefined,
                          background: currentMaster ? c.light : '#fff',
                          transition: 'background 0.12s',
                        }}
                      >
                        <div style={{ marginBottom: '0.35rem' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.1rem 0.55rem', borderRadius: 4,
                            background: c.bg, color: '#fff',
                            fontSize: '0.68rem', fontWeight: 700,
                          }}>
                            {MEAL_TYPE_LABELS[mt]}
                          </span>
                        </div>

                        {blockCanEdit ? (
                          <select
                            value={currentId ?? ''}
                            onChange={e => setSelection(block.id, mt, e.target.value ? Number(e.target.value) : null)}
                            style={{
                              width: '100%', padding: '0.38rem 0.4rem',
                              fontSize: '0.82rem',
                              border: `1.5px solid ${currentMaster ? c.border : '#e5e7eb'}`,
                              borderRadius: 6, outline: 'none',
                              background: '#fff', color: '#374151',
                              cursor: 'pointer',
                              appearance: 'auto',
                            }}
                          >
                            <option value="">— 未設定 —</option>
                            {blockMasters.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name}{m.block_id ? ' ★' : ''}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div style={{
                            padding: '0.38rem 0.5rem', fontSize: '0.82rem',
                            border: `1.5px solid ${currentMaster ? c.border : '#e5e7eb'}`,
                            borderRadius: 6,
                            background: currentMaster ? '#fff' : '#f9fafb',
                            color: currentMaster ? c.text : '#9ca3af',
                            fontWeight: currentMaster ? 600 : 400,
                            minHeight: '2rem', display: 'flex', alignItems: 'center',
                          }}>
                            {currentMaster ? currentMaster.name : '未設定'}
                          </div>
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
            </div>
            <div style={{ display: 'flex', gap: '0.65rem' }}>
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
