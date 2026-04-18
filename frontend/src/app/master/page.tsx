'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  fetchRooms, createRoom, deleteRoom, syncKamahoRooms,
  fetchBlocks, createBlock, deleteBlock,
  fetchSuppliers, createSupplier, updateSupplier, deleteSupplier,
  uploadSupplierTemplate, deleteSupplierTemplate, downloadSupplierTemplate,
  fetchKamahoMealCounts, loginKamahoIntegration, getKamahoLink, updateKamahoLink,
  type Room, type Block, type Supplier, type SupplierInput,
} from '../_lib/api/client'

const getApiErrorMessage = (err: unknown, fallback: string): string => {
  const maybe = err as { response?: { data?: { message?: string } } }
  return maybe?.response?.data?.message || fallback
}

type Tab = 'rooms' | 'blocks' | 'suppliers'

const TAB_LABELS: Record<Tab, string> = {
  rooms: '🏠 部屋管理',
  blocks: '🔗 ブロック管理',
  suppliers: '🏪 仕入先管理',
}

export default function MasterPage() {
  const [tab, setTab] = useState<Tab>('rooms')

  return (
    <div>
      {/* タブ */}
      <div style={{
        background: '#fff',
        borderRadius: 12,
        padding: '0.5rem',
        marginBottom: '1.5rem',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        display: 'inline-flex',
        gap: '0.25rem',
      }}>
        {(['rooms', 'blocks', 'suppliers'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '0.5rem 1.5rem',
              background: tab === t ? '#1a3a5c' : 'transparent',
              color: tab === t ? '#fff' : '#6b7280',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: tab === t ? 600 : 400,
              transition: 'all 0.15s',
            }}
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

// ========================
// 部屋管理タブ
// ========================
function RoomsTab() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [kamahoRooms, setKamahoRooms] = useState<string[]>([])
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [mealCounts, setMealCounts] = useState<Record<string, Record<string, number>>>({})
  const [loadingMealCounts, setLoadingMealCounts] = useState(false)
  const [kamahoAccount, setKamahoAccount] = useState('')
  const [kamahoPassword, setKamahoPassword] = useState('')
  const [kamahoLoggingIn, setKamahoLoggingIn] = useState(false)

  const loadRooms = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchRooms()
      setRooms(res.data.rooms)
    } catch {
      setError('読み込み失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMealCounts = useCallback(async () => {
    setLoadingMealCounts(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const res = await fetchKamahoMealCounts(today)
      setMealCounts({ [today]: res.data.counts })
    } catch {
      // 食数取得エラーは無視（部屋管理は継続可能）
    } finally {
      setLoadingMealCounts(false)
    }
  }, [])

  useEffect(() => { loadRooms() }, [loadRooms])
  useEffect(() => { loadMealCounts() }, [loadMealCounts])
  useEffect(() => {
    getKamahoLink()
      .then((res) => {
        setKamahoAccount(res.data.kamaho_login_id ?? '')
      })
      .catch(() => {})
  }, [])

  const handleKamahoLogin = async () => {
    const accountFromDom = typeof document !== 'undefined'
      ? ((document.getElementById('kamaho-account') as HTMLInputElement | null)?.value ?? '')
      : ''
    const passwordFromDom = typeof document !== 'undefined'
      ? ((document.getElementById('kamaho-password') as HTMLInputElement | null)?.value ?? '')
      : ''
    const account = (kamahoAccount || accountFromDom).trim()
    const password = kamahoPassword || passwordFromDom

    if (!account || !password) {
      setError('連携ログインIDとパスワードを入力してください')
      return
    }
    setKamahoAccount(account)
    setKamahoPassword(password)
    setKamahoLoggingIn(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const res = await loginKamahoIntegration(account, password)
      setSuccessMsg(`${res.data.message}（部屋 ${res.data.room_count} 件）`)
      loadMealCounts()
    } catch (e) {
      setError(getApiErrorMessage(e, 'kamaho 連携ログインに失敗しました'))
    } finally {
      setKamahoLoggingIn(false)
    }
  }

  const handleKamahoCredentialClear = () => {
    updateKamahoLink({ kamaho_login_id: '' }).catch(() => {})
    setKamahoAccount('')
    setKamahoPassword('')
    setSuccessMsg('kamaho 連携ログイン情報をクリアしました')
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
      if (added.length > 0) {
        setSuccessMsg(`${added.length}件の部屋を追加しました：${added.join('、')}`)
      } else {
        setSuccessMsg('すべての部屋は登録済みです（新規追加なし）')
      }
      // 食数も再取得
      loadMealCounts()
    } catch (e) {
      setError(getApiErrorMessage(e, 'kamaho との同期に失敗しました。接続設定を確認してください。'))
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
      setError('追加に失敗しました')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (room: Room) => {
    if (!confirm(`「${room.name}」を削除しますか？ブロックに含まれている場合は削除できません。`)) return
    const prevRooms = rooms
    setRooms(prev => prev.filter(r => r.id !== room.id))
    try {
      await deleteRoom(room.id)
      setSuccessMsg(`「${room.name}」を削除しました`)
    } catch {
      setRooms(prevRooms)
      setError('削除に失敗しました（ブロックで使用中の可能性があります）')
    }
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
      {/* 手動追加 */}
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
          手動で追加
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="部屋名を入力（例：あじさい、さくら）"
            style={inputStyle}
          />
          <button
            onClick={handleAdd}
            disabled={!newName.trim() || adding}
            style={primaryBtn(!newName.trim() || adding)}
          >
            {adding ? '追加中...' : '追加'}
          </button>
        </div>
      </div>

      {/* kamaho同期 */}
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
          食数管理システム（kamaho）から同期
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
          <input
            id="kamaho-account"
            type="text"
            value={kamahoAccount}
            onChange={(e) => setKamahoAccount(e.target.value)}
            onInput={(e) => setKamahoAccount((e.target as HTMLInputElement).value)}
            placeholder="連携ログインID"
            autoComplete="username"
            style={inputStyle}
          />
          <input
            id="kamaho-password"
            type="password"
            value={kamahoPassword}
            onChange={(e) => setKamahoPassword(e.target.value)}
            onInput={(e) => setKamahoPassword((e.target as HTMLInputElement).value)}
            placeholder="連携パスワード"
            autoComplete="current-password"
            style={inputStyle}
          />
          <button
            onClick={handleKamahoLogin}
            disabled={kamahoLoggingIn}
            style={primaryBtn(kamahoLoggingIn)}
          >
            {kamahoLoggingIn ? 'ログイン中...' : '連携ログイン'}
          </button>
          <button
            onClick={handleKamahoCredentialClear}
            style={{
              padding: '0.55rem 0.9rem',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              background: '#fff',
              color: '#6b7280',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            クリア
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.85rem', color: '#9ca3af', flex: 1 }}>
            kamaho に登録されている部屋名を自動で読み込みます
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={primaryBtn(syncing)}
          >
            {syncing ? '同期中...' : '🔄 kamahoと同期'}
          </button>
        </div>
        {kamahoRooms.length > 0 && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>
            kamaho の部屋：{kamahoRooms.join('、')}
          </div>
        )}
      </div>

      {/* メッセージ */}
      {(error || successMsg) && (
        <div style={{ padding: '0.6rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
          {error && <p style={{ margin: 0, color: '#dc2626', fontSize: '0.85rem' }}>⚠ {error}</p>}
          {successMsg && <p style={{ margin: 0, color: '#16a34a', fontSize: '0.85rem' }}>✓ {successMsg}</p>}
        </div>
      )}

      {/* 一覧 */}
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>読み込み中...</div>
      ) : rooms.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏠</div>
          部屋が登録されていません。「kamahoと同期」ボタンで取得してください。
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={th}>ID</th>
              <th style={th}>部屋名</th>
              <th style={th}>本日の食数</th>
              <th style={{ ...th, width: 100, textAlign: 'center' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room, i) => {
              const today = new Date().toISOString().split('T')[0]
              const mealCount = mealCounts[today]?.[room.name]
              return (
                <tr key={room.id} style={{ borderTop: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ ...td, color: '#9ca3af', width: 60 }}>#{room.id}</td>
                  <td style={{ ...td, fontWeight: 500 }}>{room.name}</td>
                  <td style={td}>
                    {loadingMealCounts ? (
                      <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>読み込み中...</span>
                    ) : mealCount !== undefined ? (
                      <span style={{ background: '#dbeafe', color: '#1e40af', padding: '0.2rem 0.6rem', borderRadius: 4, fontSize: '0.85rem', fontWeight: 600 }}>
                        {mealCount}食
                      </span>
                    ) : (
                      <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>—</span>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <button
                      onClick={() => handleDelete(room)}
                      style={{
                        padding: '0.3rem 0.75rem',
                        background: '#fef2f2',
                        color: '#dc2626',
                        border: '1px solid #fca5a5',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                      }}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ========================
// ブロック管理タブ
// ========================
function BlocksTab() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [newName, setNewName] = useState('')
  const [room1Id, setRoom1Id] = useState<number>(0)
  const [room2Id, setRoom2Id] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [roomsRes, blocksRes] = await Promise.all([fetchRooms(), fetchBlocks()])
      setRooms(roomsRes.data.rooms)
      setBlocks(blocksRes.data.blocks)
    } catch {
      setError('読み込み失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!newName.trim() || !room1Id || !room2Id) {
      setError('ブロック名・部屋1・部屋2をすべて選択してください')
      return
    }
    if (room1Id === room2Id) {
      setError('部屋1と部屋2は異なる部屋を選択してください')
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
      setError(getApiErrorMessage(e, '作成に失敗しました'))
    }
  }

  const handleDelete = async (block: Block) => {
    if (!confirm(`「${block.name}」を削除しますか？`)) return
    const prevBlocks = blocks
    setBlocks(prev => prev.filter(b => b.id !== block.id))
    try {
      await deleteBlock(block.id)
      setSuccessMsg(`「${block.name}」を削除しました`)
    } catch (e) {
      setBlocks(prevBlocks)
      setError(getApiErrorMessage(e, '削除に失敗しました'))
    }
  }

  const roomName = (id: number) => rooms.find((r) => r.id === id)?.name ?? `(ID:${id})`

  return (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
      {/* 追加フォーム */}
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="ブロック名（例：Aブロック）"
            style={{ ...inputStyle, width: 200, flex: 'none' }}
          />
          <select
            value={room1Id}
            onChange={(e) => setRoom1Id(Number(e.target.value))}
            style={selectStyle}
          >
            <option value={0}>部屋1を選択</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select
            value={room2Id}
            onChange={(e) => setRoom2Id(Number(e.target.value))}
            style={selectStyle}
          >
            <option value={0}>部屋2を選択</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button
            onClick={handleAdd}
            disabled={!newName.trim() || !room1Id || !room2Id}
            style={primaryBtn(!newName.trim() || !room1Id || !room2Id)}
          >
            追加
          </button>
        </div>
        {error && <p style={{ margin: '0.5rem 0 0', color: '#dc2626', fontSize: '0.85rem' }}>⚠ {error}</p>}
        {successMsg && <p style={{ margin: '0.5rem 0 0', color: '#16a34a', fontSize: '0.85rem' }}>✓ {successMsg}</p>}

        {rooms.length === 0 && !loading && (
          <p style={{ margin: '0.75rem 0 0', color: '#f59e0b', fontSize: '0.85rem' }}>
            ⚠ まず「部屋管理」タブで部屋を追加してください
          </p>
        )}
      </div>

      {/* 一覧 */}
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>読み込み中...</div>
      ) : blocks.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔗</div>
          ブロックが登録されていません。上のフォームから追加してください。
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={th}>ID</th>
              <th style={th}>ブロック名</th>
              <th style={th}>部屋1</th>
              <th style={th}>部屋2</th>
              <th style={{ ...th, width: 100, textAlign: 'center' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((block, i) => (
              <tr key={block.id} style={{ borderTop: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ ...td, color: '#9ca3af', width: 60 }}>#{block.id}</td>
                <td style={{ ...td, fontWeight: 600 }}>{block.name}</td>
                <td style={td}>
                  <span style={{ background: '#eff6ff', color: '#2563eb', padding: '0.2rem 0.6rem', borderRadius: 4, fontSize: '0.85rem', fontWeight: 500 }}>
                    {roomName(block.room1_id)}
                  </span>
                </td>
                <td style={td}>
                  <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '0.2rem 0.6rem', borderRadius: 4, fontSize: '0.85rem', fontWeight: 500 }}>
                    {roomName(block.room2_id)}
                  </span>
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <button
                    onClick={() => handleDelete(block)}
                    style={{
                      padding: '0.3rem 0.75rem',
                      background: '#fef2f2',
                      color: '#dc2626',
                      border: '1px solid #fca5a5',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ========================
// 仕入先管理タブ
// ========================
const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日']
const WEEK_LABELS: Record<number, string> = { 0: '毎週', 1: '第1', 2: '第2', 3: '第3', 4: '第4', 5: '第5' }

/** "D" or "N:D" エントリ1パートをラベル化 */
function formatDaysPart(part: string): string {
  if (!part.trim()) return ''
  const dayWeeks: Record<number, number[]> = {}
  for (const entry of part.split(',')) {
    const t = entry.trim()
    if (!t) continue
    let week = 0, day: number
    if (t.includes(':')) {
      const [w, d] = t.split(':')
      week = parseInt(w); day = parseInt(d)
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
      const label = DAY_LABELS[Number(dayStr)] ?? dayStr
      if (weeks.includes(0)) return label
      return weeks.sort((a, b) => a - b).map(w => `${WEEK_LABELS[w] ?? w}${label}`).join('・')
    })
    .join('・')
}

/** "D" or "N:D" or "今週days|翌週days" を表示ラベルに変換 */
function formatDeliveryDays(days: string): string {
  if (!days.trim()) return ''
  if (days.includes('|')) {
    const [thisStr, nextStr] = days.split('|', 2)
    const thisPart = formatDaysPart(thisStr)
    const nextPart = formatDaysPart(nextStr)
    const parts = []
    if (thisPart) parts.push(`今週:${thisPart}`)
    if (nextPart) parts.push(`翌週:${nextPart}`)
    return parts.join(' / ')
  }
  return formatDaysPart(days)
}

// ------- DeliveryDaysPicker -------
interface DaySpec { enabled: boolean; weeks: number[] }

function parseDeliverySpec(str: string): DaySpec[] {
  const spec: DaySpec[] = Array.from({ length: 7 }, () => ({ enabled: false, weeks: [] }))
  for (const entry of str.split(',')) {
    const t = entry.trim()
    if (!t) continue
    let week = 0, day: number
    if (t.includes(':')) {
      const [w, d] = t.split(':')
      week = parseInt(w); day = parseInt(d)
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

/** 翌週用シンプルな boolean[7] のパース・フォーマット */
function parseSimpleWeek(str: string): boolean[] {
  const result = Array(7).fill(false) as boolean[]
  for (const t of str.split(',')) {
    const n = parseInt(t.trim())
    if (!isNaN(n) && n >= 0 && n <= 6) result[n] = true
  }
  return result
}
function formatSimpleWeek(bools: boolean[]): string {
  return bools.map((v, i) => v ? String(i) : null).filter(Boolean).join(',')
}

function DeliveryDaysPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const hasPipe = value.includes('|')
  const [thisSpec, setThisSpec] = useState<DaySpec[]>(() =>
    parseDeliverySpec(hasPipe ? value.split('|')[0] : value))
  const [nextDays, setNextDays] = useState<boolean[]>(() =>
    hasPipe ? parseSimpleWeek(value.split('|')[1]) : Array(7).fill(false))
  const [splitMode, setSplitMode] = useState(hasPipe)

  // valueが外部から変わったとき（編集切替時）に再初期化
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    const hp = value.includes('|')
    setThisSpec(parseDeliverySpec(hp ? value.split('|')[0] : value))
    setNextDays(hp ? parseSimpleWeek(value.split('|')[1]) : Array(7).fill(false))
    setSplitMode(hp)
  }

  const emit = (ts: DaySpec[], nd: boolean[], sm: boolean) => {
    if (sm) {
      onChange(`${formatDeliverySpec(ts)}|${formatSimpleWeek(nd)}`)
    } else {
      onChange(formatDeliverySpec(ts))
    }
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
    const s = thisSpec.map((d, i) => i === day
      ? { enabled: !d.enabled, weeks: d.enabled ? [] : [0] }
      : d)
    updateThis(s)
  }

  const toggleWeek = (day: number, week: number) => {
    const daySpec = { ...thisSpec[day], weeks: [...thisSpec[day].weeks] }
    if (week === 0) {
      daySpec.weeks = daySpec.weeks.includes(0) ? [] : [0]
    } else {
      daySpec.weeks = daySpec.weeks.includes(week)
        ? daySpec.weeks.filter(w => w !== week)
        : [...daySpec.weeks.filter(w => w !== 0), week]
    }
    updateThis(thisSpec.map((d, i) => i === day ? daySpec : d))
  }

  const toggleNextDay = (day: number) => {
    const nd = nextDays.map((v, i) => i === day ? !v : v)
    setNextDays(nd)
    emit(thisSpec, nd, splitMode)
  }

  const sectionLabel = (text: string, color: string) => (
    <div style={{ fontSize: '0.72rem', fontWeight: 700, color, marginBottom: '0.2rem', marginTop: '0.3rem' }}>{text}</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
      {/* モード切替ボタン */}
      <button
        type="button"
        onClick={toggleMode}
        style={{
          alignSelf: 'flex-start', marginBottom: '0.25rem',
          padding: '0.15rem 0.55rem', fontSize: '0.72rem', fontWeight: 600,
          background: splitMode ? '#fef3c7' : '#f3f4f6',
          color: splitMode ? '#92400e' : '#6b7280',
          border: `1px solid ${splitMode ? '#fcd34d' : '#e5e7eb'}`,
          borderRadius: 4, cursor: 'pointer',
        }}
      >
        {splitMode ? '✓ 今週・翌週を別々に設定中' : '今週・翌週を別々に設定する'}
      </button>

      {/* 今週（splitMode時はラベル付き） */}
      {splitMode && sectionLabel('【今週の納品曜日】', '#1a3a5c')}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        {DAY_LABELS.map((label, day) => (
          <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: 28 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: 44, cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, color: thisSpec[day].enabled ? '#1a3a5c' : '#9ca3af' }}>
              <input type="checkbox" checked={thisSpec[day].enabled} onChange={() => toggleDay(day)} style={{ cursor: 'pointer' }} />
              {label}曜
            </label>
            {thisSpec[day].enabled && !splitMode && (
              <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
                {([0, 1, 2, 3, 4, 5] as number[]).map(week => {
                  const sel = thisSpec[day].weeks.includes(week)
                  return (
                    <button key={week} type="button" onClick={() => toggleWeek(day, week)}
                      style={{ padding: '0.15rem 0.45rem', fontSize: '0.75rem', background: sel ? '#1a3a5c' : '#f3f4f6', color: sel ? '#fff' : '#6b7280', border: `1px solid ${sel ? '#1a3a5c' : '#e5e7eb'}`, borderRadius: 4, cursor: 'pointer', fontWeight: sel ? 600 : 400 }}>
                      {WEEK_LABELS[week]}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 翌週（splitModeのみ表示） */}
      {splitMode && (
        <>
          {sectionLabel('【翌週の納品曜日】', '#d97706')}
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {DAY_LABELS.map((label, day) => (
              <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, color: nextDays[day] ? '#d97706' : '#9ca3af' }}>
                <input type="checkbox" checked={nextDays[day]} onChange={() => toggleNextDay(day)} style={{ cursor: 'pointer' }} />
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
  const [form, setForm] = useState<SupplierInput>({ name: '', code: '', has_order_sheet: 1, delivery_days: '', order_day: null, delivery_lead_weeks: 0, file_ext: 'xlsx', notes: '' })
  const [showForm, setShowForm] = useState(false)
  const [templateUploading, setTemplateUploading] = useState(false)
  const [templateMsg, setTemplateMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchSuppliers()
      setSuppliers(res.data.suppliers)
    } catch {
      setError('読み込み失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const resetForm = () => {
    setForm({ name: '', code: '', has_order_sheet: 1, delivery_days: '', order_day: null, delivery_lead_weeks: 0, file_ext: 'xlsx', notes: '' })
    setEditingId(null)
    setShowForm(false)
  }

  const handleEdit = (s: Supplier) => {
    setForm({ name: s.name, code: s.code ?? '', has_order_sheet: s.has_order_sheet ?? 1, delivery_days: s.delivery_days, order_day: s.order_day ?? null, delivery_lead_weeks: s.delivery_lead_weeks ?? 0, file_ext: s.file_ext, notes: s.notes ?? '' })
    setEditingId(s.id)
    setShowForm(true)
    setError(null)
    setSuccessMsg(null)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('名前は必須です')
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
      setError('保存に失敗しました')
    }
  }

  const handleDelete = async (s: Supplier) => {
    if (!confirm(`「${s.name}」を削除しますか？`)) return
    const prevSuppliers = suppliers
    setSuppliers(prev => prev.filter(x => x.id !== s.id))
    try {
      await deleteSupplier(s.id)
      setSuccessMsg(`「${s.name}」を削除しました`)
    } catch {
      setSuppliers(prevSuppliers)
      setError('削除に失敗しました')
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
      setTemplateMsg('テンプレートをアップロードしました')
      setSuppliers(prev => prev.map(s => s.id === editingId ? { ...s, has_custom_template: true } : s))
    } catch {
      setTemplateMsg('アップロードに失敗しました')
    } finally {
      setTemplateUploading(false)
      e.target.value = ''
    }
  }

  const handleTemplateDelete = async () => {
    if (!editingId) return
    if (!confirm('カスタムテンプレートを削除してデフォルトに戻しますか？')) return
    try {
      await deleteSupplierTemplate(editingId)
      setTemplateMsg('デフォルトテンプレートに戻しました')
      setSuppliers(prev => prev.map(s => s.id === editingId ? { ...s, has_custom_template: false } : s))
    } catch {
      setTemplateMsg('削除に失敗しました')
    }
  }

  const handleTemplateDownload = async () => {
    if (!editingId) return
    try {
      const res = await downloadSupplierTemplate(editingId)
      const supplier = suppliers.find(s => s.id === editingId)
      const blob = new Blob([res.data as BlobPart])
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${supplier?.name ?? 'template'}_template.${supplier?.file_ext ?? 'xlsx'}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch {
      setTemplateMsg('ダウンロードに失敗しました')
    }
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
      {/* ツールバー */}
      <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>発注書を生成する仕入先を管理します</div>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          style={primaryBtn(false)}
        >
          + 仕入先を追加
        </button>
      </div>

      {/* フォーム */}
      {showForm && (
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', background: '#eff6ff' }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.75rem', color: '#1d4ed8' }}>
            {editingId ? '仕入先を編集' : '新しい仕入先を追加'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 80px 1fr 1fr auto auto', gap: '1rem', alignItems: 'start' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem' }}>名前</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例：魚丹"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem' }}>記号</label>
              <input
                type="text"
                value={form.code ?? ''}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="例：U"
                maxLength={5}
                style={{ ...inputStyle, textAlign: 'center' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.4rem' }}>
                納品曜日（毎週 or 第N週を選択）
              </label>
              <DeliveryDaysPicker
                key={editingId ?? 'new'}
                value={form.delivery_days}
                onChange={(v) => setForm({ ...form, delivery_days: v })}
              />
              {form.order_day !== null && form.order_day !== undefined && (
                <div style={{ marginTop: '0.4rem', fontSize: '0.73rem', color: '#6b7280', lineHeight: 1.4 }}>
                  ※ 発注曜日（{DAY_LABELS[form.order_day]}曜）より前の納品曜日は<br />
                  　翌週納品として扱われます
                </div>
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.4rem' }}>
                発注曜日
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', color: form.order_day === null ? '#1a3a5c' : '#9ca3af', cursor: 'pointer' }}>
                  <input type="radio" name="order_day" checked={form.order_day === null} onChange={() => setForm({ ...form, order_day: null })} />
                  今日の日付
                </label>
                {DAY_LABELS.map((label, day) => (
                  <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', color: form.order_day === day ? '#1a3a5c' : '#374151', cursor: 'pointer' }}>
                    <input type="radio" name="order_day" checked={form.order_day === day} onChange={() => setForm({ ...form, order_day: day })} />
                    {label}曜日
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem' }}>ファイル形式</label>
              <select
                value={form.file_ext}
                onChange={(e) => setForm({ ...form, file_ext: e.target.value })}
                style={selectStyle}
              >
                <option value="xlsx">xlsx</option>
                <option value="xlsm">xlsm</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#374151', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={form.has_order_sheet === 1}
                  onChange={e => setForm({ ...form, has_order_sheet: e.target.checked ? 1 : 0 })}
                />
                発注書あり
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: form.delivery_lead_weeks === 1 ? '#d97706' : '#374151', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={form.delivery_lead_weeks === 1}
                  onChange={e => setForm({ ...form, delivery_lead_weeks: e.target.checked ? 1 : 0 })}
                />
                翌週納品
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={handleSave} style={primaryBtn(false)}>保存</button>
                <button onClick={resetForm} style={{ ...primaryBtn(false), background: '#e5e7eb', color: '#374151' }}>キャンセル</button>
              </div>
            </div>
          </div>
          {error && <p style={{ margin: '0.5rem 0 0', color: '#dc2626', fontSize: '0.85rem' }}>⚠ {error}</p>}

          {/* テンプレート管理（編集時のみ表示） */}
          {editingId && (
            <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#15803d', marginBottom: '0.5rem' }}>
                発注書テンプレート
                {suppliers.find(s => s.id === editingId)?.has_custom_template && (
                  <span style={{ marginLeft: '0.5rem', background: '#dcfce7', color: '#16a34a', padding: '0.1rem 0.4rem', borderRadius: 4, fontSize: '0.7rem' }}>カスタム使用中</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{
                  padding: '0.3rem 0.75rem', background: templateUploading ? '#e5e7eb' : '#1a3a5c', color: '#fff',
                  borderRadius: 6, cursor: templateUploading ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 600,
                }}>
                  {templateUploading ? 'アップロード中...' : 'テンプレートをアップロード'}
                  <input
                    type="file"
                    accept=".xlsx,.xlsm"
                    style={{ display: 'none' }}
                    disabled={templateUploading}
                    onChange={handleTemplateUpload}
                  />
                </label>
                <button
                  onClick={handleTemplateDownload}
                  style={{ padding: '0.3rem 0.75rem', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                >
                  現在のテンプレートをDL
                </button>
                {suppliers.find(s => s.id === editingId)?.has_custom_template && (
                  <button
                    onClick={handleTemplateDelete}
                    style={{ padding: '0.3rem 0.75rem', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                  >
                    カスタムを削除（デフォルトに戻す）
                  </button>
                )}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#6b7280', margin: '0.4rem 0 0' }}>
                xlsx / xlsm ファイル（最大10MB）。セル位置を変えずに見た目のみカスタマイズできます。
              </p>
              {templateMsg && (
                <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: templateMsg.includes('失敗') ? '#dc2626' : '#16a34a' }}>
                  {templateMsg.includes('失敗') ? '⚠ ' : '✓ '}{templateMsg}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* メッセージ */}
      {successMsg && (
        <div style={{ padding: '0.6rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
          <p style={{ margin: 0, color: '#16a34a', fontSize: '0.85rem' }}>✓ {successMsg}</p>
        </div>
      )}
      {!showForm && error && (
        <div style={{ padding: '0.6rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
          <p style={{ margin: 0, color: '#dc2626', fontSize: '0.85rem' }}>⚠ {error}</p>
        </div>
      )}

      {/* 一覧 */}
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>読み込み中...</div>
      ) : suppliers.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏪</div>
          仕入先が登録されていません。
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={th}>ID</th>
              <th style={th}>名前</th>
              <th style={th}>記号</th>
              <th style={{ ...th, textAlign: 'center' }}>発注書</th>
              <th style={th}>納品曜日</th>
              <th style={th}>発注曜日</th>
              <th style={{ ...th, textAlign: 'center' }}>翌週納品</th>
              <th style={th}>ファイル形式</th>
              <th style={{ ...th, textAlign: 'center' }}>テンプレート</th>
              <th style={{ ...th, width: 150, textAlign: 'center' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s, i) => (
              <tr key={s.id} style={{ borderTop: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ ...td, color: '#9ca3af', width: 60 }}>#{s.id}</td>
                <td style={{ ...td, fontWeight: 600 }}>{s.name}</td>
                <td style={{ ...td, textAlign: 'center' }}>
                  {s.code ? <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.15rem 0.5rem', borderRadius: 4, fontWeight: 700, fontSize: '0.85rem' }}>{s.code}</span> : <span style={{ color: '#d1d5db' }}>—</span>}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  {s.has_order_sheet
                    ? <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span>
                    : <span style={{ color: '#9ca3af' }}>—</span>}
                </td>
                <td style={td}>{formatDeliveryDays(s.delivery_days)}</td>
                <td style={td}>
                  {s.order_day !== null && s.order_day !== undefined
                    ? <span style={{ background: '#fef3c7', color: '#92400e', padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.85rem', fontWeight: 600 }}>{DAY_LABELS[s.order_day] ?? '—'}曜日</span>
                    : <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>今日の日付</span>}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  {s.delivery_lead_weeks === 1
                    ? <span style={{ background: '#fef3c7', color: '#d97706', padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.85rem', fontWeight: 600 }}>翌週</span>
                    : <span style={{ color: '#9ca3af' }}>—</span>}
                </td>
                <td style={td}><span style={{ background: '#f3f4f6', padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.85rem', fontFamily: 'monospace' }}>{s.file_ext}</span></td>
                <td style={{ ...td, textAlign: 'center' }}>
                  {s.has_custom_template
                    ? <span style={{ background: '#dcfce7', color: '#15803d', padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.78rem', fontWeight: 600 }}>カスタム</span>
                    : <span style={{ color: '#9ca3af', fontSize: '0.78rem' }}>デフォルト</span>}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                    <button
                      onClick={() => handleEdit(s)}
                      style={{ padding: '0.3rem 0.75rem', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      style={{ padding: '0.3rem 0.75rem', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                    >
                      削除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// --- Styles ---
const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.5rem 0.75rem',
  fontSize: '0.9rem',
  border: '2px solid #e5e7eb',
  borderRadius: 8,
  outline: 'none',
  color: '#1a202c',
  minWidth: 0,
}

const selectStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  fontSize: '0.9rem',
  border: '2px solid #e5e7eb',
  borderRadius: 8,
  outline: 'none',
  color: '#1a202c',
  background: '#fff',
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '0.5rem 1.25rem',
    background: disabled ? '#e5e7eb' : '#1a3a5c',
    color: disabled ? '#9ca3af' : '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '0.9rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  }
}

const th: React.CSSProperties = {
  padding: '0.65rem 1.25rem',
  textAlign: 'left',
  fontSize: '0.78rem',
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '2px solid #e2e8f0',
}

const td: React.CSSProperties = {
  padding: '0.75rem 1.25rem',
  fontSize: '0.9rem',
  color: '#374151',
}
