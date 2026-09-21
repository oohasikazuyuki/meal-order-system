'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { login } from '../_lib/api/client'
import { saveAuth, isLoggedIn } from '../_lib/auth'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isLoggedIn()) router.replace('/')
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginId || !password) {
      setError('ログインIDとパスワードの両方を入力してください。')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await login(loginId, password)
      if (res.data.ok) {
        saveAuth(res.data.token, res.data.user)
        router.push(searchParams.get('redirect') || '/')
      }
    } catch {
      setError('ログインIDかパスワードが違います。入力し直してください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        placeItems: 'center',
        background: 'var(--ink)',
        padding: '1.5rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ color: 'var(--on-ink)', marginBottom: '1.2rem' }}>
          <h1 style={{ fontSize: 'var(--fs-xl)', letterSpacing: '0.06em' }}>食数発注システム</h1>
          <p style={{ margin: '0.15rem 0 0', fontSize: 'var(--fs-sm)', color: 'rgba(242,245,243,0.6)' }}>
            厨房と事務で使う、日々の食数と発注の記録
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            background: 'var(--paper)',
            border: '1px solid var(--rule)',
            borderRadius: 'var(--r)',
            padding: '1.2rem',
          }}
        >
          {error && (
            <p className="notice notice--error" role="alert">
              {error}
            </p>
          )}

          <label className="field">
            <span>ログインID</span>
            <input
              className="input"
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </label>

          <label className="field">
            <span>パスワード</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>

          <button
            type="submit"
            className="btn btn--primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '0.5rem' }}
          >
            {loading ? 'ログインしています' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
