'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  fetchRooms,
  createRoom,
  deleteRoom,
  syncKamahoRooms,
  fetchBlocks,
  createBlock,
  deleteBlock,
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  uploadSupplierTemplate,
  deleteSupplierTemplate,
  downloadSupplierTemplate,
  fetchKamahoMealCounts,
  loginKamahoIntegration,
  getKamahoLink,
  updateKamahoLink,
  type Room,
  type Block,
  type Supplier,
  type SupplierInput,
} from '../_lib/api/client'
import { todayStr, DOW_MON_FIRST } from '../_lib/date'
import { useStringParam } from '../_lib/useUrlState'
import ConfirmDialog from '../_components/ConfirmDialog'

const getApiErrorMessage = (err: unknown, fallback: string): string => {
  const maybe = err as { response?: { data?: { message?: string } } }
  return maybe?.response?.data?.message || fallback
}

type Tab = 'rooms' | 'blocks' | 'suppliers'

const TAB_LABELS: Record<Tab, string> = {
  rooms: '部屋',
  blocks: 'ブロック',
  suppliers: '仕入先',
}

export default function MasterPage() {
  const [tabParam, setTabParam] = useStringParam('tab', 'rooms')
  const tab: Tab = (['rooms', 'blocks', 'suppliers'] as string[]).includes(tabParam)
    ? (tabParam as Tab)
    : 'rooms'
  const setTab = (next: Tab) => setTabParam(next)

  return (
    <div>
      <div className="btnrow" role="group" aria-label="管理する対象" style={{ marginBottom: '1rem' }}>
        {(['rooms', 'blocks', 'suppliers'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? 'btn btn--primary' : 'btn'}
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'rooms' && <RoomsTab />}
      {tab === 'blocks' && <BlocksTab />}
      {tab === 'suppliers' && <SuppliersTab />}
    </div>
  )
}

// ============================================================
// 部屋
// ============================================================
function RoomsTab() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [kamahoRooms, setKamahoRooms] = useState<string[]>([])
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [mealCounts, setMealCounts] = useState<Record<string, number>>({})
  const [loadingMealCounts, setLoadingMealCounts] = useState(false)
  const [kamahoAccount, setKamahoAccount] = useState('')
  const [kamahoPassword, setKamahoPassword] = useState('')
  const [kamahoLoggingIn, setKamahoLoggingIn] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null)

  const loadRooms = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchRooms()
      setRooms(res.data.rooms)
    } catch {
      setError('部屋を読み込めませんでした。通信を確認して再読み込みしてください。')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMealCounts = useCallback(async () => {
    setLoadingMealCounts(true)
    try {
      const res = await fetchKamahoMealCounts(todayStr())
      setMealCounts(res.data.counts)
    } catch {
      // 食数が取れなくても部屋の管理は続けられる
    } finally {
      setLoadingMealCounts(false)
    }
  }, [])

  useEffect(() => {
    loadRooms()
  }, [loadRooms])

  useEffect(() => {
    loadMealCounts()
  }, [loadMealCounts])

  useEffect(() => {
    getKamahoLink()
      .then((res) => setKamahoAccount(res.data.kamaho_login_id ?? ''))
      .catch(() => {})
  }, [])

  const handleKamahoLogin = async () => {
    const account = kamahoAccount.trim()
    if (!account || !kamahoPassword) {
      setError('連携ログインIDとパスワードの両方を入力してください。')
      return
    }
    setKamahoLoggingIn(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const res = await loginKamahoIntegration(account, kamahoPassword)
      setSuccessMsg(`${res.data.message}（部屋 ${res.data.room_count} 件）`)
      loadMealCounts()
    } catch (e) {
      setError(getApiErrorMessage(e, '食数管理システムにログインできませんでした。IDとパスワードを確認してください。'))
    } finally {
      setKamahoLoggingIn(false)
    }
  }

  const handleKamahoCredentialClear = () => {
    updateKamahoLink({ kamaho_login_id: '' }).catch(() => {})
    setKamahoAccount('')
    setKamahoPassword('')
    setSuccessMsg('連携ログイン情報を消しました')
  }

  const handleSync = async () => {
    setSyncing(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const res = await syncKamahoRooms()
      setRooms(res.data.rooms)
      setKamahoRooms(res.data.kamaho_rooms)
      const added = res.data.added
      setSuccessMsg(
        added.length > 0
          ? `${added.length}件の部屋を追加しました：${added.join('、')}`
          : '追加する部屋はありませんでした。すべて登録済みです。'
      )
      loadMealCounts()
    } catch (e) {
      setError(getApiErrorMessage(e, '食数管理システムと同期できませんでした。連携ログインを確認してください。'))
    } finally {
      setSyncing(false)
    }
  }

  const handleAdd = async () => {
    if (!newName.trim()) return
    setAdding(true)
    setError(null)
    setSuccessMsg(null)
    try {
      await createRoom({ name: newName.trim() })
      setSuccessMsg(`「${newName.trim()}」を追加しました`)
      setNewName('')
      loadRooms()
    } catch {
      setError('部屋を追加できませんでした。もう一度お試しください。')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (room: Room) => {
    setDeleteTarget(null)
    const prevRooms = rooms
    setRooms((prev) => prev.filter((r) => r.id !== room.id))
    try {
      await deleteRoom(room.id)
      setSuccessMsg(`「${room.name}」を削除しました`)
    } catch {
      setRooms(prevRooms)
      setError('削除できませんでした。この部屋はブロックで使用中の可能性があります。')
    }
  }

  return (
    <>
      {deleteTarget && (
        <ConfirmDialog
          title="部屋を削除します"
          message={`「${deleteTarget.name}」を削除します。ブロックで使用中の部屋は削除できません。その場合は先にブロックの割り当てを外してください。`}
          confirmLabel="削除する"
          destructive
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <section className="sheet">
        <div className="sheet__head sheet__head--quiet">
          <h2>食数管理システムとつなぐ</h2>
          <div className="sheet__meta">
            <button type="button" className="btn" onClick={handleSync} disabled={syncing}>
              {syncing ? '同期しています' : '部屋を取り込む'}
            </button>
          </div>
        </div>
        <div className="sheet__body">
          <div className="grid2">
            <label className="field">
              <span>連携ログインID</span>
              <input
                className="input"
                type="text"
                value={kamahoAccount}
                onChange={(e) => setKamahoAccount(e.target.value)}
                autoComplete="username"
              />
            </label>
            <label className="field">
              <span>連携パスワード</span>
              <input
                className="input"
                type="password"
                value={kamahoPassword}
                onChange={(e) => setKamahoPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
          </div>
          <div className="btnrow">
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleKamahoLogin}
              disabled={kamahoLoggingIn}
            >
              {kamahoLoggingIn ? 'つないでいます' : '連携ログイン'}
            </button>
            <button type="button" className="btn" onClick={handleKamahoCredentialClear}>
              連携情報を消す
            </button>
            <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
              ログインすると、向こうに登録されている部屋名を取り込めます。
            </span>
          </div>
          {kamahoRooms.length > 0 && (
            <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: 'var(--fs-sm)' }}>
              取り込んだ部屋：{kamahoRooms.join('、')}
            </p>
          )}
        </div>
      </section>

      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      {successMsg && <p className="notice notice--ok">{successMsg}</p>}

      <section className="sheet">
        <div className="sheet__head">
          <h2>部屋</h2>
          <div className="sheet__meta">
            <span>
              <span className="num">{rooms.length}</span> 室
            </span>
          </div>
        </div>

        <div className="sheet__body" style={{ borderBottom: '1px solid var(--rule-soft)' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label className="field" style={{ marginBottom: 0, flex: 1, minWidth: 220, maxWidth: 340 }}>
              <span>部屋名を手で追加する</span>
              <input
                className="input"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="あじさい"
              />
            </label>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleAdd}
              disabled={!newName.trim() || adding}
            >
              {adding ? '追加しています' : '追加する'}
            </button>
          </div>
        </div>

        {loading ? (
          <p className="empty" role="status">読み込んでいます</p>
        ) : rooms.length === 0 ? (
          <div className="empty">
            <p>部屋がまだ登録されていません。</p>
            <button type="button" className="btn" onClick={handleSync} disabled={syncing}>
              食数管理システムから取り込む
            </button>
          </div>
        ) : (
          <div className="sheet__scroll">
            <table className="data" aria-label="部屋の一覧">
              <thead>
                <tr>
                  <th>部屋名</th>
                  <th className="num">本日の食数</th>
                  <th style={{ textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => {
                  const mealCount = mealCounts[room.name]
                  return (
                    <tr key={room.id}>
                      <td className="lead">{room.name}</td>
                      <td className="num">
                        {loadingMealCounts ? (
                          <span className="muted">…</span>
                        ) : mealCount !== undefined ? (
                          <span className="strong">{mealCount}</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <div className="actions">
                          <button
                            type="button"
                            className="btn btn--sm btn--danger"
                            onClick={() => setDeleteTarget(room)}
                            aria-label={`${room.name} を削除`}
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

// ============================================================
// ブロック
// ============================================================
function BlocksTab() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [newName, setNewName] = useState('')
  const [room1Id, setRoom1Id] = useState<number>(0)
  const [room2Id, setRoom2Id] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Block | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [roomsRes, blocksRes] = await Promise.all([fetchRooms(), fetchBlocks()])
      setRooms(roomsRes.data.rooms)
      setBlocks(blocksRes.data.blocks)
    } catch {
      setError('ブロックを読み込めませんでした。通信を確認して再読み込みしてください。')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleAdd = async () => {
    if (!newName.trim() || !room1Id || !room2Id) {
      setError('ブロック名と2つの部屋をすべて選んでください。')
      return
    }
    if (room1Id === room2Id) {
      setError('部屋1と部屋2には違う部屋を選んでください。')
      return
    }
    try {
      setError(null)
      await createBlock({ name: newName.trim(), room1_id: room1Id, room2_id: room2Id })
      setSuccessMsg(`「${newName.trim()}」を追加しました`)
      setNewName('')
      setRoom1Id(0)
      setRoom2Id(0)
      load()
    } catch (e) {
      setError(getApiErrorMessage(e, 'ブロックを追加できませんでした。'))
    }
  }

  const handleDelete = async (block: Block) => {
    setDeleteTarget(null)
    const prevBlocks = blocks
    setBlocks((prev) => prev.filter((b) => b.id !== block.id))
    try {
      await deleteBlock(block.id)
      setSuccessMsg(`「${block.name}」を削除しました`)
    } catch (e) {
      setBlocks(prevBlocks)
      setError(getApiErrorMessage(e, '削除できませんでした。'))
    }
  }

  const roomName = (id: number) => rooms.find((r) => r.id === id)?.name ?? `（ID:${id}）`

  return (
    <>
      {deleteTarget && (
        <ConfirmDialog
          title="ブロックを削除します"
          message={`「${deleteTarget.name}」を削除します。このブロックで入力した食数や献立の紐付けが参照できなくなります。`}
          confirmLabel="削除する"
          destructive
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      {successMsg && <p className="notice notice--ok">{successMsg}</p>}

      <section className="sheet">
        <div className="sheet__head">
          <h2>ブロック</h2>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'rgba(242,245,243,0.7)' }}>
            2部屋をひとつのまとまりにして食数を入力します
          </span>
          <div className="sheet__meta">
            <span>
              <span className="num">{blocks.length}</span> 件
            </span>
          </div>
        </div>

        <div className="sheet__body" style={{ borderBottom: '1px solid var(--rule-soft)' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label className="field" style={{ marginBottom: 0, minWidth: 180 }}>
              <span>ブロック名</span>
              <input
                className="input"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Aブロック"
              />
            </label>
            <label className="field" style={{ marginBottom: 0, minWidth: 150 }}>
              <span>部屋1</span>
              <select
                className="select"
                value={room1Id}
                onChange={(e) => setRoom1Id(Number(e.target.value))}
              >
                <option value={0}>選んでください</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" style={{ marginBottom: 0, minWidth: 150 }}>
              <span>部屋2</span>
              <select
                className="select"
                value={room2Id}
                onChange={(e) => setRoom2Id(Number(e.target.value))}
              >
                <option value={0}>選んでください</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleAdd}
              disabled={!newName.trim() || !room1Id || !room2Id}
            >
              追加する
            </button>
          </div>

          {rooms.length === 0 && !loading && (
            <p className="notice notice--error" style={{ marginTop: '0.7rem', marginBottom: 0 }}>
              先に「部屋」で部屋を登録してください。
            </p>
          )}
        </div>

        {loading ? (
          <p className="empty" role="status">読み込んでいます</p>
        ) : blocks.length === 0 ? (
          <p className="empty">ブロックがまだありません。上のフォームから追加してください。</p>
        ) : (
          <div className="sheet__scroll">
            <table className="data" aria-label="ブロックの一覧">
              <thead>
                <tr>
                  <th>ブロック名</th>
                  <th>部屋1</th>
                  <th>部屋2</th>
                  <th style={{ textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((block) => (
                  <tr key={block.id}>
                    <td className="lead">{block.name}</td>
                    <td>{roomName(block.room1_id)}</td>
                    <td>{roomName(block.room2_id)}</td>
                    <td>
                      <div className="actions">
                        <button
                          type="button"
                          className="btn btn--sm btn--danger"
                          onClick={() => setDeleteTarget(block)}
                          aria-label={`${block.name} を削除`}
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

// ============================================================
// 仕入先
// ============================================================
const WEEK_LABELS: Record<number, string> = { 0: '毎週', 1: '第1', 2: '第2', 3: '第3', 4: '第4', 5: '第5' }

/** "D" または "N:D" のまとまりを読める文言にする */
function formatDaysPart(part: string): string {
  if (!part.trim()) return ''
  const dayWeeks: Record<number, number[]> = {}
  for (const entry of part.split(',')) {
    const t = entry.trim()
    if (!t) continue
    let week = 0
    let day: number
    if (t.includes(':')) {
      const [w, d] = t.split(':')
      week = parseInt(w)
      day = parseInt(d)
    } else {
      day = parseInt(t)
    }
    if (day >= 0 && day <= 6) {
      if (!dayWeeks[day]) dayWeeks[day] = []
      dayWeeks[day].push(week)
    }
  }
  return Object.entries(dayWeeks)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([dayStr, weeks]) => {
      const label = DOW_MON_FIRST[Number(dayStr)] ?? dayStr
      if (weeks.includes(0)) return label
      return weeks
        .sort((a, b) => a - b)
        .map((w) => `${WEEK_LABELS[w] ?? w}${label}`)
        .join('・')
    })
    .join('・')
}

function formatDeliveryDays(days: string): string {
  if (!days.trim()) return ''
  if (days.includes('|')) {
    const [thisStr, nextStr] = days.split('|', 2)
    const thisPart = formatDaysPart(thisStr)
    const nextPart = formatDaysPart(nextStr)
    const parts: string[] = []
    if (thisPart) parts.push(`今週 ${thisPart}`)
    if (nextPart) parts.push(`翌週 ${nextPart}`)
    return parts.join(' / ')
  }
  return formatDaysPart(days)
}

interface DaySpec {
  enabled: boolean
  weeks: number[]
}

function parseDeliverySpec(str: string): DaySpec[] {
  const spec: DaySpec[] = Array.from({ length: 7 }, () => ({ enabled: false, weeks: [] }))
  for (const entry of str.split(',')) {
    const t = entry.trim()
    if (!t) continue
    let week = 0
    let day: number
    if (t.includes(':')) {
      const [w, d] = t.split(':')
      week = parseInt(w)
      day = parseInt(d)
    } else {
      day = parseInt(t)
    }
    if (day >= 0 && day <= 6 && !isNaN(day)) {
      spec[day].enabled = true
      if (!spec[day].weeks.includes(week)) spec[day].weeks.push(week)
    }
  }
  return spec
}

function formatDeliverySpec(spec: DaySpec[]): string {
  const entries: string[] = []
  for (let day = 0; day <= 6; day++) {
    const { enabled, weeks } = spec[day]
    if (!enabled) continue
    const ws = weeks.length > 0 ? weeks : [0]
    for (const w of ws.sort((a, b) => a - b)) {
      entries.push(w === 0 ? String(day) : `${w}:${day}`)
    }
  }
  return entries.join(',')
}

function parseSimpleWeek(str: string): boolean[] {
  const result = Array(7).fill(false) as boolean[]
  for (const t of str.split(',')) {
    const n = parseInt(t.trim())
    if (!isNaN(n) && n >= 0 && n <= 6) result[n] = true
  }
  return result
}

function formatSimpleWeek(bools: boolean[]): string {
  return bools
    .map((v, i) => (v ? String(i) : null))
    .filter(Boolean)
    .join(',')
}

function DeliveryDaysPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const hasPipe = value.includes('|')
  const [thisSpec, setThisSpec] = useState<DaySpec[]>(() =>
    parseDeliverySpec(hasPipe ? value.split('|')[0] : value)
  )
  const [nextDays, setNextDays] = useState<boolean[]>(() =>
    hasPipe ? parseSimpleWeek(value.split('|')[1]) : Array(7).fill(false)
  )
  const [splitMode, setSplitMode] = useState(hasPipe)

  // 編集対象が切り替わったら外部の値で作り直す
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    const hp = value.includes('|')
    setThisSpec(parseDeliverySpec(hp ? value.split('|')[0] : value))
    setNextDays(hp ? parseSimpleWeek(value.split('|')[1]) : Array(7).fill(false))
    setSplitMode(hp)
  }

  const emit = (ts: DaySpec[], nd: boolean[], sm: boolean) => {
    onChange(sm ? `${formatDeliverySpec(ts)}|${formatSimpleWeek(nd)}` : formatDeliverySpec(ts))
  }

  const toggleMode = () => {
    const newMode = !splitMode
    setSplitMode(newMode)
    if (!newMode) setNextDays(Array(7).fill(false))
    emit(thisSpec, newMode ? nextDays : Array(7).fill(false), newMode)
  }

  const updateThis = (newSpec: DaySpec[]) => {
    setThisSpec(newSpec)
    emit(newSpec, nextDays, splitMode)
  }

  const toggleDay = (day: number) => {
    updateThis(
      thisSpec.map((d, i) => (i === day ? { enabled: !d.enabled, weeks: d.enabled ? [] : [0] } : d))
    )
  }

  const toggleWeek = (day: number, week: number) => {
    const daySpec = { ...thisSpec[day], weeks: [...thisSpec[day].weeks] }
    if (week === 0) {
      daySpec.weeks = daySpec.weeks.includes(0) ? [] : [0]
    } else {
      daySpec.weeks = daySpec.weeks.includes(week)
        ? daySpec.weeks.filter((w) => w !== week)
        : [...daySpec.weeks.filter((w) => w !== 0), week]
    }
    updateThis(thisSpec.map((d, i) => (i === day ? daySpec : d)))
  }

  const toggleNextDay = (day: number) => {
    const nd = nextDays.map((v, i) => (i === day ? !v : v))
    setNextDays(nd)
    emit(thisSpec, nd, splitMode)
  }

  return (
    <div>
      <button
        type="button"
        className={splitMode ? 'btn btn--sm btn--primary' : 'btn btn--sm'}
        aria-pressed={splitMode}
        onClick={toggleMode}
        style={{ marginBottom: '0.4rem' }}
      >
        今週と翌週で曜日を分ける
      </button>

      {splitMode && (
        <p style={{ margin: '0.3rem 0 0.2rem', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>
          今週の納品曜日
        </p>
      )}

      <div>
        {DOW_MON_FIRST.map((label, day) => (
          <div
            key={day}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minHeight: 26 }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                minWidth: 52,
                fontSize: 'var(--fs-sm)',
                fontWeight: thisSpec[day].enabled ? 700 : 400,
                color: thisSpec[day].enabled ? 'var(--ink)' : 'var(--ink-4)',
              }}
            >
              <input
                type="checkbox"
                checked={thisSpec[day].enabled}
                onChange={() => toggleDay(day)}
              />
              {label}曜
            </label>
            {thisSpec[day].enabled && !splitMode && (
              <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
                {[0, 1, 2, 3, 4, 5].map((week) => {
                  const sel = thisSpec[day].weeks.includes(week)
                  return (
                    <button
                      key={week}
                      type="button"
                      className={sel ? 'btn btn--sm btn--primary' : 'btn btn--sm'}
                      aria-pressed={sel}
                      onClick={() => toggleWeek(day, week)}
                    >
                      {WEEK_LABELS[week]}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {splitMode && (
        <>
          <p style={{ margin: '0.5rem 0 0.2rem', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>
            翌週の納品曜日
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {DOW_MON_FIRST.map((label, day) => (
              <label
                key={day}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: nextDays[day] ? 700 : 400,
                  color: nextDays[day] ? 'var(--ink)' : 'var(--ink-4)',
                }}
              >
                <input type="checkbox" checked={nextDays[day]} onChange={() => toggleNextDay(day)} />
                {label}曜
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function SuppliersTab() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<SupplierInput>({
    name: '',
    code: '',
    has_order_sheet: 1,
    delivery_days: '',
    order_day: null,
    delivery_lead_weeks: 0,
    file_ext: 'xlsx',
    notes: '',
  })
  const [showForm, setShowForm] = useState(false)
  const [templateUploading, setTemplateUploading] = useState(false)
  const [templateMsg, setTemplateMsg] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null)
  const [confirmTemplateReset, setConfirmTemplateReset] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchSuppliers()
      setSuppliers(res.data.suppliers)
    } catch {
      setError('仕入先を読み込めませんでした。通信を確認して再読み込みしてください。')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const resetForm = () => {
    setForm({
      name: '',
      code: '',
      has_order_sheet: 1,
      delivery_days: '',
      order_day: null,
      delivery_lead_weeks: 0,
      file_ext: 'xlsx',
      notes: '',
    })
    setEditingId(null)
    setShowForm(false)
    setTemplateMsg(null)
  }

  const handleEdit = (s: Supplier) => {
    setForm({
      name: s.name,
      code: s.code ?? '',
      has_order_sheet: s.has_order_sheet ?? 1,
      delivery_days: s.delivery_days,
      order_day: s.order_day ?? null,
      delivery_lead_weeks: s.delivery_lead_weeks ?? 0,
      file_ext: s.file_ext,
      notes: s.notes ?? '',
    })
    setEditingId(s.id)
    setShowForm(true)
    setError(null)
    setSuccessMsg(null)
    setTemplateMsg(null)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('仕入先の名前を入力してください。')
      return
    }
    try {
      setError(null)
      if (editingId) {
        await updateSupplier(editingId, form)
        setSuccessMsg(`「${form.name}」を更新しました`)
      } else {
        await createSupplier(form)
        setSuccessMsg(`「${form.name}」を追加しました`)
      }
      resetForm()
      load()
    } catch {
      setError('保存できませんでした。入力内容を確認して、もう一度お試しください。')
    }
  }

  const handleDelete = async (s: Supplier) => {
    setDeleteTarget(null)
    const prevSuppliers = suppliers
    setSuppliers((prev) => prev.filter((x) => x.id !== s.id))
    try {
      await deleteSupplier(s.id)
      setSuccessMsg(`「${s.name}」を削除しました`)
    } catch {
      setSuppliers(prevSuppliers)
      setError('削除できませんでした。もう一度お試しください。')
    }
  }

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingId) return
    const file = e.target.files?.[0]
    if (!file) return
    setTemplateUploading(true)
    setTemplateMsg(null)
    try {
      await uploadSupplierTemplate(editingId, file)
      setTemplateMsg('このファイルを発注書のひな形にしました')
      setSuppliers((prev) =>
        prev.map((s) => (s.id === editingId ? { ...s, has_custom_template: true } : s))
      )
    } catch {
      setTemplateMsg('アップロードできませんでした。ファイル形式とサイズを確認してください。')
    } finally {
      setTemplateUploading(false)
      e.target.value = ''
    }
  }

  const handleTemplateDelete = async () => {
    setConfirmTemplateReset(false)
    if (!editingId) return
    try {
      await deleteSupplierTemplate(editingId)
      setTemplateMsg('標準のひな形に戻しました')
      setSuppliers((prev) =>
        prev.map((s) => (s.id === editingId ? { ...s, has_custom_template: false } : s))
      )
    } catch {
      setTemplateMsg('削除できませんでした。もう一度お試しください。')
    }
  }

  const handleTemplateDownload = async () => {
    if (!editingId) return
    try {
      const res = await downloadSupplierTemplate(editingId)
      const supplier = suppliers.find((s) => s.id === editingId)
      const blob = new Blob([res.data as BlobPart])
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${supplier?.name ?? 'template'}_template.${supplier?.file_ext ?? 'xlsx'}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch {
      setTemplateMsg('ダウンロードできませんでした。もう一度お試しください。')
    }
  }

  const editingSupplier = suppliers.find((s) => s.id === editingId)

  return (
    <>
      {deleteTarget && (
        <ConfirmDialog
          title="仕入先を削除します"
          message={`「${deleteTarget.name}」を削除します。この仕入先を指定している材料は、発注先が未設定になります。`}
          confirmLabel="削除する"
          destructive
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {confirmTemplateReset && (
        <ConfirmDialog
          title="ひな形を標準に戻します"
          message="登録したひな形を削除して、標準のひな形に戻します。アップロードしたファイルは元に戻せません。"
          confirmLabel="標準に戻す"
          destructive
          onConfirm={handleTemplateDelete}
          onCancel={() => setConfirmTemplateReset(false)}
        />
      )}

      {successMsg && <p className="notice notice--ok">{successMsg}</p>}
      {!showForm && error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}

      {showForm && (
        <section className="sheet">
          <div className="sheet__head">
            <h2>{editingId ? `${editingSupplier?.name ?? '仕入先'} を編集` : '仕入先を追加'}</h2>
          </div>

          <div className="sheet__body">
            {error && (
              <p className="notice notice--error" role="alert">
                {error}
              </p>
            )}

            <div className="grid2">
              <label className="field">
                <span>名前</span>
                <input
                  className="input"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="魚丹"
                />
              </label>

              <label className="field">
                <span>
                  記号
                  <span className="field__hint">献立表と発注書に印字する1〜5文字</span>
                </span>
                <input
                  className="input"
                  type="text"
                  value={form.code ?? ''}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  maxLength={5}
                />
              </label>

              <label className="field">
                <span>発注書のファイル形式</span>
                <select
                  className="select"
                  value={form.file_ext}
                  onChange={(e) => setForm({ ...form, file_ext: e.target.value })}
                >
                  <option value="xlsx">xlsx</option>
                  <option value="xlsm">xlsm</option>
                </select>
              </label>
            </div>

            <div className="grid2">
              <div className="field">
                <span className="field__label">納品曜日</span>
                <DeliveryDaysPicker
                  key={editingId ?? 'new'}
                  value={form.delivery_days}
                  onChange={(v) => setForm({ ...form, delivery_days: v })}
                />
                {form.order_day !== null && form.order_day !== undefined && (
                  <p className="muted" style={{ margin: '0.4rem 0 0', fontSize: 'var(--fs-xs)' }}>
                    発注曜日（{DOW_MON_FIRST[form.order_day]}曜）より前の納品曜日は翌週納品として扱います。
                  </p>
                )}
              </div>

              <fieldset
                className="field"
                style={{ border: 0, padding: 0, margin: '0 0 0.8rem' }}
              >
                <legend className="field__label" style={{ padding: 0 }}>
                  発注曜日
                </legend>
                <label
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: 'var(--fs-sm)' }}
                >
                  <input
                    type="radio"
                    name="order_day"
                    checked={form.order_day === null}
                    onChange={() => setForm({ ...form, order_day: null })}
                  />
                  今日の日付で出す
                </label>
                {DOW_MON_FIRST.map((label, day) => (
                  <label
                    key={day}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: 'var(--fs-sm)' }}
                  >
                    <input
                      type="radio"
                      name="order_day"
                      checked={form.order_day === day}
                      onChange={() => setForm({ ...form, order_day: day })}
                    />
                    {label}曜日
                  </label>
                ))}
              </fieldset>
            </div>

            <div className="btnrow" style={{ marginBottom: '0.6rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: 'var(--fs-sm)' }}>
                <input
                  type="checkbox"
                  checked={form.has_order_sheet === 1}
                  onChange={(e) => setForm({ ...form, has_order_sheet: e.target.checked ? 1 : 0 })}
                />
                この仕入先に発注書を出す
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: 'var(--fs-sm)' }}>
                <input
                  type="checkbox"
                  checked={form.delivery_lead_weeks === 1}
                  onChange={(e) =>
                    setForm({ ...form, delivery_lead_weeks: e.target.checked ? 1 : 0 })
                  }
                />
                納品は翌週になる
              </label>
            </div>

            {editingId && (
              <div
                style={{
                  border: '1px solid var(--rule)',
                  borderRadius: 'var(--r)',
                  padding: '0.7rem',
                }}
              >
                <p style={{ margin: '0 0 0.4rem', fontWeight: 700, fontSize: 'var(--fs-sm)' }}>
                  発注書のひな形
                  <span className={editingSupplier?.has_custom_template ? 'tag tag--ok' : 'tag tag--plain'} style={{ marginLeft: '0.5rem' }}>
                    {editingSupplier?.has_custom_template ? '登録済み' : '標準'}
                  </span>
                </p>
                <div className="btnrow">
                  <label className={templateUploading ? 'btn' : 'btn btn--primary'}>
                    {templateUploading ? 'アップロードしています' : 'ひな形を登録する'}
                    <input
                      type="file"
                      accept=".xlsx,.xlsm"
                      style={{ display: 'none' }}
                      disabled={templateUploading}
                      onChange={handleTemplateUpload}
                    />
                  </label>
                  <button type="button" className="btn" onClick={handleTemplateDownload}>
                    今のひな形を保存する
                  </button>
                  {editingSupplier?.has_custom_template && (
                    <button type="button" className="btn btn--danger" onClick={() => setConfirmTemplateReset(true)}>
                      標準のひな形に戻す
                    </button>
                  )}
                </div>
                <p className="muted" style={{ margin: '0.4rem 0 0', fontSize: 'var(--fs-xs)' }}>
                  xlsx か xlsm（10MBまで）。セルの位置は変えずに、見た目だけ差し替えられます。
                </p>
                {templateMsg && (
                  <p
                    className={templateMsg.includes('できません') ? 'notice notice--error' : 'notice notice--ok'}
                    style={{ marginTop: '0.5rem', marginBottom: 0 }}
                  >
                    {templateMsg}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="modal__foot">
            <button type="button" className="btn" onClick={resetForm}>
              やめる
            </button>
            <button type="button" className="btn btn--primary" onClick={handleSave}>
              {editingId ? '更新する' : '追加する'}
            </button>
          </div>
        </section>
      )}

      <section className="sheet">
        <div className="sheet__head">
          <h2>仕入先</h2>
          <div className="sheet__meta">
            <span>
              <span className="num">{suppliers.length}</span> 件
            </span>
            <button
              type="button"
              className="btn"
              onClick={() => {
                resetForm()
                setShowForm(true)
              }}
            >
              仕入先を追加
            </button>
          </div>
        </div>

        {loading ? (
          <p className="empty" role="status">読み込んでいます</p>
        ) : suppliers.length === 0 ? (
          <p className="empty">仕入先がまだ登録されていません。</p>
        ) : (
          <div className="sheet__scroll">
            <table className="data" aria-label="仕入先の一覧">
              <thead>
                <tr>
                  <th>名前</th>
                  <th>記号</th>
                  <th>発注書</th>
                  <th>納品曜日</th>
                  <th>発注曜日</th>
                  <th>ひな形</th>
                  <th style={{ textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td className="lead">{s.name}</td>
                    <td>{s.code ? <span className="tag tag--plain">{s.code}</span> : <span className="muted">—</span>}</td>
                    <td>
                      {s.has_order_sheet ? (
                        <span className="tag tag--ok">出す</span>
                      ) : (
                        <span className="muted">出さない</span>
                      )}
                    </td>
                    <td>
                      {formatDeliveryDays(s.delivery_days) || <span className="muted">未設定</span>}
                      {s.delivery_lead_weeks === 1 && (
                        <span className="tag tag--plain" style={{ marginLeft: '0.4rem' }}>
                          翌週納品
                        </span>
                      )}
                    </td>
                    <td>
                      {s.order_day !== null && s.order_day !== undefined ? (
                        `${DOW_MON_FIRST[s.order_day] ?? '—'}曜日`
                      ) : (
                        <span className="muted">今日の日付</span>
                      )}
                    </td>
                    <td>
                      {s.has_custom_template ? (
                        <span className="tag tag--ok">登録済み</span>
                      ) : (
                        <span className="muted">標準</span>
                      )}
                    </td>
                    <td>
                      <div className="actions">
                        <button
                          type="button"
                          className="btn btn--sm"
                          onClick={() => handleEdit(s)}
                          aria-label={`${s.name} を編集`}
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          className="btn btn--sm btn--danger"
                          onClick={() => setDeleteTarget(s)}
                          aria-label={`${s.name} を削除`}
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
