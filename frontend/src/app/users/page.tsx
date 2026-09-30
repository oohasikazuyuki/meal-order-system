'use client'

import { useState, useEffect, useCallback } from 'react'
import ConfirmDialog from '../_components/ConfirmDialog'
import ErrorNotice from '../_components/ErrorNotice'
import { generatePassword, validateLoginId } from '../_lib/password'
import { useModal } from '../_lib/useModal'
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
  const [loadError, setLoadError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  // 作ったあと、本人にIDとパスワードを伝える必要がある。
  // 画面を閉じると二度と確認できないので、その場で控えられるようにする
  const [handover, setHandover] = useState<{ name: string; loginId: string; password: string } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<UserRecord | null>(null)
  const [blocks, setBlocks] = useState<Block[]>([])
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetchUsers()
      setUsers(res.data.users)
    } catch {
      setLoadError('利用者一覧を読み込めませんでした。通信を確認してください。')
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
    setDeleteTarget(null)
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

  const handleFormSuccess = (
    msg: string,
    created?: { name: string; loginId: string; password: string }
  ) => {
    setSuccessMsg(msg)
    setHandover(created ?? null)
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
      {deleteTarget && (
        <ConfirmDialog
          title="利用者を削除します"
          message={`「${deleteTarget.name}」（ログインID: ${deleteTarget.login_id}）を削除します。この利用者はログインできなくなります。`}
          confirmLabel="削除する"
          destructive
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {loadError && <ErrorNotice message={loadError} onRetry={load} busy={loading} />}
      {error && <ErrorNotice message={error} />}
      {successMsg && !handover && <p className="notice notice--ok">{successMsg}</p>}

      {/* パスワードはハッシュ化して保存するので、この画面を離れると二度と見られない。
          本人に伝えるまでの間だけ、その場に出しておく */}
      {handover && (
        <section className="sheet handover">
          <div className="sheet__head">
            <h2>「{handover.name}」を追加しました</h2>
          </div>
          <div className="sheet__body">
            <p style={{ margin: '0 0 0.7rem' }}>
              本人に下の2つを伝えてください。
              <strong>この画面を閉じると、パスワードは二度と確認できません。</strong>
            </p>
            <dl className="handover__list">
              <dt>ログインID</dt>
              <dd className="num">{handover.loginId}</dd>
              <dt>パスワード</dt>
              <dd className="num">{handover.password}</dd>
            </dl>
          </div>
          <div className="modal__foot">
            <button
              type="button"
              className="btn"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(
                    `食数発注システム\nログインID: ${handover.loginId}\nパスワード: ${handover.password}`
                  )
                  .catch(() => {})
              }}
            >
              コピーする
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setHandover(null)}>
              伝えたので閉じる
            </button>
          </div>
        </section>
      )}

      {showForm && (
        <UserForm
          initial={editTarget}
          blocks={blocks}
          takenLoginIds={users
            .filter((u) => u.id !== editTarget?.id)
            .map((u) => u.login_id)}
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
            <table className="data" aria-label="利用者の一覧">
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
                        <button
                          type="button"
                          className="btn btn--sm"
                          onClick={() => openForm(user)}
                          aria-label={`${user.name} を編集`}
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          className="btn btn--sm btn--danger"
                          onClick={() => setDeleteTarget(user)}
                          aria-label={`${user.name} を削除`}
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
  takenLoginIds,
  onSuccess,
  onCancel,
}: {
  initial: UserRecord | null
  blocks: Block[]
  /** 既に使われているログインID。送信前に気づけるようにする */
  takenLoginIds: string[]
  /** 追加したときは、本人に伝えるための認証情報も返す */
  onSuccess: (msg: string, created?: { name: string; loginId: string; password: string }) => void
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
  // 伏せ字のままだと打ち間違いに気づけない。相手に伝える必要もある
  const [showPassword, setShowPassword] = useState(false)
  // 開いたらフォーカスを中へ、Escape で閉じる、背面はスクロールさせない
  const closeRef = useModal(onCancel)

  const trimmedId = loginId.trim()
  const loginIdError =
    validateLoginId(trimmedId) ??
    (takenLoginIds.includes(trimmedId) ? 'このログインIDはすでに使われています' : null)
  const passwordTooShort = password.length > 0 && password.length < 8

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
        onSuccess(`「${name}」を追加しました`, {
          name: name.trim(),
          loginId: loginId.trim(),
          password,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存できませんでした。もう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="backdrop"
      onMouseDown={(e) => {
        // 書きかけを背景クリックで消さない。閉じるのは「やめる」と Escape だけ
        if (e.target === e.currentTarget) e.preventDefault()
      }}
    >
      <form
        className="modal"
        style={{ maxWidth: 820 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="userform-title"
        onSubmit={handleSubmit}
      >
      <div className="modal__head">
        <h3 id="userform-title">{isEdit ? `${initial!.name} を編集` : '利用者を追加'}</h3>
        <button
          type="button"
          className="btn btn--sm"
          ref={closeRef}
          onClick={onCancel}
          style={{ marginLeft: 'auto' }}
        >
          閉じる
        </button>
      </div>

      <div className="modal__body">
        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}

        {/* 7項目を平らに並べると、必須の項目と任意の連携設定が同じ重さに見える。
            意味のまとまりで区切り、任意のものは最後に畳んでおく */}
        <fieldset className="formgroup">
          <legend>この人の情報</legend>
          <div className="grid2">
            <label className="field">
              <span>
                名前 <span className="field__req">必須</span>
              </span>
              <input
                className="input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 高橋 直子"
                autoFocus
                required
              />
            </label>

            <label className="field">
              <span>
                ログインID <span className="field__req">必須</span>
              </span>
              <input
                className="input"
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="例: takahashi"
                autoComplete="off"
                aria-invalid={!!loginIdError}
                aria-describedby="loginid-hint"
                required
              />
              {/* 送信して初めて重複を知らされると、入力をやり直すことになる */}
              <span
                className={loginIdError ? 'field__error' : 'field__hint'}
                id="loginid-hint"
                role={loginIdError ? 'alert' : undefined}
              >
                {loginIdError ?? 'この人がログインに使います。半角の英数字'}
              </span>
            </label>

            <div className="field">
              <label htmlFor="pw-input">
                パスワード{' '}
                {isEdit ? (
                  <span className="field__hint">空欄のままなら変更しません</span>
                ) : (
                  <span className="field__req">必須</span>
                )}
              </label>
              <div className="inputrow">
                {/* 管理者が他人のぶんを作るので、何を設定したか本人に伝える必要がある。
                    伏せ字のままだと打ち間違いにも気づけない */}
                <input
                  id="pw-input"
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  aria-invalid={passwordTooShort}
                  aria-describedby="pw-hint"
                />
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword}
                >
                  {showPassword ? '隠す' : '見る'}
                </button>
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => {
                    setPassword(generatePassword())
                    setShowPassword(true)
                  }}
                >
                  作る
                </button>
              </div>
              <span
                className={passwordTooShort ? 'field__error' : 'field__hint'}
                id="pw-hint"
                role={passwordTooShort ? 'alert' : undefined}
              >
                {passwordTooShort
                  ? '8文字以上にしてください'
                  : '8文字以上。「作る」で読み違えにくいものを生成します'}
              </span>
            </div>
          </div>
        </fieldset>

        <fieldset className="formgroup">
          <legend>この人ができること</legend>
          <div className="grid2">
            <label className="field">
              <span>権限</span>
              <select
                className="select"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as 'admin' | 'user')
                  if (e.target.value === 'admin') setBlockId(null)
                }}
                aria-describedby="role-hint"
              >
                <option value="user">一般</option>
                <option value="admin">管理者</option>
              </select>
              <span className="field__hint" id="role-hint">
                {role === 'admin'
                  ? '全ブロックの食数と献立、利用者の登録まで扱えます'
                  : '担当ブロックの食数と献立だけを扱えます'}
              </span>
            </label>

            {/* 管理者は全ブロックを見るので、担当を決める意味がない */}
            {role === 'user' && (
              <label className="field">
                <span>担当ブロック</span>
                <select
                  className="select"
                  value={blockId ?? ''}
                  onChange={(e) => setBlockId(e.target.value ? Number(e.target.value) : null)}
                  aria-describedby="block-hint"
                >
                  <option value="">未割当</option>
                  {blocks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <span className="field__hint" id="block-hint">
                  未割当のままだと、食数の入力画面に何も出ません
                </span>
              </label>
            )}
          </div>
        </fieldset>

        {/* 連携を使わない人のほうが多い。既定では畳んでおく */}
        <details className="formgroup formgroup--optional" open={!!kamahoLoginId}>
          <summary>
            食数管理システムとの連携
            <span className="field__hint">任意・あとから設定できます</span>
          </summary>
          <p className="muted" style={{ margin: '0.4rem 0 0.8rem', fontSize: 'var(--fs-sm)' }}>
            設定すると、この人がログインしているときの食数の取得に、この連携情報を使います。
          </p>
          <div className="grid2">
            <label className="field">
              <span>連携ログインID</span>
              <input
                className="input"
                type="text"
                value={kamahoLoginId}
                onChange={(e) => setKamahoLoginId(e.target.value)}
                autoComplete="off"
              />
            </label>

            <label className="field">
              <span>
                連携パスワード{' '}
                {isEdit && <span className="field__hint">空欄のままなら変更しません</span>}
              </span>
              <input
                className="input"
                type="password"
                value={kamahoPassword}
                onChange={(e) => setKamahoPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
          </div>
        </details>
      </div>

      <div className="modal__foot">
        <button type="button" className="btn" onClick={onCancel}>
          やめる
        </button>
        <button
          type="submit"
          className="btn btn--primary"
          disabled={saving || !!loginIdError || passwordTooShort}
        >
          {saving ? '保存しています' : isEdit ? '更新する' : '追加する'}
        </button>
      </div>
      </form>
    </div>
  )
}
