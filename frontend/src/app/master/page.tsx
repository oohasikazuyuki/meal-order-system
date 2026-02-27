'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  fetchRooms, createRoom, deleteRoom, syncKamahoRooms,
  fetchBlocks, createBlock, deleteBlock,
  type Room, type Block,
} from '../_lib/api/client'

type Tab = 'rooms' | 'blocks'

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
        {(['rooms', 'blocks'] as Tab[]).map((t) => (
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
            {t === 'rooms' ? '🏠 部屋管理' : '🔗 ブロック管理'}
          </button>
        ))}
      </div>

      {tab === 'rooms' && <RoomsTab />}
      {tab === 'blocks' && <BlocksTab />}
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

  useEffect(() => { loadRooms() }, [loadRooms])

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
    } catch {
      setError('kamaho との同期に失敗しました。接続設定を確認してください。')
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
    try {
      await deleteRoom(room.id)
      setSuccessMsg(`「${room.name}」を削除しました`)
      loadRooms()
    } catch {
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
              <th style={{ ...th, width: 100, textAlign: 'center' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room, i) => (
              <tr key={room.id} style={{ borderTop: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ ...td, color: '#9ca3af', width: 60 }}>#{room.id}</td>
                <td style={{ ...td, fontWeight: 500 }}>{room.name}</td>
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
            ))}
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
    } catch {
      setError('作成に失敗しました')
    }
  }

  const handleDelete = async (block: Block) => {
    if (!confirm(`「${block.name}」を削除しますか？`)) return
    try {
      await deleteBlock(block.id)
      setSuccessMsg(`「${block.name}」を削除しました`)
      load()
    } catch {
      setError('削除に失敗しました')
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
