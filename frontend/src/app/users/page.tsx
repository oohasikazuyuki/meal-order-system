'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  fetchBlocks,
  type UserRecord,
  type UserInput,
  type Block,
} from '../_lib/api/client'

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
      setError('利用者一覧を読み込めませんでした。通信を確認して再読み込みしてください。')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    fetchBlocks()
      .then((r) => setBlocks(r.data.blocks))
      .catch(() => {})
  }, [])

  const handleDelete = async (user: UserRecord) => {
    if (!confirm(`「${user.name}」を削除します。よろしいですか？`)) return
    const prevUsers = users
    setUsers((prev) => prev.filter((u) => u.id !== user.id))
    try {
      await deleteUser(user.id)
      setSuccessMsg(`「${user.name}」を削除しました`)
    } catch {
      setUsers(prevUsers)
      setError('削除できませんでした。もう一度お試しください。')
    }
  }

  const handleFormSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setShowForm(false)
    setEditTarget(null)
    load()
  }

  const openForm = (target: UserRecord | null) => {
    setEditTarget(target)
    setShowForm(true)
    setSuccessMsg(null)
    setError(null)
  }

  return (
    <div>
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      {successMsg && <p className="notice notice--ok">{successMsg}</p>}

      {showForm && (
        <UserForm
          initial={editTarget}
          blocks={blocks}
          onSuccess={handleFormSuccess}
          onCancel={() => {
            setShowForm(false)
            setEditTarget(null)
          }}
        />
      )}

      <section className="sheet">
        <div className="sheet__head">
          <h2>利用者</h2>
          <div className="sheet__meta">
            <span>
              <span className="num">{users.length}</span> 名
            </span>
            <button type="button" className="btn" onClick={() => openForm(null)}>
              利用者を追加
            </button>
          </div>
        </div>

        {loading ? (
          <p className="empty">読み込んでいます</p>
        ) : users.length === 0 ? (
          <div className="empty">
            <p>利用者がまだ登録されていません。</p>
            <button type="button" className="btn" onClick={() => openForm(null)}>
              最初の利用者を追加する
            </button>
          </div>
        ) : (
          <div className="sheet__scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>名前</th>
                  <th>ログインID</th>
                  <th>権限</th>
                  <th>鎌倉連携ID</th>
                  <th>担当ブロック</th>
                  <th>登録日</th>
                  <th style={{ textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="lead">{user.name}</td>
                    <td className="num" style={{ textAlign: 'left' }}>
                      {user.login_id}
                    </td>
                    <td>
                      <span className={user.role === 'admin' ? 'tag tag--ok' : 'tag tag--plain'}>
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td className="num" style={{ textAlign: 'left' }}>
                      {user.kamaho_login_id || <span className="muted">未設定</span>}
                    </td>
                    <td>
                      {user.role === 'user' ? (
                        (blocks.find((b) => b.id === user.block_id)?.name ?? (
                          <span className="muted">未割当</span>
                        ))
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="muted">
                      {user.created ? new Date(user.created).toLocaleDateString('ja-JP') : '—'}
                    </td>
                    <td>
                      <div className="actions">
                        <button type="button" className="btn btn--sm" onClick={() => openForm(user)}>
                          編集
                        </button>
                        <button
                          type="button"
                          className="btn btn--sm btn--danger"
                          onClick={() => handleDelete(user)}
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
    </div>
  )
}

function UserForm({
  initial,
  blocks,
  onSuccess,
  onCancel,
}: {
  initial: UserRecord | null
  blocks: Block[]
  onSuccess: (msg: string) => void
  onCancel: () => void
}) {
  const isEdit = !!initial
  const [name, setName] = useState(initial?.name ?? '')
  const [loginId, setLoginId] = useState(initial?.login_id ?? '')
  const [password, setPassword] = useState('')
  const [kamahoLoginId, setKamahoLoginId] = useState(initial?.kamaho_login_id ?? '')
  const [kamahoPassword, setKamahoPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'user'>(initial?.role ?? 'user')
  const [blockId, setBlockId] = useState<number | null>(initial?.block_id ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('名前を入力してください。')
      return
    }
    if (!loginId.trim()) {
      setError('ログインIDを入力してください。')
      return
    }
    if (!isEdit && !password) {
      setError('新しい利用者にはパスワードが必要です。')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const data: UserInput = {
        name: name.trim(),
        login_id: loginId.trim(),
        kamaho_login_id: kamahoLoginId.trim(),
        role,
        block_id: role === 'user' ? (blockId ?? null) : null,
      }
      if (password) data.password = password
      if (kamahoPassword) data.kamaho_password = kamahoPassword

      if (isEdit && initial) {
        await updateUser(initial.id, data)
        onSuccess(`「${name}」を更新しました`)
      } else {
        await createUser(data)
        onSuccess(`「${name}」を追加しました`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存できませんでした。もう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="sheet" onSubmit={handleSubmit}>
      <div className="sheet__head">
        <h3>{isEdit ? `${initial!.name} を編集` : '利用者を追加'}</h3>
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </label>

          <label className="field">
            <span>ログインID</span>
            <input
              className="input"
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label className="field">
            <span>
              パスワード
              {isEdit && <span className="field__hint">空欄のままなら変更しません</span>}
            </span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>

          <label className="field">
            <span>権限</span>
            <select
              className="select"
              value={role}
              onChange={(e) => {
                setRole(e.target.value as 'admin' | 'user')
                if (e.target.value === 'admin') setBlockId(null)
              }}
            >
              <option value="user">一般</option>
              <option value="admin">管理者</option>
            </select>
          </label>

          <label className="field">
            <span>鎌倉連携ID</span>
            <input
              className="input"
              type="text"
              value={kamahoLoginId}
              onChange={(e) => setKamahoLoginId(e.target.value)}
              autoComplete="username"
            />
          </label>

          <label className="field">
            <span>
              鎌倉連携パスワード
              <span className="field__hint">空欄のままなら変更しません</span>
            </span>
            <input
              className="input"
              type="password"
              value={kamahoPassword}
              onChange={(e) => setKamahoPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>

          {role === 'user' && (
            <label className="field">
              <span>担当ブロック</span>
              <select
                className="select"
                value={blockId ?? ''}
                onChange={(e) => setBlockId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">未割当</option>
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      <div className="modal__foot">
        <button type="button" className="btn" onClick={onCancel}>
          やめる
        </button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? '保存しています' : isEdit ? '更新する' : '追加する'}
        </button>
      </div>
    </form>
  )
}
