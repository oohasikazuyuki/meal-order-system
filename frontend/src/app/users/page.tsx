'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchUsers, createUser, updateUser, deleteUser, fetchBlocks, type UserRecord, type UserInput, type Block } from '../_lib/api/client'

const ROLE_LABELS = { admin: '管理者', user: '一般' }

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<UserRecord | null>(null)
  const [blocks, setBlocks] = useState<Block[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchUsers()
      setUsers(res.data.users)
    } catch {
      setError('読み込み失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { fetchBlocks().then(r => setBlocks(r.data.blocks)).catch(() => {}) }, [])

  const handleDelete = async (user: UserRecord) => {
    if (!confirm(`「${user.name}」を削除しますか？`)) return
    const prevUsers = users
    setUsers(prev => prev.filter(u => u.id !== user.id))
    try {
      await deleteUser(user.id)
      setSuccessMsg(`「${user.name}」を削除しました`)
    } catch {
      setUsers(prevUsers)
      setError('削除に失敗しました')
    }
  }

  const handleFormSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setShowForm(false)
    setEditTarget(null)
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
        <button
          onClick={() => { setEditTarget(null); setShowForm(true); setSuccessMsg(null); setError(null) }}
          style={primaryBtn}
        >
          ＋ ユーザーを追加
        </button>
      </div>

      {error && <div style={alertStyle('error')}>⚠ {error}</div>}
      {successMsg && <div style={alertStyle('success')}>✓ {successMsg}</div>}

      {showForm && (
        <UserForm
          initial={editTarget}
          blocks={blocks}
          onSuccess={handleFormSuccess}
          onCancel={() => { setShowForm(false); setEditTarget(null) }}
        />
      )}

      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
          <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#374151' }}>
            ユーザー一覧（{users.length}名）
          </h2>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>読み込み中...</div>
        ) : users.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
            ユーザーが登録されていません
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={th}>ID</th>
                <th style={th}>名前</th>
                <th style={th}>ログインID</th>
                <th style={th}>権限</th>
                <th style={th}>担当ブロック</th>
                <th style={th}>登録日</th>
                <th style={{ ...th, textAlign: 'center', width: 140 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => (
                <tr key={user.id} style={{ borderTop: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ ...td, color: '#9ca3af', width: 60 }}>#{user.id}</td>
                  <td style={{ ...td, fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{
                        width: 32, height: 32,
                        background: user.role === 'admin' ? '#1a3a5c' : '#e5e7eb',
                        borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: user.role === 'admin' ? '#fff' : '#6b7280',
                        fontSize: '0.85rem', fontWeight: 700, flexShrink: 0,
                      }}>
                        {user.name.charAt(0)}
                      </div>
                      {user.name}
                    </div>
                  </td>
                  <td style={{ ...td, fontFamily: 'monospace', color: '#4b5563' }}>{user.login_id}</td>
                  <td style={td}>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.2rem 0.7rem',
                      borderRadius: 999,
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      background: user.role === 'admin' ? '#eff6ff' : '#f3f4f6',
                      color: user.role === 'admin' ? '#2563eb' : '#6b7280',
                    }}>
                      {ROLE_LABELS[user.role]}
                    </span>
                  </td>
                  <td style={{ ...td, fontSize: '0.85rem', color: '#374151' }}>
                    {user.role === 'user'
                      ? (blocks.find(b => b.id === user.block_id)?.name ?? <span style={{ color: '#9ca3af' }}>未割当</span>)
                      : <span style={{ color: '#9ca3af' }}>—</span>
                    }
                  </td>
                  <td style={{ ...td, color: '#9ca3af', fontSize: '0.85rem' }}>
                    {user.created ? new Date(user.created).toLocaleDateString('ja-JP') : '—'}
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button
                        onClick={() => { setEditTarget(user); setShowForm(true); setSuccessMsg(null); setError(null) }}
                        style={editBtn}
                      >
                        編集
                      </button>
                      <button onClick={() => handleDelete(user)} style={deleteBtn}>削除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ========================
// 追加・編集フォーム
// ========================
function UserForm({ initial, blocks, onSuccess, onCancel }: {
  initial: UserRecord | null
  blocks: Block[]
  onSuccess: (msg: string) => void
  onCancel: () => void
}) {
  const isEdit = !!initial
  const [name, setName] = useState(initial?.name ?? '')
  const [loginId, setLoginId] = useState(initial?.login_id ?? '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'user'>(initial?.role ?? 'user')
  const [blockId, setBlockId] = useState<number | null>(initial?.block_id ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('名前は必須です'); return }
    if (!loginId.trim()) { setError('ログインIDは必須です'); return }
    if (!isEdit && !password) { setError('新規ユーザーはパスワードが必須です'); return }
    setSaving(true)
    setError(null)
    try {
      const data: UserInput = { 
        name: name.trim(), 
        login_id: loginId.trim(), 
        role, 
        block_id: role === 'user' ? (blockId ?? null) : null 
      }
      if (password) data.password = password

      if (isEdit && initial) {
        await updateUser(initial.id, data)
        onSuccess(`「${name}」を更新しました`)
      } else {
        await createUser(data)
        onSuccess(`「${name}」を追加しました`)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '保存に失敗しました'
      setError(errorMsg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
      padding: '1.5rem',
      marginBottom: '1.5rem',
      border: '2px solid #e5e7eb',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1a202c' }}>
          {isEdit ? '✏ ユーザーを編集' : '＋ ユーザーを追加'}
        </h3>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1.2rem' }}>✕</button>
      </div>

      {error && <div style={{ ...alertStyle('error'), marginBottom: '1rem' }}>⚠ {error}</div>}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <label style={labelStyle}>名前 <span style={{ color: '#dc2626' }}>*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：山田 太郎"
              style={formInput}
              autoFocus
            />
          </div>
          <div>
            <label style={labelStyle}>ログインID <span style={{ color: '#dc2626' }}>*</span></label>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="例：yamada"
              style={formInput}
              autoComplete="username"
            />
          </div>
          <div>
            <label style={labelStyle}>
              パスワード{isEdit && <span style={{ color: '#9ca3af', fontWeight: 400 }}> （変更時のみ）</span>}
              {!isEdit && <span style={{ color: '#dc2626' }}> *</span>}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEdit ? '変更しない場合は空欄' : 'パスワードを入力'}
              style={formInput}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label style={labelStyle}>権限 <span style={{ color: '#dc2626' }}>*</span></label>
            <select value={role} onChange={(e) => { setRole(e.target.value as 'admin' | 'user'); if (e.target.value === 'admin') setBlockId(null) }} style={{ ...formInput, background: '#fff' }}>
              <option value="user">一般</option>
              <option value="admin">管理者</option>
            </select>
          </div>
          {role === 'user' && (
            <div>
              <label style={labelStyle}>担当ブロック</label>
              <select value={blockId ?? ''} onChange={(e) => setBlockId(e.target.value ? Number(e.target.value) : null)} style={{ ...formInput, background: '#fff' }}>
                <option value="">未割当</option>
                {blocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} style={cancelBtn}>キャンセル</button>
          <button type="submit" disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
            {saving ? '保存中...' : isEdit ? '更新' : '追加'}
          </button>
        </div>
      </form>
    </div>
  )
}

// --- Styles ---
function alertStyle(type: 'error' | 'success'): React.CSSProperties {
  return {
    background: type === 'error' ? '#fef2f2' : '#f0fdf4',
    border: `1px solid ${type === 'error' ? '#fca5a5' : '#86efac'}`,
    borderRadius: 8,
    padding: '0.75rem 1rem',
    marginBottom: '1rem',
    color: type === 'error' ? '#dc2626' : '#16a34a',
    fontSize: '0.9rem',
  }
}
const primaryBtn: React.CSSProperties = { padding: '0.55rem 1.25rem', background: '#1a3a5c', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }
const cancelBtn: React.CSSProperties = { padding: '0.55rem 1.25rem', background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }
const editBtn: React.CSSProperties = { padding: '0.3rem 0.75rem', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }
const deleteBtn: React.CSSProperties = { padding: '0.3rem 0.75rem', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.4rem', fontWeight: 600, color: '#374151', fontSize: '0.85rem' }
const formInput: React.CSSProperties = { width: '100%', padding: '0.55rem 0.75rem', fontSize: '0.9rem', border: '2px solid #e5e7eb', borderRadius: 8, outline: 'none', color: '#1a202c', boxSizing: 'border-box' }
const th: React.CSSProperties = { padding: '0.65rem 1.25rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0' }
const td: React.CSSProperties = { padding: '0.75rem 1.25rem', fontSize: '0.9rem', color: '#374151' }
